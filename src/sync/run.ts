// One round of plan sync, and running it in the background (plan sync).
//
// The plans repo is a git clone in ~/.progressor/plans with one folder per project (its sync key). A
// round never uses git's own merge: it keeps a straight history and merges the plan files itself.
//   BASE   = the files as they were when this computer last agreed with the repo (its remote branch
//            as last fetched, so a change still waiting to be pushed is not mistaken for agreed),
//   LOCAL  = the project's own plan files,
//   THEIRS = the repo's files after fetching.
// merge.ts merges the three goal by goal; the result is written to the clone and, where it differs,
// back into the project; then it is committed and pushed. Offline, the round still merges and commits,
// and the push happens in a later round. Nothing is ever lost silently: what lost a clash is kept in
// sync-state.json (the last 50).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import { withLock, withLockAsync } from "../lock.js";
import { PROGRESSOR_DIR } from "../project.js";
import { readSettings } from "../settings.js";
import { type Run, realRun } from "./connect.js";
import { syncKey } from "./identity.js";
import { mergePlanFolder } from "./merge.js";

export interface SyncDeps {
  settingsFile: string;
  plansDir: string;
  /** Every registered project's folder, including ones with no .progressor yet. */
  projects: string[];
  host: string;
  run?: Run;
  now?: () => number;
  linksFile?: string;
  /** The rules for every project; `global.json` beside the settings file unless set. */
  globalFile?: string;
  stateFile?: string;
  remote?: (root: string) => string | undefined;
}

export interface SyncResult {
  ok: boolean;
  offline: boolean;
  /** Whether this round changed anything (the repo or a project). */
  changed: boolean;
  pushed: boolean;
  conflicts: number;
  problem?: string;
}

export interface StoredConflict {
  file: string;
  section: string;
  id: string;
  kept: "ours" | "theirs";
  /** The text that lost; "" when it was a deletion or a picture. */
  lost: string;
  project: string;
  host: string;
  at: string;
}

export interface SyncState {
  lastSync?: string;
  lastAttempt?: string;
  ok: boolean;
  problem?: string;
  offline: boolean;
  /** Commits made here that are not on GitHub yet. */
  pending: number;
  conflicts: StoredConflict[];
}

const KEEP_CONFLICTS = 50;
const GLOBAL_KEY = ".global";
const GLOBAL_NAME = "global.json";
const NOT_SET_UP = "Plan sync isn't set up on this computer. Run: progressor-mcp sync connect";
const OFFLINE = "Can't reach GitHub; your changes will sync when you're back online.";

export const syncStateFileFor = (settingsFile: string) => join(dirname(settingsFile), "sync-state.json");

export function readSyncState(file: string): SyncState {
  try {
    const d = JSON.parse(readFileSync(file, "utf8")) as Partial<SyncState>;
    return {
      lastSync: typeof d.lastSync === "string" ? d.lastSync : undefined,
      lastAttempt: typeof d.lastAttempt === "string" ? d.lastAttempt : undefined,
      ok: d.ok === true,
      problem: typeof d.problem === "string" ? d.problem : undefined,
      offline: d.offline === true,
      pending: typeof d.pending === "number" ? d.pending : 0,
      conflicts: Array.isArray(d.conflicts) ? (d.conflicts as StoredConflict[]).slice(-KEEP_CONFLICTS) : [],
    };
  } catch {
    return { ok: false, offline: false, pending: 0, conflicts: [] };
  }
}

function writeState(file: string, state: SyncState): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const text = `${JSON.stringify(state, null, 2)}\n`;
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, text);
    try {
      renameSync(tmp, file);
    } catch {
      writeFileSync(file, text);
    }
  } catch {
    // the state file is only for showing; a round does not fail over it
  }
}

// ---- files -------------------------------------------------------------------------------------

type Files = Map<string, Buffer>;

/** Whether a path inside .progressor/ is shared: plan files always; messages, screenshots and attachments when `talk` is on. */
export function syncable(rel: string, talk: boolean): boolean {
  if (rel.includes(".tmp") || rel.endsWith(".lock")) return false;
  const parts = rel.split("/");
  if (parts.length === 1) return rel.endsWith(".md");
  if (parts.length === 2 && parts[0] === "goals") return rel.endsWith(".md");
  return talk && ["talk", "pictures", "attachments"].includes(parts[0]!);
}

const isText = (rel: string) => rel.endsWith(".md") && (!rel.includes("/") || rel.startsWith("goals/"));

function walk(dir: string, sub: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(join(dir, sub), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) walk(dir, rel, out);
    else if (e.isFile()) out.push(rel);
  }
}

/** The shared files in a folder, by path inside it. */
function collect(dir: string, talk: boolean): { files: Files; times: Map<string, number> } {
  const names: string[] = [];
  walk(dir, "", names);
  const files: Files = new Map();
  const times = new Map<string, number>();
  for (const rel of names) {
    if (!syncable(rel, talk)) continue;
    try {
      files.set(rel, readFileSync(join(dir, rel)));
      times.set(rel, statSync(join(dir, rel)).mtimeMs);
    } catch {
      // gone while reading
    }
  }
  return { files, times };
}

function writeWhole(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  try {
    renameSync(tmp, path);
  } catch {
    writeFileSync(path, data);
    rmSync(tmp, { force: true });
  }
}

const same = (a: Buffer | undefined, b: Buffer | undefined) => (a === undefined || b === undefined ? a === b : a.equals(b));

// ---- one round ---------------------------------------------------------------------------------

interface Round {
  offline: boolean;
  changed: boolean;
  pushed: boolean;
  rejected: boolean;
  pending: number;
  conflicts: StoredConflict[];
  problem?: string;
}

/** The remote branch to use: main, else the only one there is. */
function pickBranch(refs: Map<string, string>): string {
  if (refs.has("main")) return "main";
  const names = [...refs.keys()];
  return names.length === 1 ? names[0]! : "main";
}

async function remoteRefs(g: (args: string[]) => Promise<string>): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  const out = await g(["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/remotes/origin"]).catch(() => "");
  for (const line of out.split("\n")) {
    const m = /^origin\/(\S+) ([0-9a-f]+)$/.exec(line.trim());
    if (m && m[1] !== "HEAD") refs.set(m[1]!, m[2]!);
  }
  return refs;
}

async function oneRound(deps: SyncDeps, talk: boolean, host: string, now: () => number): Promise<Round> {
  const run = deps.run ?? realRun;
  const plansDir = deps.plansDir;
  const g = (args: string[]) => run("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], plansDir);
  const globalFile = deps.globalFile ?? join(dirname(deps.settingsFile), GLOBAL_NAME);
  const at = new Date(now()).toISOString();

  // Every project, by key (two folders with the same key: the first one is used).
  const byKey = new Map<string, string>();
  for (const root of deps.projects) {
    const key = syncKey(root, { links: deps.linksFile, remote: deps.remote });
    if (!byKey.has(key)) byKey.set(key, root);
  }
  const keyDir = (key: string) => join(plansDir, ...key.split("/"));

  // BASE: the clone as it was when this computer last agreed with the repo.
  const before = await remoteRefs(g);
  const guess = pickBranch(before);
  const baseSha = before.get(guess);
  if (baseSha) {
    await g(["reset", "--hard", "-q", baseSha]);
  } else {
    await g(["rm", "-r", "-f", "-q", "--ignore-unmatch", "."]).catch(() => "");
  }
  await g(["clean", "-f", "-d", "-q"]).catch(() => "");
  const base = new Map<string, Files>();
  for (const key of byKey.keys()) base.set(key, collect(keyDir(key), talk).files);
  const cloneGlobal = (): Buffer | undefined => {
    const f = join(keyDir(GLOBAL_KEY), GLOBAL_NAME);
    return existsSync(f) ? readFileSync(f) : undefined;
  };
  const globalBase = cloneGlobal();

  // THEIRS: the repo as it is now, if it can be reached.
  let offline = false;
  try {
    await g(["fetch", "--quiet", "origin"]);
  } catch {
    offline = true;
  }
  let branch = guess;
  let theirsSha: string | undefined;
  if (!offline) {
    const after = await remoteRefs(g);
    branch = pickBranch(after);
    theirsSha = after.get(branch);
    if (theirsSha && theirsSha !== baseSha) await g(["reset", "--hard", "-q", theirsSha]);
  }
  const globalTheirs = cloneGlobal();
  const theirs = new Map<string, Files>();
  for (const key of base.keys()) theirs.set(key, theirsSha && theirsSha !== baseSha ? collect(keyDir(key), talk).files : base.get(key)!);
  const theirTime = new Map<string, number>();
  const timeOfTheirs = async (key: string, rel: string): Promise<number | undefined> => {
    const id = `${key}/${rel}`;
    if (theirTime.has(id)) return theirTime.get(id);
    const out = await g(["log", "-1", "--format=%ct", theirsSha!, "--", id]).catch(() => "");
    const t = Number(out.trim()) * 1000;
    if (t > 0) theirTime.set(id, t);
    return t > 0 ? t : undefined;
  };

  /** Merges one folder's three versions; the clone's folder is then made to match and the project's is returned. */
  const conflicts: StoredConflict[] = [];
  async function merge(key: string, label: string, ours: Files, oursTimes: Map<string, number>): Promise<Files> {
    const b = base.get(key)!;
    const t = theirs.get(key)!;
    const out: Files = new Map();
    const both = new Map<string, true>();
    const textB = new Map<string, string>();
    const textO = new Map<string, string>();
    const textT = new Map<string, string>();
    for (const rel of [...new Set([...ours.keys(), ...t.keys()])].sort()) {
      const o = ours.get(rel);
      const th = t.get(rel);
      const bb = b.get(rel);
      if (same(o, th)) {
        if (o) out.set(rel, o);
      } else if (same(o, bb)) {
        if (th) out.set(rel, th); // only they changed it (or deleted it)
      } else if (same(th, bb)) {
        if (o) out.set(rel, o); // only we changed it (or deleted it)
      } else if (o && th && isText(rel)) {
        both.set(rel, true);
        textO.set(rel, o.toString("utf8"));
        textT.set(rel, th.toString("utf8"));
        if (bb) textB.set(rel, bb.toString("utf8"));
      } else if (o && th) {
        // two different versions of a message or picture: the newer file wins
        const tt = await timeOfTheirs(key, rel);
        const keepOurs = (oursTimes.get(rel) ?? 0) >= (tt ?? 0);
        out.set(rel, keepOurs ? o : th);
        conflicts.push({ file: rel, section: "", id: "", kept: keepOurs ? "ours" : "theirs", lost: "", project: label, host, at });
      } else {
        // deleted on one side and changed on the other: keep the changed one
        const kept = o ?? th!;
        out.set(rel, kept);
        conflicts.push({ file: rel, section: "", id: "", kept: o ? "ours" : "theirs", lost: "", project: label, host, at });
      }
    }
    if (both.size) {
      const oursTimesMap = new Map<string, number>();
      const theirsTimes = new Map<string, number>();
      for (const rel of both.keys()) {
        oursTimesMap.set(rel, oursTimes.get(rel) ?? 0);
        const tt = await timeOfTheirs(key, rel);
        if (tt !== undefined) theirsTimes.set(rel, tt);
      }
      const merged = mergePlanFolder(textB, textO, textT, { oursTimes: oursTimesMap, theirsTimes });
      for (const [rel, text] of merged.files) out.set(rel, Buffer.from(text, "utf8"));
      for (const c of merged.conflicts) conflicts.push({ file: c.file, section: c.section, id: c.id, kept: c.kept, lost: c.lost, project: label, host, at });
    }
    // make the clone's folder match
    const dir = keyDir(key);
    const have = collect(dir, talk).files;
    for (const rel of have.keys()) if (!out.has(rel)) rmSync(join(dir, rel), { force: true });
    for (const [rel, data] of out) if (!same(have.get(rel), data)) writeWhole(join(dir, rel), data);
    return out;
  }

  let changedProject = false;
  for (const [key, root] of byKey) {
    const plan = join(root, PROGRESSOR_DIR);
    const local = collect(plan, talk);
    if (!local.files.size && !(theirs.get(key)!.size)) continue;
    const out = await merge(key, key, local.files, local.times);
    const writes = [...out].filter(([rel, data]) => !same(local.files.get(rel), data));
    const deletes = [...local.files.keys()].filter((rel) => !out.has(rel));
    if (writes.length || deletes.length) {
      changedProject = true;
      withLock(root, () => {
        for (const [rel, data] of writes) writeWhole(join(plan, ...rel.split("/")), data);
        for (const rel of deletes) rmSync(join(plan, ...rel.split("/")), { force: true });
      });
    }
  }

  // The rules for every project: one file, so whichever side changed it wins; both changed, the newer wins.
  {
    const ours: Files = new Map();
    const times = new Map<string, number>();
    if (existsSync(globalFile)) {
      ours.set(GLOBAL_NAME, readFileSync(globalFile));
      times.set(GLOBAL_NAME, statSync(globalFile).mtimeMs);
    }
    const dir = keyDir(GLOBAL_KEY);
    // the rules file is not a plan file: compare it whole
    const o = ours.get(GLOBAL_NAME);
    const t = globalTheirs;
    const b = globalBase;
    let result = o;
    if (!same(o, t)) {
      if (same(o, b)) result = t;
      else if (same(t, b)) result = o;
      else {
        const tt = (await timeOfTheirs(GLOBAL_KEY, GLOBAL_NAME)) ?? 0;
        result = (times.get(GLOBAL_NAME) ?? 0) >= tt ? o : t;
      }
    }
    const have = cloneGlobal();
    if (result && !same(have, result)) writeWhole(join(dir, GLOBAL_NAME), result);
    if (!result && have) rmSync(join(dir, GLOBAL_NAME), { force: true });
    if (result && !same(o, result)) {
      changedProject = true;
      writeWhole(globalFile, result);
    }
  }

  // Commit what changed in the clone.
  let committed = false;
  await g(["add", "-A"]);
  if ((await g(["status", "--porcelain"])).trim()) {
    await g(["-c", "user.name=Progressor", "-c", "user.email=progressor@localhost", "commit", "-q", "-m", `Sync from ${host}`]);
    committed = true;
  }

  // Push, unless offline.
  const unpushed = async (): Promise<number> => {
    const range = theirsSha || before.get(branch) ? `origin/${branch}..HEAD` : "HEAD";
    const n = await g(["rev-list", "--count", range]).catch(() => "0");
    return Number(n.trim()) || 0;
  };
  let pushed = false;
  let rejected = false;
  let problem: string | undefined;
  let pending = await unpushed();
  if (offline) problem = OFFLINE;
  else if (pending > 0) {
    try {
      await g(["push", "--quiet", "origin", `HEAD:${branch}`]);
      pushed = true;
      pending = 0;
    } catch {
      rejected = true;
      problem = "Couldn't upload your plan changes just now; Progressor will try again shortly.";
    }
  }
  return { offline, changed: committed || changedProject, pushed, rejected, pending, conflicts, problem };
}

// ---- the round, with its lock, retry and state file ----------------------------------------------

const turns = new Map<string, Promise<unknown>>();

/** One sync round. Rounds in one process take turns, and so do processes (the plans folder is locked). */
export function syncOnce(deps: SyncDeps): Promise<SyncResult> {
  const next = (turns.get(deps.plansDir) ?? Promise.resolve()).then(() => round(deps));
  turns.set(deps.plansDir, next.catch(() => undefined));
  return next;
}

async function round(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? Date.now;
  const stateFile = deps.stateFile ?? syncStateFileFor(deps.settingsFile);
  const prior = readSyncState(stateFile);
  const attemptAt = new Date(now()).toISOString();
  const settings = readSettings(deps.settingsFile).sync;
  const finish = (r: SyncResult, pending: number, conflicts: StoredConflict[]): SyncResult => {
    writeState(stateFile, {
      lastSync: r.ok ? attemptAt : prior.lastSync,
      lastAttempt: attemptAt,
      ok: r.ok,
      problem: r.problem,
      offline: r.offline,
      pending,
      conflicts: [...prior.conflicts, ...conflicts].slice(-KEEP_CONFLICTS),
    });
    return r;
  };
  if (!settings.enabled || !existsSync(join(deps.plansDir, ".git"))) {
    return finish({ ok: false, offline: false, changed: false, pushed: false, conflicts: 0, problem: NOT_SET_UP }, prior.pending, []);
  }
  const host = deps.host || hostname();
  try {
    const last = await withLockAsync(
      deps.plansDir,
      async () => {
        let r = await oneRound(deps, settings.talk, host, now);
        const found = [...r.conflicts];
        const seen = new Set(found.map((c) => `${c.project}|${c.file}|${c.section}|${c.id}|${c.lost}`));
        let changed = r.changed;
        if (r.rejected) {
          // another computer pushed between our fetch and our push: merge with what it pushed and try once more
          r = await oneRound(deps, settings.talk, host, now);
          found.push(...r.conflicts.filter((c) => !seen.has(`${c.project}|${c.file}|${c.section}|${c.id}|${c.lost}`)));
          changed ||= r.changed;
        }
        return { ...r, conflicts: found, changed };
      },
      { timeoutMs: 120_000, staleMs: 600_000 },
    );
    const result: SyncResult = {
      ok: !last.problem,
      offline: last.offline,
      changed: last.changed,
      pushed: last.pushed,
      conflicts: last.conflicts.length,
      problem: last.problem,
    };
    return finish(result, last.pending, last.conflicts);
  } catch (e) {
    const problem = `Plan sync hit a problem and will try again shortly: ${(e as Error).message}`;
    return finish({ ok: false, offline: false, changed: false, pushed: false, conflicts: 0, problem }, prior.pending, []);
  }
}

// ---- in the background ---------------------------------------------------------------------------

export interface BackgroundOptions extends Omit<SyncDeps, "projects" | "host"> {
  projects: () => string[];
  host?: string;
  /** How long after the last plan change to sync (default 5 s). */
  debounceMs?: number;
  /** How often to look for other computers' changes (default 5 minutes). */
  everyMs?: number;
  onRound?: (result: SyncResult) => void;
}

export interface Background {
  /** A plan changed: sync soon. */
  changed(): void;
  /** Syncs now, without waiting for the quiet moment. */
  now(): Promise<void>;
  /** Resolves when no round is running or waiting. */
  idle(): Promise<void>;
  stop(): void;
}

export function startBackgroundSync(options: BackgroundOptions): Background {
  const debounceMs = options.debounceMs ?? 5000;
  const everyMs = options.everyMs ?? 5 * 60_000;
  let stopped = false;
  let debounce: NodeJS.Timeout | undefined;
  let inflight: Promise<void> = Promise.resolve();

  const go = (): Promise<void> => {
    inflight = inflight.then(async () => {
      if (stopped) return;
      try {
        // settings are read each round, so `sync off` and `sync connect` take effect with no restart
        if (!readSettings(options.settingsFile).sync.enabled) return;
        const result = await syncOnce({ ...options, host: options.host ?? hostname(), projects: options.projects() });
        options.onRound?.(result);
      } catch {
        // never into the hub; syncOnce has already put the problem in the state file
      }
    });
    return inflight;
  };

  const every = setInterval(() => void go(), everyMs);
  every.unref();
  void go();

  return {
    changed() {
      if (stopped) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void go(), debounceMs);
      debounce.unref();
    },
    now: () => go(),
    idle: async () => {
      let seen: Promise<void>;
      do {
        seen = inflight;
        await seen;
      } while (seen !== inflight);
    },
    stop() {
      stopped = true;
      clearInterval(every);
      clearTimeout(debounce);
    },
  };
}
