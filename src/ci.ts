// Pull requests and CI checks for the commits a step was finished with (Task.commits, gitFacts.ts).
//
// GitHub is asked through the `gh` command (its own login); any other git host is taken to be Gitea
// and asked through its web API, with the token in GITEA_TOKEN when there is one. What comes back is
// kept in a small file per project beside the project list (~/.progressor/ci/), never in the plan, and
// the dashboard shows that file at once while a refresh runs in the background.
//
// Everything degrades silently: no remote, no gh, not logged in, no network or an answer that cannot
// be read just means nothing is shown. Commands and web requests come in through `CiDeps`, so tests
// never touch git, gh or the network.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** What a run of CI checks came to. */
export type Checks = "passed" | "failed" | "running";

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  state: "open" | "merged" | "closed";
  /** The branch it would merge. */
  branch?: string;
  /** The commit at its tip, whose checks are its checks. */
  headSha?: string;
  checks?: Checks;
}

/** What is known about one commit, or one branch (whose `checks` are never set). */
export interface CiEntry {
  /** When it was last asked, in ms since 1970. */
  at: number;
  prs: PullRequest[];
  /** The commit's own checks. */
  checks?: Checks;
}

export interface CiCache {
  /** By short hash, as the plan keeps it. */
  commits: Record<string, CiEntry>;
  /** By branch name. */
  branches: Record<string, CiEntry>;
}

/** A git host's repository a remote points at. `base` is where its web pages are (no password). */
export interface Repo {
  kind: "github" | "gitea";
  host: string;
  owner: string;
  repo: string;
  base: string;
}

/** How commands are run and web pages fetched; tests pass their own. */
export interface CiDeps {
  /** Runs a command in `cwd`; its output, or undefined when it failed or is missing. */
  run(cmd: string, args: string[], cwd: string): Promise<string | undefined>;
  /** GETs JSON; undefined when there was no answer at all. */
  fetchJson(url: string, headers: Record<string, string>): Promise<{ status: number; body?: unknown } | undefined>;
  /** The Gitea token (GITEA_TOKEN), sent only to Gitea hosts. */
  token?: string | undefined;
  now(): number;
}

/** The part of a step this needs (planFile.ts Task). */
export interface CiTask {
  id: string;
  status: string;
  commits?: string[] | undefined;
  branch?: string | undefined;
  finishedAt?: string | undefined;
}

/** What a step shows: its pull requests and the checks that matter for it. */
export interface StepCi {
  prs: PullRequest[];
  checks?: Checks;
}

/** What a goal shows: every pull request of its steps, its latest checks, and each step's. */
export interface GoalCi {
  prs: PullRequest[];
  checks?: Checks;
  steps: Record<string, StepCi>;
}

/** An entry is asked again after this long… */
export const FRESH_MS = 5 * 60_000;
/** …or this long once settled: its pull requests all merged or closed, and nothing running. */
export const SETTLED_MS = 6 * 60 * 60_000;
/** At most this many steps are followed: the most recently finished. */
const MAX_STEPS = 30;
/** At most this many are asked in one refresh; the rest wait for the next. */
const MAX_PER_REFRESH = 15;
/** Entries not asked for this long are dropped from the file. */
const FORGET_MS = 30 * 24 * 60 * 60_000;

// --- reading answers ------------------------------------------------------------------------------

/** Hosts that are neither GitHub nor Gitea: never asked, and never sent the Gitea token. */
const OTHER_HOSTS = /(^|\.)(gitlab\.[\w.]+|bitbucket\.org|dev\.azure\.com|visualstudio\.com|sr\.ht)$/i;

function repoOf(url: string): Repo | undefined {
  let host: string;
  let scheme = "https";
  let path: string;
  const scp = /^[\w.-]+@([\w.-]+):(?!\/)(.+)$/.exec(url);
  if (scp) {
    host = scp[1]!;
    path = scp[2]!;
  } else {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return undefined;
    }
    if (!["http:", "https:", "ssh:", "git:"].includes(u.protocol) || !u.hostname) return undefined;
    host = u.protocol === "ssh:" || u.protocol === "git:" ? u.hostname : u.host;
    if (u.protocol === "http:") scheme = "http";
    path = u.pathname;
  }
  const parts = path.replace(/\.git\/?$/, "").split("/").filter(Boolean);
  if (parts.length < 2) return undefined;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (OTHER_HOSTS.test(hostname)) return undefined;
  const owner = parts[parts.length - 2]!;
  const repo = parts[parts.length - 1]!;
  if (hostname === "github.com") return { kind: "github", host: "github.com", owner, repo, base: "https://github.com" };
  const prefix = parts.slice(0, -2).join("/");
  return { kind: "gitea", host, owner, repo, base: `${scheme}://${host}${prefix ? `/${prefix}` : ""}` };
}

/** The GitHub and Gitea repositories in `git remote -v`, once each. */
export function parseRemotes(text: string): Repo[] {
  const seen = new Set<string>();
  const out: Repo[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\S+\s+(\S+)/.exec(line.trim());
    const repo = m ? repoOf(m[1]!) : undefined;
    if (!repo) continue;
    const key = `${repo.kind} ${repo.base} ${repo.owner}/${repo.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(repo);
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** GitHub's or Gitea's pull requests (a list, or Gitea's one), in their shared shape. */
export function parsePulls(json: unknown): PullRequest[] {
  const list = Array.isArray(json) ? json : isObject(json) ? [json] : [];
  return list.flatMap((p): PullRequest[] => {
    if (!isObject(p) || typeof p.number !== "number" || typeof p.html_url !== "string" || !/^https?:\/\//.test(p.html_url)) return [];
    const merged = p.merged === true || (typeof p.merged_at === "string" && p.merged_at !== "");
    const head = isObject(p.head) ? p.head : {};
    return [
      {
        number: p.number,
        title: typeof p.title === "string" ? p.title : "",
        url: p.html_url,
        state: merged ? "merged" : p.state === "open" ? "open" : "closed",
        ...(typeof head.ref === "string" ? { branch: head.ref } : {}),
        ...(typeof head.sha === "string" ? { headSha: head.sha } : {}),
      },
    ];
  });
}

/** Any failure fails; otherwise anything still running runs; otherwise passed; nothing known is undefined. */
export function summariseChecks(list: readonly (Checks | undefined)[]): Checks | undefined {
  if (list.includes("failed")) return "failed";
  if (list.includes("running")) return "running";
  if (list.includes("passed")) return "passed";
  return undefined;
}

const FAILED_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
const PASSED_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);

/** GitHub's check runs for a commit. A cancelled or stale run counts for nothing. */
export function checksFromCheckRuns(json: unknown): Checks | undefined {
  if (!isObject(json) || !Array.isArray(json.check_runs)) return undefined;
  return summariseChecks(
    json.check_runs.map((r: unknown): Checks | undefined => {
      if (!isObject(r)) return undefined;
      if (r.status !== "completed") return "running";
      const c = String(r.conclusion);
      return FAILED_CONCLUSIONS.has(c) ? "failed" : PASSED_CONCLUSIONS.has(c) ? "passed" : undefined;
    }),
  );
}

/** A commit status: GitHub's combined status, or Gitea's. Nothing reported is undefined. */
export function checksFromStatus(json: unknown): Checks | undefined {
  if (!isObject(json)) return undefined;
  const count = typeof json.total_count === "number" ? json.total_count : Array.isArray(json.statuses) ? json.statuses.length : undefined;
  if (count === 0) return undefined;
  switch (json.state) {
    case "success":
    case "warning":
      return "passed";
    case "failure":
    case "error":
      return "failed";
    case "pending":
      return "running";
    default:
      return undefined;
  }
}

// --- what is kept, and when to ask again ----------------------------------------------------------

/** Whether an entry was asked recently enough. */
export function isFresh(entry: CiEntry | undefined, now: number): boolean {
  if (!entry) return false;
  const settled = entry.prs.length > 0 && entry.prs.every((p) => p.state !== "open" && p.checks !== "running") && entry.checks !== "running";
  return now - entry.at < (settled ? SETTLED_MS : FRESH_MS);
}

/** `<dir of the project list>/ci/<hash of the project folder>.json`. */
export function ciCacheFile(registryFile: string, root: string): string {
  const id = createHash("sha256").update(root.replace(/\\/g, "/").toLowerCase()).digest("hex").slice(0, 16);
  return join(dirname(registryFile), "ci", `${id}.json`);
}

function entries(v: unknown): Record<string, CiEntry> {
  if (!isObject(v)) return {};
  const out: Record<string, CiEntry> = {};
  for (const [k, e] of Object.entries(v)) {
    if (isObject(e) && typeof e.at === "number" && Array.isArray(e.prs)) out[k] = e as unknown as CiEntry;
  }
  return out;
}

/** The kept answers; empty when the file is missing or cannot be read. */
export function readCiCache(file: string): CiCache {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (!isObject(data)) return { commits: {}, branches: {} };
    return { commits: entries(data.commits), branches: entries(data.branches) };
  } catch {
    return { commits: {}, branches: {} };
  }
}

function writeCiCache(file: string, cache: CiCache, now: number): void {
  const keep = (r: Record<string, CiEntry>) => Object.fromEntries(Object.entries(r).filter(([, e]) => now - e.at < FORGET_MS));
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ commits: keep(cache.commits), branches: keep(cache.branches) }, null, 1));
    renameSync(tmp, file);
  } catch {
    // a file that cannot be written just means asking again next time
  }
}

// --- which commits to ask about -------------------------------------------------------------------

const SAFE_SHA = /^[0-9a-f]{4,40}$/i;
const SAFE_BRANCH = /^[\w./-]+$/;
/** Branches whose pull requests are not a step's own. */
const TRUNKS = new Set(["main", "master", "trunk", "develop", "HEAD"]);

export interface Lookup {
  sha: string;
  branch?: string;
}

const finishedTime = (t: CiTask) => (t.finishedAt ? Date.parse(t.finishedAt) || 0 : 0);

/** The newest commit (and branch) of each of the most recently finished steps that have commits. */
export function stepLookups(tasks: readonly CiTask[]): Lookup[] {
  return tasks
    .filter((t) => t.commits?.length && SAFE_SHA.test(t.commits[0]!))
    .sort((a, b) => finishedTime(b) - finishedTime(a))
    .slice(0, MAX_STEPS)
    .map((t) => {
      const branch = t.branch && SAFE_BRANCH.test(t.branch) && !t.branch.startsWith("-") && !TRUNKS.has(t.branch) ? t.branch : undefined;
      return { sha: t.commits![0]!, ...(branch ? { branch } : {}) };
    });
}

// --- what a step and a goal show ------------------------------------------------------------------

function unique(prs: PullRequest[]): PullRequest[] {
  const seen = new Set<string>();
  return prs.filter((p) => !seen.has(p.url) && !!seen.add(p.url));
}

/** A step's pull requests and checks: an open pull request's first, else its commit's own, else any pull request's. */
export function stepCi(task: CiTask, cache: CiCache): StepCi | undefined {
  const sha = task.commits?.[0];
  const commit = sha ? cache.commits[sha] : undefined;
  const branch = task.branch ? cache.branches[task.branch] : undefined;
  if (!commit && !branch) return undefined;
  const prs = unique([...(commit?.prs ?? []), ...(branch?.prs ?? [])]);
  const checks =
    summariseChecks(prs.filter((p) => p.state === "open").map((p) => p.checks)) ?? commit?.checks ?? summariseChecks(prs.map((p) => p.checks));
  if (prs.length === 0 && !checks) return commit ? { prs } : undefined;
  return { prs, ...(checks ? { checks } : {}) };
}

/** A goal's pull requests (each once), its steps', and the checks of its most recently finished step that has some. */
export function goalCi(tasks: readonly CiTask[], cache: CiCache): GoalCi {
  const steps: Record<string, StepCi> = {};
  for (const t of tasks) {
    const s = stepCi(t, cache);
    if (s && (s.prs.length > 0 || s.checks)) steps[t.id] = s;
  }
  const prs = unique(Object.values(steps).flatMap((s) => s.prs));
  const latest = tasks
    .filter((t) => steps[t.id]?.checks)
    .sort((a, b) => finishedTime(b) - finishedTime(a))[0];
  const checks = latest ? steps[latest.id]!.checks : undefined;
  return { prs, ...(checks ? { checks } : {}), steps };
}

const OPEN_GOALS = new Set(["planned", "active", "paused", "testing"]);

/** The open goals whose latest checks failed: for Needs you. */
export function failedGoals(goals: readonly { id: string; title: string; status: string; tasks: readonly CiTask[] }[], cache: CiCache): { id: string; title: string }[] {
  return goals.filter((g) => OPEN_GOALS.has(g.status) && goalCi(g.tasks, cache).checks === "failed").map(({ id, title }) => ({ id, title }));
}

// --- asking the hosts -----------------------------------------------------------------------------

interface Answer {
  prs: PullRequest[];
  checks?: Checks | undefined;
}

interface Forge {
  /** The pull requests holding a commit; undefined when the host could not say. */
  prsFor(sha: string): Promise<PullRequest[] | undefined>;
  prsOnBranch(branch: string): Promise<PullRequest[] | undefined>;
  checksOf(sha: string): Promise<Checks | undefined>;
}

const parse = (text: string | undefined): unknown => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

function github(repo: Repo, deps: CiDeps, root: string): Forge {
  const api = async (path: string) => parse(await deps.run("gh", ["api", path], root));
  const at = `repos/${repo.owner}/${repo.repo}`;
  const pulls = async (path: string) => {
    const json = await api(path);
    return Array.isArray(json) ? parsePulls(json) : undefined;
  };
  return {
    prsFor: (sha) => pulls(`${at}/commits/${sha}/pulls`),
    prsOnBranch: (branch) => pulls(`${at}/pulls?state=all&head=${encodeURIComponent(`${repo.owner}:${branch}`)}&per_page=20`),
    async checksOf(sha) {
      const [runs, status] = await Promise.all([api(`${at}/commits/${sha}/check-runs`), api(`${at}/commits/${sha}/status`)]);
      return summariseChecks([checksFromCheckRuns(runs), checksFromStatus(status)]);
    },
  };
}

function gitea(repo: Repo, deps: CiDeps): Forge {
  const api = `${repo.base}/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const headers: Record<string, string> = { Accept: "application/json", ...(deps.token ? { Authorization: `token ${deps.token}` } : {}) };
  const get = (path: string) => deps.fetchJson(`${api}${path}`, headers).catch(() => undefined);
  let all: Promise<PullRequest[] | undefined> | undefined;
  return {
    async prsFor(sha) {
      const a = await get(`/commits/${sha}/pull`);
      if (a?.status === 404) return [];
      return a && a.status >= 200 && a.status < 300 ? parsePulls(a.body) : undefined;
    },
    async prsOnBranch(branch) {
      all ??= get("/pulls?state=all&limit=50").then((a) => (a && a.status >= 200 && a.status < 300 && Array.isArray(a.body) ? parsePulls(a.body) : undefined));
      return (await all)?.filter((p) => p.branch === branch);
    },
    async checksOf(sha) {
      const a = await get(`/commits/${sha}/status`);
      return a && a.status >= 200 && a.status < 300 ? checksFromStatus(a.body) : undefined;
    },
  };
}

/** Each forge's answer joined: undefined when none could say anything. */
async function ask(forges: Forge[], q: (f: Forge) => Promise<PullRequest[] | undefined>): Promise<PullRequest[] | undefined> {
  const answers = await Promise.all(forges.map((f) => q(f).catch(() => undefined)));
  const known = answers.filter((a): a is PullRequest[] => a !== undefined);
  return known.length ? unique(known.flat()) : undefined;
}

/**
 * Asks the project's git hosts about the steps' commits and branches that are not fresh, and keeps
 * the answers in `file`. True when something was kept.
 */
export async function refreshCi(root: string, lookups: readonly Lookup[], deps: CiDeps, file: string): Promise<boolean> {
  const cache = readCiCache(file);
  const now = deps.now();
  const stale = lookups.filter((l) => !isFresh(cache.commits[l.sha], now) || (l.branch && !isFresh(cache.branches[l.branch], now))).slice(0, MAX_PER_REFRESH);
  if (stale.length === 0) return false;
  const remotes = parseRemotes((await deps.run("git", ["remote", "-v"], root)) ?? "");
  if (remotes.length === 0) return false;
  const forges = remotes.map((r) => (r.kind === "github" ? github(r, deps, root) : gitea(r, deps)));
  const checksMemo = new Map<string, Promise<Checks | undefined>>();
  const checksOf = (sha: string) => {
    let p = checksMemo.get(sha);
    if (!p) {
      p = Promise.all(forges.map((f) => f.checksOf(sha).catch(() => undefined))).then(summariseChecks);
      checksMemo.set(sha, p);
    }
    return p;
  };
  const withChecks = async (prs: PullRequest[]) =>
    Promise.all(
      prs.map(async (p) => {
        const checks = p.headSha && SAFE_SHA.test(p.headSha) ? await checksOf(p.headSha) : undefined;
        return checks ? { ...p, checks } : p;
      }),
    );
  let changed = false;
  for (const l of stale) {
    if (!isFresh(cache.commits[l.sha], now)) {
      const full = (await deps.run("git", ["rev-parse", `${l.sha}^{commit}`], root))?.trim();
      const sha = full && SAFE_SHA.test(full) ? full : l.sha;
      const prs = await ask(forges, (f) => f.prsFor(sha));
      if (prs !== undefined) {
        const checks = await checksOf(sha);
        const answer: Answer = { prs: await withChecks(prs), checks };
        cache.commits[l.sha] = { at: now, prs: answer.prs, ...(answer.checks ? { checks: answer.checks } : {}) };
        changed = true;
      }
    }
    if (l.branch && !isFresh(cache.branches[l.branch], now)) {
      const branch = l.branch;
      const prs = await ask(forges, (f) => f.prsOnBranch(branch));
      if (prs !== undefined) {
        cache.branches[branch] = { at: now, prs: await withChecks(prs) };
        changed = true;
      }
    }
  }
  if (changed) writeCiCache(file, cache, now);
  return changed;
}

/** When each project's file was last refreshed, and whether a refresh is running now. */
const tried = new Map<string, { at: number; running: boolean }>();

/**
 * Starts a refresh in the background unless one is running for this file or started in the last few
 * minutes, or everything is fresh. `changed` is called when it kept something new. Returns the
 * running refresh, or undefined when none was started.
 */
export function kickCiRefresh(root: string, tasks: () => readonly CiTask[], file: string, deps: CiDeps, changed: () => void): Promise<void> | undefined {
  const now = deps.now();
  const last = tried.get(file);
  if (last && (last.running || now - last.at < FRESH_MS)) return undefined;
  let lookups: Lookup[];
  try {
    lookups = stepLookups(tasks());
  } catch {
    return undefined;
  }
  const cache = readCiCache(file);
  if (!lookups.some((l) => !isFresh(cache.commits[l.sha], now) || (l.branch && !isFresh(cache.branches[l.branch], now)))) return undefined;
  const entry = { at: now, running: true };
  tried.set(file, entry);
  return refreshCi(root, lookups, deps, file)
    .then((did) => {
      if (did) changed();
    })
    .catch(() => undefined)
    .finally(() => {
      entry.running = false;
    });
}

// --- the real commands and network ----------------------------------------------------------------

const COMMAND_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 8_000;

export const realCiDeps = (): CiDeps => ({
  run: (cmd, args, cwd) =>
    new Promise((resolve) => {
      try {
        execFile(
          cmd,
          args,
          {
            cwd,
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true,
            env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", NO_COLOR: "1" },
          },
          (err, stdout) => resolve(err ? undefined : String(stdout)),
        );
      } catch {
        resolve(undefined);
      }
    }),
  async fetchJson(url, headers) {
    if (!/^https?:\/\//.test(url)) return undefined;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error" });
      const body = res.ok ? ((await res.json().catch(() => undefined)) as unknown) : undefined;
      return { status: res.status, body };
    } catch {
      return undefined;
    }
  },
  token: process.env.GITEA_TOKEN || undefined,
  now: () => Date.now(),
});
