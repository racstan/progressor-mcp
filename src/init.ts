// `progressor-mcp init`: sets a project up for Progressor in one go. It registers the MCP server in
// .mcp.json, adds the Claude Code hooks to .claude/settings.json, puts a short note for the Agent in
// CLAUDE.md and AGENTS.md and creates the Roadmap. Every change is worked out first, so the Developer sees the
// list before anything is written; running it again changes nothing, and --remove undoes it all
// except the progress record.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { PRIVATE_GITIGNORE, PROGRESSOR_DIR, ROADMAP_FILE } from "./project.js";

/** How the Agent's app starts Progressor, and the command the hooks run. */
export interface Launch {
  /** The entry for the shared .mcp.json, the same on every system. */
  server: { command: string; args: string[] };
  /** The hook command without its event, such as "progressor-mcp hook". */
  hook: string;
  /** On Windows, the entry Claude Code needs on this computer; it goes in Claude Code's local settings. */
  local?: { command: string; args: string[] };
}

/** Started through npx when the running script sits in npm's npx cache. */
export const startedViaNpx = (script = process.argv[1] ?? "") => /[\\/]_npx[\\/]/.test(script);

/**
 * The global command when Progressor is installed globally, else npx. On Windows the app starts the
 * server without a shell, so the npm launcher needs `cmd /c` in front of it. That would break the
 * server on macOS and Linux, so .mcp.json, which teammates share, gets the plain command and the
 * wrapped one goes in Claude Code's local settings for this folder, which win over .mcp.json and
 * stay on this computer. Hooks run in a shell, so they need no wrapper.
 */
export function launchFor({ viaNpx, platform }: { viaNpx: boolean; platform: NodeJS.Platform }): Launch {
  const base = viaNpx ? ["npx", "-y", "progressor-mcp"] : ["progressor-mcp"];
  const launch: Launch = { server: { command: base[0]!, args: base.slice(1) }, hook: `${base.join(" ")} hook` };
  if (platform === "win32") launch.local = { command: "cmd", args: ["/c", ...base] };
  return launch;
}

export interface Change {
  /** The file, relative to the project folder. */
  file: string;
  /** What changes, in a few words, for the list shown before anything is written. */
  what: string;
  /** The new contents, or null to delete the file. */
  contents: string | null;
  /** Where to write it. */
  path: string;
}

export function applyChanges(changes: Change[]): void {
  for (const c of changes) {
    if (c.contents === null) {
      rmSync(c.path, { force: true });
    } else {
      mkdirSync(dirname(c.path), { recursive: true });
      writeFileSync(c.path, c.contents);
    }
  }
}

/** `claude` commands to run in the project folder, for settings Claude Code keeps outside it. */
export interface LocalStep {
  what: string;
  commands: string[][];
}

/** Claude Code's ~/.claude.json keeps local servers per folder; on Windows it may write the folder with forward slashes. */
function localServer(root: string, config: Json | undefined): Json | undefined {
  const projects = config?.projects;
  if (!projects || typeof projects !== "object") return undefined;
  return (projects[root] ?? projects[root.split("\\").join("/")])?.mcpServers?.[SERVER_NAME];
}

const removeLocal = () => ["mcp", "remove", "--scope", "local", SERVER_NAME];

/** On Windows, registers the wrapped command for this folder in Claude Code's local settings, unless it is there already. */
export function planLocal(root: string, launch: Launch, config: Json | undefined): LocalStep | undefined {
  if (!launch.local) return undefined;
  const current = localServer(root, config);
  if (current?.command === launch.local.command && JSON.stringify(current.args ?? []) === JSON.stringify(launch.local.args)) return undefined;
  const how = [launch.local.command, ...launch.local.args];
  return {
    what: `${current ? "update" : "add"} the "${SERVER_NAME}" MCP server for this folder on this computer (${how.join(" ")}), which Windows needs`,
    commands: [...(current ? [removeLocal()] : []), ["mcp", "add", "--scope", "local", SERVER_NAME, "--", ...how]],
  };
}

/** Takes the local entry that planLocal added out again. */
export function planLocalRemove(root: string, config: Json | undefined): LocalStep | undefined {
  if (localServer(root, config) === undefined) return undefined;
  return { what: `remove the "${SERVER_NAME}" MCP server for this folder on this computer`, commands: [removeLocal()] };
}

/** Whether a command can be found the way an app finds it: as a path, or in a PATH folder, with PATHEXT's extensions on Windows. */
export function onPath(command: string, env: Record<string, string | undefined>, platform: NodeJS.Platform): boolean {
  const exts = platform === "win32" ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)] : [""];
  const dirs = isAbsolute(command) ? [""] : (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  return dirs.some((dir) => exts.some((ext) => existsSync(join(dir, command + ext))));
}

/**
 * A warning for the Agent when .mcp.json starts Progressor with a command this computer doesn't
 * have, such as Windows' cmd on a Mac. Claude Code then fails quietly, while the hooks still run.
 */
export function launcherWarning(root: string, canRun: (command: string) => boolean): string | undefined {
  let command: unknown;
  try {
    command = readJson(root, MCP_FILE)?.mcpServers?.[SERVER_NAME]?.command;
  } catch {
    return undefined;
  }
  if (typeof command !== "string" || canRun(command)) return undefined;
  return (
    `Warning: Claude Code can't start Progressor's MCP server in this folder: .mcp.json starts it with "${command}", ` +
    "which this computer doesn't have. Tell the Developer, and offer to run `progressor-mcp init` in this folder, which fixes it."
  );
}

const MCP_FILE = ".mcp.json";
const SETTINGS_FILE = join(".claude", "settings.json");
const LOCAL_SETTINGS_FILE = join(".claude", "settings.local.json");
// Claude Code reads CLAUDE.md; most other apps (Cursor, Copilot, Windsurf, Codex) read AGENTS.md.
const NOTE_FILES = ["CLAUDE.md", "AGENTS.md"];
const SERVER_NAME = "progressor";
const HOOKS = { SessionStart: "session-start", UserPromptSubmit: "prompt" } as const;
const NOTE_START = "<!-- progressor:start -->";
const NOTE_END = "<!-- progressor:end -->";
const NOTE = `${NOTE_START}
## Progressor

This project keeps its plan with Progressor, an MCP server. The plan is in \`.progressor/\`: change it only through the Progressor tools, never by editing those files. Call \`get_status\` at the start of a conversation and after your context is compressed, keep the Tasks up to date as you work, and declare a Detour (\`start_detour\`) before doing anything that is not the current Task.
${NOTE_END}`;

type Json = Record<string, any>;

const withEol = (text: string, eol: string) => (eol === "\n" ? text : text.replace(/\n/g, eol));

/**
 * Where Progressor's note sits in a file, or undefined when it has none. A start marker without its
 * end, a second copy, or an end without a start means the file was edited by hand; setup and --remove
 * then stop with a clear message instead of guessing what to cut out.
 */
function findNote(text: string, file: string): { start: number; end: number } | undefined {
  const count = (marker: string) => text.split(marker).length - 1;
  const starts = count(NOTE_START);
  const ends = count(NOTE_END);
  if (starts === 0 && ends === 0) return undefined;
  const start = text.indexOf(NOTE_START);
  const end = text.indexOf(NOTE_END);
  const fix = "Nothing was changed. Fix it by hand (keep one pair of those lines, or delete them all) and run this again.";
  if (starts > 1 || ends > 1) return fail(`${file} has Progressor's note more than once (${NOTE_START} ... ${NOTE_END}). ${fix}`);
  if (starts === 1 && ends === 1 && end > start) return { start, end: end + NOTE_END.length };
  return fail(`${file} has a damaged Progressor note: the ${starts ? NOTE_START : NOTE_END} line has no matching ${starts ? NOTE_END : NOTE_START} line, or they are the wrong way round. ${fix}`);
}

function fail(message: string): never {
  throw new Error(message);
}

const display = (file: string) => file.split("\\").join("/");
const text = (data: Json) => `${JSON.stringify(data, null, 2)}\n`;

function readJson(root: string, file: string): Json | undefined {
  const path = join(root, file);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Json;
  } catch {
    // reported below
  }
  throw new Error(`${file} is not valid JSON; fix it (or move it aside) and run init again.`);
}

/** A hook entry that runs one of Progressor's hook commands, whichever way it starts Progressor. */
const isProgressorHook = (h: any, event: string) =>
  typeof h?.command === "string" && new RegExp(`progressor-mcp(@\\S+)? hook ${event}\\b`).test(h.command);

/** Whether a settings file has both of Progressor's hooks; false for one that is missing or unreadable. */
function hasHooks(dir: string, file: string): boolean {
  try {
    const hooks = readJson(dir, file)?.hooks;
    return Object.entries(HOOKS).every(([event, name]) =>
      (Array.isArray(hooks?.[event]) ? hooks[event] : []).some((e: any) => Array.isArray(e?.hooks) && e.hooks.some((h: any) => isProgressorHook(h, name))),
    );
  } catch {
    return false;
  }
}

/**
 * A line for the Agent when Claude Code has no Progressor hooks for this folder (in the project's
 * settings, its local settings or the user's), saying how to add them; undefined when they are there.
 * Without the prompt hook, the Developer's dashboard messages reach the Agent only at its next call.
 */
export function hooksAdvice(root: string, home: string, launch: Launch): string | undefined {
  if (hasHooks(root, SETTINGS_FILE) || hasHooks(root, LOCAL_SETTINGS_FILE) || hasHooks(home, SETTINGS_FILE)) return undefined;
  let inMcpJson = false;
  try {
    inMcpJson = readJson(root, MCP_FILE)?.mcpServers?.[SERVER_NAME] !== undefined;
  } catch {
    // a broken .mcp.json: the init without the server is the safe advice
  }
  const command = `${launch.hook.replace(/ hook$/, "")} init${inMcpJson ? "" : " --no-server"}`;
  return (
    "Hooks aren't set up in this project, so the Developer's dashboard messages reach you only when you call Progressor. " +
    `Offer to run \`${command}\` in this folder, which adds them to .claude/settings.json.`
  );
}

const change = (root: string, file: string, what: string, contents: string | null): Change => ({
  file: display(file),
  what,
  contents,
  path: join(root, file),
});

/**
 * The changes that set a project up. Without the server (`server: false`), .mcp.json is left alone:
 * that is for an app that already runs Progressor in this folder, say from the user's own MCP
 * settings, where a project entry would only start a second copy.
 */
export function planInit(root: string, launch: Launch, { server = true }: { server?: boolean } = {}): Change[] {
  const changes: Change[] = [];

  const mcp = server ? (readJson(root, MCP_FILE) ?? {}) : {};
  const current = mcp.mcpServers?.[SERVER_NAME];
  if (server && JSON.stringify(current) !== JSON.stringify(launch.server)) {
    const next = { ...mcp, mcpServers: { ...(mcp.mcpServers ?? {}), [SERVER_NAME]: launch.server } };
    const how = [launch.server.command, ...launch.server.args].join(" ");
    changes.push(change(root, MCP_FILE, `${current ? "update" : "add"} the "${SERVER_NAME}" MCP server (${how})`, text(next)));
  }

  const settings = readJson(root, SETTINGS_FILE) ?? {};
  const hooks: Json = { ...(settings.hooks ?? {}) };
  const edits: string[] = [];
  for (const [event, name] of Object.entries(HOOKS)) {
    const command = `${launch.hook} ${name}`;
    const entries: any[] = Array.isArray(hooks[event]) ? hooks[event] : [];
    const ours = entries.flatMap((e) => (Array.isArray(e?.hooks) ? e.hooks : [])).filter((h: any) => isProgressorHook(h, name));
    if (ours.length === 1 && ours[0].command === command) continue;
    // Drop any older Progressor hook (say, an npx one) and add the current one.
    const kept = entries
      .map((e) => (Array.isArray(e?.hooks) ? { ...e, hooks: e.hooks.filter((h: any) => !isProgressorHook(h, name)) } : e))
      .filter((e) => !Array.isArray(e?.hooks) || e.hooks.length > 0);
    hooks[event] = [...kept, { hooks: [{ type: "command", command }] }];
    edits.push(`${ours.length > 0 ? "update" : "add"} the ${event} hook (${command})`);
  }
  if (edits.length > 0) changes.push(change(root, SETTINGS_FILE, edits.join("; "), text({ ...settings, hooks })));

  for (const file of NOTE_FILES) {
    const notePath = join(root, file);
    const note = existsSync(notePath) ? readFileSync(notePath, "utf8") : undefined;
    const found = note === undefined ? undefined : findNote(note, file);
    const eol = note?.includes("\r\n") ? "\r\n" : "\n";
    const block = withEol(NOTE, eol);
    if (note === undefined) {
      changes.push(change(root, file, "create it with a short note telling the Agent to use Progressor", `${NOTE}\n`));
    } else if (!found) {
      const sep = note === "" || note.endsWith(eol + eol) ? "" : note.endsWith("\n") ? eol : eol + eol;
      changes.push(change(root, file, "add a short note telling the Agent to use Progressor", `${note}${sep}${block}${eol}`));
    } else if (note.slice(found.start, found.end) !== block) {
      changes.push(change(root, file, "update Progressor's note to the Agent", note.slice(0, found.start) + block + note.slice(found.end)));
    }
  }

  const roadmap = join(PROGRESSOR_DIR, ROADMAP_FILE);
  if (!existsSync(join(root, roadmap)))
    changes.push(change(root, roadmap, "create an empty Roadmap, which makes this folder a Progressor project", "# Roadmap\n"));
  if (!existsSync(join(root, PROGRESSOR_DIR)))
    changes.push(change(root, join(PROGRESSOR_DIR, ".gitignore"), "keep the plan out of git, until you choose to share it", PRIVATE_GITIGNORE));

  return changes;
}

/** Undoes init: Progressor's server, hooks and note go; the progress record in .progressor/ stays. */
export function planRemove(root: string): Change[] {
  const changes: Change[] = [];
  const empty = (o: Json) => Object.keys(o).length === 0;

  const mcp = readJson(root, MCP_FILE);
  if (mcp?.mcpServers?.[SERVER_NAME] !== undefined) {
    const { [SERVER_NAME]: _, ...servers } = mcp.mcpServers as Json;
    const next: Json = { ...mcp, mcpServers: servers };
    if (empty(servers)) delete next.mcpServers;
    changes.push(change(root, MCP_FILE, `remove the "${SERVER_NAME}" MCP server`, empty(next) ? null : text(next)));
  }

  const settings = readJson(root, SETTINGS_FILE);
  if (settings?.hooks) {
    const hooks: Json = { ...settings.hooks };
    let removed = false;
    for (const [event, name] of Object.entries(HOOKS)) {
      if (!Array.isArray(hooks[event])) continue;
      const kept = (hooks[event] as any[])
        .map((e) => {
          if (!Array.isArray(e?.hooks)) return e;
          const left = e.hooks.filter((h: any) => !isProgressorHook(h, name));
          if (left.length !== e.hooks.length) removed = true;
          return { ...e, hooks: left };
        })
        .filter((e) => !Array.isArray(e?.hooks) || e.hooks.length > 0);
      if (kept.length > 0) hooks[event] = kept;
      else delete hooks[event];
    }
    if (removed) {
      const next: Json = { ...settings, hooks };
      if (empty(hooks)) delete next.hooks;
      changes.push(change(root, SETTINGS_FILE, "remove Progressor's hooks", empty(next) ? null : text(next)));
    }
  }

  for (const file of NOTE_FILES) {
    const notePath = join(root, file);
    const note = existsSync(notePath) ? readFileSync(notePath, "utf8") : "";
    const found = findNote(note, file);
    if (!found) continue;
    const eol = note.includes("\r\n") ? "\r\n" : "\n";
    const rest = `${note.slice(0, found.start).replace(/\s+$/, "")}${eol}${note.slice(found.end).replace(/^\s+/, "")}`.replace(/^(\r?\n)+/, "");
    changes.push(change(root, file, "remove Progressor's note to the Agent", rest.trim() ? `${rest.replace(/\s+$/, "")}${eol}` : null));
  }

  return changes;
}

/** Where Claude Desktop keeps its settings on this system; only the folders that exist (the app is installed). */
export function desktopConfigs({ env, platform, home }: { env: Record<string, string | undefined>; platform: NodeJS.Platform; home: string }): string[] {
  const file = "claude_desktop_config.json";
  const out: string[] = [];
  if (platform === "win32") {
    if (env.APPDATA && existsSync(join(env.APPDATA, "Claude"))) out.push(join(env.APPDATA, "Claude", file));
    // The Microsoft Store version keeps its settings inside its own package folder.
    if (env.LOCALAPPDATA) {
      const packages = join(env.LOCALAPPDATA, "Packages");
      let names: string[] = [];
      try {
        names = readdirSync(packages).filter((n) => /^Claude_/.test(n)).sort();
      } catch {
        // no packages folder
      }
      for (const n of names) out.push(join(packages, n, "LocalCache", "Roaming", "Claude", file));
    }
    return out;
  }
  const folder = platform === "darwin" ? join(home, "Library", "Application Support", "Claude") : join(home, ".config", "Claude");
  return existsSync(folder) ? [join(folder, file)] : [];
}

function readDesktop(path: string): Json {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Json;
  } catch {
    // reported below
  }
  throw new Error(`${path} is not valid JSON; fix it (or move it aside) and run setup again.`);
}

/** The project folder Claude Desktop's Progressor works on now, if it has one. */
export function desktopProject(configPath: string): string | undefined {
  try {
    const root = readDesktop(configPath).mcpServers?.[SERVER_NAME]?.env?.PROGRESSOR_ROOT;
    return typeof root === "string" ? root : undefined;
  } catch {
    return undefined;
  }
}

/** Claude Desktop starts servers without a shell, so on Windows it gets the cmd /c form. It has no project folder, so it is told one. */
export function planDesktop(
  root: string,
  launch: Launch,
  configPath: string,
  { switchProject = true }: { switchProject?: boolean } = {},
): Change | undefined {
  const config = readDesktop(configPath);
  const how = launch.local ?? launch.server;
  const entry = { command: how.command, args: how.args, env: { PROGRESSOR_ROOT: root } };
  const current = config.mcpServers?.[SERVER_NAME];
  if (JSON.stringify(current) === JSON.stringify(entry)) return undefined;
  // Claude Desktop has one project folder: a plain setup in another project leaves it where it is.
  const itsRoot = current?.env?.PROGRESSOR_ROOT;
  if (!switchProject && typeof itsRoot === "string" && itsRoot !== root) return undefined;
  const next = { ...config, mcpServers: { ...(config.mcpServers ?? {}), [SERVER_NAME]: entry } };
  return {
    file: display(configPath),
    what: `${current ? "update" : "add"} the "${SERVER_NAME}" server for Claude Desktop (project folder ${root})`,
    contents: text(next),
    path: configPath,
  };
}

/** Takes Progressor out of Claude Desktop's settings; the file itself stays, as it belongs to the app. */
export function planDesktopRemove(configPath: string, root?: string): Change | undefined {
  if (!existsSync(configPath)) return undefined;
  const config = readDesktop(configPath);
  if (config.mcpServers?.[SERVER_NAME] === undefined) return undefined;
  // Claude Desktop has one project folder: leave it alone when it points at another project.
  const itsRoot = config.mcpServers[SERVER_NAME]?.env?.PROGRESSOR_ROOT;
  if (root !== undefined && typeof itsRoot === "string" && itsRoot !== root) return undefined;
  const { [SERVER_NAME]: _, ...servers } = config.mcpServers as Json;
  const next: Json = { ...config, mcpServers: servers };
  if (Object.keys(servers).length === 0) delete next.mcpServers;
  return { file: display(configPath), what: `remove the "${SERVER_NAME}" server from Claude Desktop`, contents: text(next), path: configPath };
}

/** What a run sets up: the project for Claude Code (always, unless --desktop alone), and Claude Desktop where it is installed. */
export function pickTargets(flags: string[], found: string[]): { code: boolean; desktop: string[] } {
  const code = flags.includes("--code");
  const desktop = flags.includes("--desktop");
  if (flags.includes("--all")) return { code: true, desktop: found };
  if (!code && !desktop) return { code: true, desktop: found };
  return { code, desktop: desktop ? found : [] };
}
