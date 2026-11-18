// Is a newer Progressor out? Asks npm for the latest version at most once a day, keeps the answer in
// update-check.json beside the project list, and says how to update for the way Progressor was
// installed. The dashboard shows a notice the Developer can dismiss for that version; the AI is told
// once per version in get_status. Offline or turned off (Settings › Advanced › Updates), nothing breaks
// and nothing is asked.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const LATEST_URL = "https://registry.npmjs.org/progressor-mcp/latest";
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
export const RETRY_AFTER_MS = 60 * 60 * 1000;

/** What update-check.json keeps. */
export interface UpdateState {
  /** The latest version npm gave. */
  latest?: string;
  /** When npm last answered (ms). */
  checkedAt?: number;
  /** When asking npm last failed (ms), so an offline computer isn't asked again for an hour. */
  failedAt?: number;
  /** The version the Developer dismissed the notice for. */
  dismissed?: string;
  /** The version the AI was last told about. */
  toldAI?: string;
}

/** uvx, uv-tool and pip are the Python package, whose launcher says which in PROGRESSOR_INSTALL. */
export type Install = "global" | "npx" | "docker" | "uvx" | "uv-tool" | "pip";

const PYTHON_INSTALLS: readonly Install[] = ["uvx", "uv-tool", "pip"];

export interface UpdateView {
  current: string;
  latest?: string;
  available: boolean;
  install: Install;
  command: string;
  enabled: boolean;
}

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const updateFileFor = (registryFile: string) => join(dirname(registryFile), "update-check.json");

function parse(v: string): { nums: number[]; pre: boolean } | undefined {
  if (!VERSION.test(v)) return undefined;
  const [main, pre] = v.split(/-(.*)/, 2);
  return { nums: main!.split(".").map(Number), pre: pre !== undefined };
}

/** Whether `latest` is a newer release than `current`. A test version (1.5.0-beta.1) is never offered. */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b || a.pre) return false;
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i]! > b.nums[i]!;
  return b.pre;
}

export function readUpdateState(file: string): UpdateState {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const out: UpdateState = {};
    for (const key of ["latest", "dismissed", "toldAI"] as const) if (typeof data[key] === "string" && VERSION.test(data[key])) out[key] = data[key];
    for (const key of ["checkedAt", "failedAt"] as const) if (typeof data[key] === "number") out[key] = data[key];
    return out;
  } catch {
    return {};
  }
}

function writeUpdateState(file: string, state: UpdateState): void {
  mkdirSync(dirname(file), { recursive: true });
  const text = `${JSON.stringify(state, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
  }
}

const change = (file: string, edit: (s: UpdateState) => UpdateState) => writeUpdateState(file, edit(readUpdateState(file)));

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** Asks npm when the last answer is a day old (or a failure an hour old), and keeps what it said. */
export async function refreshUpdate(file: string, opts: { now?: number; fetch?: FetchLike; enabled?: boolean } = {}): Promise<UpdateState> {
  const state = readUpdateState(file);
  if (opts.enabled === false) return state;
  const now = opts.now ?? Date.now();
  if (state.checkedAt !== undefined && now - state.checkedAt < CHECK_EVERY_MS) return state;
  if (state.failedAt !== undefined && now - state.failedAt < RETRY_AFTER_MS) return state;
  const fetchFn: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  let latest: string | undefined;
  try {
    const res = await fetchFn(LATEST_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const body = (await res.json()) as { version?: unknown };
      if (typeof body.version === "string" && VERSION.test(body.version)) latest = body.version;
    }
  } catch {
    // offline or npm unreachable: try again in an hour
  }
  const next: UpdateState = latest ? { ...readUpdateState(file), latest, checkedAt: now, failedAt: undefined } : { ...readUpdateState(file), failedAt: now };
  try {
    writeUpdateState(file, next);
  } catch {
    // a folder we can't write to: the answer still counts for now
  }
  return next;
}

export function dismissUpdate(file: string, version: string): void {
  if (!VERSION.test(version)) throw new Error("That is not a version.");
  change(file, (s) => ({ ...s, dismissed: version }));
}

/** How this Progressor was installed, from its environment and the path of the running script. */
export function howInstalled(env: NodeJS.ProcessEnv = process.env, script: string = process.argv[1] ?? ""): Install {
  if (env.PROGRESSOR_CONTAINER) return "docker";
  const python = PYTHON_INSTALLS.find((i) => i === env.PROGRESSOR_INSTALL);
  if (python) return python;
  if (/[\\/]_npx[\\/]/.test(script)) return "npx";
  return "global";
}

export function updateCommand(install: Install): string {
  if (install === "docker") return "docker pull ghcr.io/racstan/progressor-mcp:latest";
  // uvx keeps using the version it has cached, so clearing it makes the next start fetch the newest.
  if (install === "uvx") return "uv cache clean progressor-mcp";
  if (install === "uv-tool") return "uv tool upgrade progressor-mcp";
  if (install === "pip") return "pip install -U progressor-mcp";
  if (install === "npx") return "Nothing to install: restart your AI app and npx fetches the new version.";
  return "npm install -g progressor-mcp@latest";
}

export function updateView(state: UpdateState, current: string, install: Install, enabled = true): UpdateView {
  const available = enabled && !!state.latest && isNewer(state.latest, current) && state.dismissed !== state.latest;
  return { current, latest: state.latest, available, install, command: updateCommand(install), enabled };
}

/** The line for get_status: once per newer version, never after the Developer dismissed it. */
export function takeUpdateLine(file: string, current: string, install: Install, enabled = true): string | undefined {
  const state = readUpdateState(file);
  const view = updateView(state, current, install, enabled);
  if (!view.available || state.toldAI === state.latest) return undefined;
  try {
    change(file, (s) => ({ ...s, toldAI: state.latest }));
  } catch {
    return undefined;
  }
  const how = install === "npx" ? view.command : `Offer to update it with \`${view.command}\`, then ask the Developer to restart the AI app.`;
  return `Progressor ${state.latest} is out (this is ${current}). ${how}`;
}
