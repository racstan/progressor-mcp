// What git can say about a step's work: the commits made since it started (for its files), whether its
// files still have changes not saved in git, the branch, and where a commit can be seen online.
//
// It only ever reads, each command with a short timeout. If git is missing, slow, or the folder is not
// a repository, every question answers undefined instead of failing, so finishing a step never breaks.
import { execFileSync } from "node:child_process";

const GIT_TIMEOUT_MS = 2000;
/** At most this many commits are recorded on a step: the newest. */
const MAX_COMMITS = 10;

export interface GitFacts {
  /** Short hashes of the commits since `since` (an ISO time), newest first, touching `files` when some are given. */
  commitsSince(root: string, since: string | undefined, files: string[]): string[] | undefined;
  /** Whether any of `files` (the whole working tree when none) has changes not committed. */
  dirty(root: string, files: string[]): boolean | undefined;
  branch(root: string): string | undefined;
  /** The web address a short hash is added to, to see that commit; undefined without a known remote. */
  commitLink(root: string): string | undefined;
}

function run(root: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: root,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    }).toString();
  } catch {
    return undefined;
  }
}

/** A step's files as git pathspecs: `src/a.ts:12` → `src/a.ts`; the plan folder itself never counts. */
function pathspecs(files: string[]): string[] {
  return files
    .map((f) => f.replace(/:\d+(?:-\d+)?$/, "").trim())
    .filter((f) => f && !/^\.progressor(?:[\\/]|$)/.test(f));
}

/**
 * Where to see a commit of a repository with this remote: `<base><hash>`. GitHub, GitLab and Gitea
 * remotes, in https or ssh form; anything else has no link. A password in the remote never shows.
 */
export function commitLinkBase(remote: string): string | undefined {
  const url = remote.trim();
  let host: string;
  let path: string;
  let scheme = "https";
  const scp = /^[\w.-]+@([\w.-]+):(?!\/)(.+)$/.exec(url);
  if (scp) {
    host = scp[1]!;
    path = scp[2]!;
  } else {
    try {
      const u = new URL(url);
      if (!["http:", "https:", "ssh:", "git:"].includes(u.protocol) || !u.hostname) return undefined;
      host = u.protocol === "ssh:" || u.protocol === "git:" ? u.hostname : u.host;
      scheme = u.protocol === "http:" ? "http" : "https";
      path = u.pathname.replace(/^\/+/, "");
    } catch {
      return undefined;
    }
  }
  path = path.replace(/\.git\/?$/, "").replace(/\/+$/, "");
  if (!path.includes("/")) return undefined;
  const gitlab = /(^|\.)gitlab\./i.test(host);
  return `${scheme}://${host}/${path}/${gitlab ? "-/" : ""}commit/`;
}

export const realGit: GitFacts = {
  commitsSince(root, since, files) {
    if (!since) return undefined;
    const specs = pathspecs(files);
    const out = run(root, ["log", `--since=${since}`, `--max-count=${MAX_COMMITS}`, "--format=%h", "--abbrev=7", ...(specs.length ? ["--", ...specs] : [])]);
    return out === undefined ? undefined : out.split("\n").filter(Boolean);
  },
  dirty(root, files) {
    const specs = pathspecs(files);
    if (files.length > 0 && specs.length === 0) return false;
    const out = run(root, ["status", "--porcelain", ...(specs.length ? ["--", ...specs] : [])]);
    return out === undefined ? undefined : out.trim().length > 0;
  },
  branch(root) {
    const out = run(root, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim();
    return out && out !== "HEAD" ? out : undefined;
  },
  commitLink(root) {
    const out = run(root, ["remote", "get-url", "origin"])?.trim();
    return out ? commitLinkBase(out) : undefined;
  },
};
