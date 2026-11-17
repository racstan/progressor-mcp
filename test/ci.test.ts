import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type CiCache,
  type CiDeps,
  type CiTask,
  checksFromCheckRuns,
  checksFromStatus,
  ciCacheFile,
  failedGoals,
  goalCi,
  isFresh,
  kickCiRefresh,
  parsePulls,
  parseRemotes,
  readCiCache,
  refreshCi,
  stepCi,
  stepLookups,
  summariseChecks,
} from "../src/ci.js";
import { CHECKS_WORDS, pullRequestHint, pullRequestLabel } from "../src/ui/words.js";

describe("what the page says", () => {
  it("names checks and pull requests in plain English", () => {
    expect(CHECKS_WORDS).toEqual({ passed: "Checks passed", failed: "Checks failed", running: "Checks running" });
    expect(pullRequestLabel({ number: 12, state: "open" })).toBe("Pull request #12");
    expect(pullRequestLabel({ number: 12, state: "merged" })).toBe("Pull request #12, merged");
    expect(pullRequestLabel({ number: 3, state: "closed" })).toBe("Pull request #3, closed");
    expect(pullRequestHint({ title: "Add login", state: "closed" })).toBe("Add login\nClosed without merging. Opens the pull request on your git host's website.");
  });
});

describe("parseRemotes", () => {
  it("finds GitHub and Gitea repositories in git remote -v, once each", () => {
    const text = [
      "origin\thttps://github.com/me/app.git (fetch)",
      "origin\thttps://github.com/me/app.git (push)",
      "gitea\thttp://root:secret@gitea.local:3030/root/App.git (fetch)",
      "gitea\thttp://root:secret@gitea.local:3030/root/App.git (push)",
      "lab\tgit@gitlab.com:me/app.git (fetch)",
      "ssh\tgit@github.com:me/other.git (fetch)",
    ].join("\n");
    expect(parseRemotes(text)).toEqual([
      { kind: "github", host: "github.com", owner: "me", repo: "app", base: "https://github.com" },
      { kind: "gitea", host: "gitea.local:3030", owner: "root", repo: "App", base: "http://gitea.local:3030" },
      { kind: "github", host: "github.com", owner: "me", repo: "other", base: "https://github.com" },
    ]);
  });

  it("gives nothing for no remotes or a local path", () => {
    expect(parseRemotes("")).toEqual([]);
    expect(parseRemotes("origin\tC:/repos/app (fetch)")).toEqual([]);
  });

  it("never keeps a password from the remote", () => {
    expect(JSON.stringify(parseRemotes("g\thttp://root:secret@h.example:3000/a/b.git (fetch)"))).not.toContain("secret");
  });
});

describe("parsePulls", () => {
  it("reads GitHub's pull request list", () => {
    const json = [
      { number: 12, title: "Add login", html_url: "https://github.com/me/app/pull/12", state: "closed", merged_at: "2026-01-01T00:00:00Z", head: { ref: "login", sha: "abc123" } },
      { number: 13, title: "Fix", html_url: "https://github.com/me/app/pull/13", state: "open", merged_at: null, head: { ref: "fix", sha: "def456" } },
      { number: 14, title: "Old", html_url: "https://github.com/me/app/pull/14", state: "closed", merged_at: null, head: { ref: "old", sha: "aaa" } },
    ];
    expect(parsePulls(json)).toEqual([
      { number: 12, title: "Add login", url: "https://github.com/me/app/pull/12", state: "merged", branch: "login", headSha: "abc123" },
      { number: 13, title: "Fix", url: "https://github.com/me/app/pull/13", state: "open", branch: "fix", headSha: "def456" },
      { number: 14, title: "Old", url: "https://github.com/me/app/pull/14", state: "closed", branch: "old", headSha: "aaa" },
    ]);
  });

  it("reads Gitea's single pull request answer, and its merged flag", () => {
    const json = { number: 3, title: "Docs", html_url: "http://gitea.local:3030/root/App/pulls/3", state: "closed", merged: true, head: { ref: "docs", sha: "s1" } };
    expect(parsePulls(json)).toEqual([{ number: 3, title: "Docs", url: "http://gitea.local:3030/root/App/pulls/3", state: "merged", branch: "docs", headSha: "s1" }]);
  });

  it("skips what is not a pull request and answers [] for junk", () => {
    expect(parsePulls([{ title: "no number" }, null, 5])).toEqual([]);
    expect(parsePulls("nope")).toEqual([]);
    expect(parsePulls(undefined)).toEqual([]);
  });

  it("only keeps http(s) links", () => {
    expect(parsePulls([{ number: 1, title: "x", html_url: "javascript:alert(1)", state: "open" }])).toEqual([]);
  });
});

describe("checks", () => {
  it("summarises: any failure fails, else anything running runs, else passed", () => {
    expect(summariseChecks(["passed", "failed", "running"])).toBe("failed");
    expect(summariseChecks(["passed", "running", undefined])).toBe("running");
    expect(summariseChecks(["passed", undefined])).toBe("passed");
    expect(summariseChecks([undefined])).toBeUndefined();
    expect(summariseChecks([])).toBeUndefined();
  });

  it("reads GitHub check runs", () => {
    const run = (status: string, conclusion: string | null) => ({ status, conclusion });
    expect(checksFromCheckRuns({ check_runs: [run("completed", "success"), run("completed", "failure")] })).toBe("failed");
    expect(checksFromCheckRuns({ check_runs: [run("completed", "success"), run("in_progress", null)] })).toBe("running");
    expect(checksFromCheckRuns({ check_runs: [run("queued", null)] })).toBe("running");
    expect(checksFromCheckRuns({ check_runs: [run("completed", "success"), run("completed", "skipped")] })).toBe("passed");
    expect(checksFromCheckRuns({ check_runs: [run("completed", "timed_out")] })).toBe("failed");
    expect(checksFromCheckRuns({ check_runs: [run("completed", "cancelled")] })).toBeUndefined();
    expect(checksFromCheckRuns({ check_runs: [] })).toBeUndefined();
    expect(checksFromCheckRuns("junk")).toBeUndefined();
  });

  it("reads a commit status (GitHub's combined status and Gitea's)", () => {
    expect(checksFromStatus({ state: "success", total_count: 2 })).toBe("passed");
    expect(checksFromStatus({ state: "failure", total_count: 1 })).toBe("failed");
    expect(checksFromStatus({ state: "error", total_count: 1 })).toBe("failed");
    expect(checksFromStatus({ state: "pending", total_count: 1 })).toBe("running");
    expect(checksFromStatus({ state: "warning", total_count: 1 })).toBe("passed");
    // GitHub says "pending" when nothing reported at all
    expect(checksFromStatus({ state: "pending", total_count: 0, statuses: [] })).toBeUndefined();
    expect(checksFromStatus({ state: "", total_count: 0 })).toBeUndefined();
    expect(checksFromStatus(null)).toBeUndefined();
  });
});

describe("freshness", () => {
  const now = 10 * 60 * 60_000;
  it("an entry is fresh for a few minutes", () => {
    expect(isFresh({ at: now - 60_000, prs: [] }, now)).toBe(true);
    expect(isFresh({ at: now - 6 * 60_000, prs: [] }, now)).toBe(false);
    expect(isFresh(undefined, now)).toBe(false);
  });
  it("a settled one (pull requests all closed, nothing running) keeps for hours", () => {
    const merged = { number: 1, title: "x", url: "https://h/1", state: "merged" as const };
    expect(isFresh({ at: now - 60 * 60_000, prs: [merged], checks: "passed" }, now)).toBe(true);
    expect(isFresh({ at: now - 7 * 60 * 60_000, prs: [merged], checks: "passed" }, now)).toBe(false);
    expect(isFresh({ at: now - 60 * 60_000, prs: [merged], checks: "running" }, now)).toBe(false);
    expect(isFresh({ at: now - 60 * 60_000, prs: [{ ...merged, state: "open" }] }, now)).toBe(false);
  });
});

const task = (id: string, extra: Partial<CiTask> = {}): CiTask => ({ id, status: "done", ...extra });

describe("stepLookups", () => {
  it("takes the newest commit of the most recently finished steps, and branches other than the main one", () => {
    const tasks = [
      task("t1", { commits: ["aaa1111", "aaa0000"], branch: "main", finishedAt: "2026-01-01T00:00:00Z" }),
      task("t2", { commits: ["bbb2222"], branch: "feature/x", finishedAt: "2026-01-03T00:00:00Z" }),
      task("t3", { status: "in progress" }),
      task("t4", { commits: [], finishedAt: "2026-01-04T00:00:00Z" }),
    ];
    expect(stepLookups(tasks)).toEqual([
      { sha: "bbb2222", branch: "feature/x" },
      { sha: "aaa1111" },
    ]);
  });

  it("drops a hash or branch that is not safe to send", () => {
    expect(stepLookups([task("t", { commits: ["--evil"], finishedAt: "2026-01-01T00:00:00Z" })])).toEqual([]);
    expect(stepLookups([task("t", { commits: ["abc1234"], branch: "a b;c", finishedAt: "2026-01-01T00:00:00Z" })])).toEqual([{ sha: "abc1234" }]);
  });
});

describe("stepCi and goalCi", () => {
  const pr = (n: number, state: "open" | "merged" | "closed", checks?: "passed" | "failed" | "running") => ({ number: n, title: `PR ${n}`, url: `https://h/${n}`, state, ...(checks ? { checks } : {}) });
  const cache: CiCache = {
    commits: {
      aaa1111: { at: 1, prs: [pr(1, "merged", "passed")], checks: "passed" },
      bbb2222: { at: 1, prs: [], checks: "failed" },
      ccc3333: { at: 1, prs: [pr(2, "open", "running")], checks: "passed" },
    },
    branches: { "feature/x": { at: 1, prs: [pr(1, "merged", "passed"), pr(3, "closed")] } },
  };

  it("a step shows its pull requests (once each) and checks: an open one's first, else the commit's own", () => {
    expect(stepCi(task("t", { commits: ["aaa1111"], branch: "feature/x" }), cache)).toEqual({ prs: [pr(1, "merged", "passed"), pr(3, "closed")], checks: "passed" });
    expect(stepCi(task("t", { commits: ["bbb2222"] }), cache)).toEqual({ prs: [], checks: "failed" });
    expect(stepCi(task("t", { commits: ["ccc3333"] }), cache)).toEqual({ prs: [pr(2, "open", "running")], checks: "running" });
    expect(stepCi(task("t", { commits: ["zzz9999"] }), cache)).toBeUndefined();
    expect(stepCi(task("t"), cache)).toBeUndefined();
  });

  it("a goal's checks are those of its most recently finished step that has some", () => {
    const tasks = [
      task("t1", { commits: ["aaa1111"], finishedAt: "2026-01-01T00:00:00Z" }),
      task("t2", { commits: ["bbb2222"], finishedAt: "2026-01-02T00:00:00Z" }),
      task("t3", { commits: ["zzz9999"], finishedAt: "2026-01-03T00:00:00Z" }),
    ];
    const g = goalCi(tasks, cache);
    expect(g.checks).toBe("failed");
    expect(g.prs.map((p) => p.number)).toEqual([1]);
    expect(Object.keys(g.steps)).toEqual(["t1", "t2"]);
    expect(goalCi([task("t", { commits: ["nope000"] })], cache)).toEqual({ prs: [], steps: {} });
  });

  it("failedGoals lists open goals whose latest checks failed", () => {
    const goals = [
      { id: "g1", title: "Login", status: "active", tasks: [task("t", { commits: ["bbb2222"], finishedAt: "2026-01-02T00:00:00Z" })] },
      { id: "g2", title: "Docs", status: "active", tasks: [task("t", { commits: ["aaa1111"], finishedAt: "2026-01-02T00:00:00Z" })] },
      { id: "g3", title: "Gone", status: "dropped", tasks: [task("t", { commits: ["bbb2222"], finishedAt: "2026-01-02T00:00:00Z" })] },
      { id: "g4", title: "Shipped", status: "done", tasks: [task("t", { commits: ["bbb2222"], finishedAt: "2026-01-02T00:00:00Z" })] },
    ];
    expect(failedGoals(goals, cache)).toEqual([{ id: "g1", title: "Login" }]);
  });
});

describe("refreshCi", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "progressor-ci-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  type Call = { cmd: string; args: string[] };
  function fakeDeps(over: { remotes?: string; gh?: Record<string, unknown>; http?: Record<string, { status: number; body?: unknown }>; token?: string } = {}) {
    const calls: Call[] = [];
    const urls: { url: string; headers: Record<string, string> }[] = [];
    const deps: CiDeps = {
      async run(cmd, args) {
        calls.push({ cmd, args });
        if (cmd === "git" && args[0] === "remote") return over.remotes ?? "";
        if (cmd === "git" && args[0] === "rev-parse") return `${args[1]!.replace(/\^\{commit\}$/, "")}00ff\n`;
        if (cmd === "gh") {
          const path = args[args.length - 1]!;
          return path in (over.gh ?? {}) ? JSON.stringify(over.gh![path]) : undefined;
        }
        return undefined;
      },
      async fetchJson(url, headers) {
        urls.push({ url, headers });
        const a = over.http?.[url];
        return a ? { status: a.status, body: a.body } : undefined;
      },
      token: over.token,
      now: () => 1_000_000,
    };
    return { deps, calls, urls };
  }

  it("finds GitHub pull requests and checks for a commit through gh, and saves them", async () => {
    const file = join(dir, "ci.json");
    const { deps } = fakeDeps({
      remotes: "origin\thttps://github.com/me/app.git (fetch)",
      gh: {
        "repos/me/app/commits/abc123400ff/pulls": [{ number: 7, title: "Login", html_url: "https://github.com/me/app/pull/7", state: "open", head: { ref: "login", sha: "eee7777" } }],
        "repos/me/app/commits/abc123400ff/check-runs": { check_runs: [{ status: "completed", conclusion: "success" }] },
        "repos/me/app/commits/abc123400ff/status": { state: "pending", total_count: 0 },
        "repos/me/app/commits/eee7777/check-runs": { check_runs: [{ status: "completed", conclusion: "failure" }] },
        "repos/me/app/commits/eee7777/status": { state: "pending", total_count: 0 },
      },
    });
    const changed = await refreshCi("/repo", [{ sha: "abc1234" }], deps, file);
    expect(changed).toBe(true);
    const cache = readCiCache(file);
    expect(cache.commits.abc1234).toEqual({
      at: 1_000_000,
      prs: [{ number: 7, title: "Login", url: "https://github.com/me/app/pull/7", state: "open", branch: "login", headSha: "eee7777", checks: "failed" }],
      checks: "passed",
    });
  });

  it("asks Gitea's API with the token from the environment, and never saves the token", async () => {
    const file = join(dir, "ci.json");
    const api = "http://gitea.local:3030/api/v1/repos/root/App";
    const { deps, urls } = fakeDeps({
      remotes: "gitea\thttp://gitea.local:3030/root/App.git (fetch)",
      token: "tok-secret",
      http: {
        [`${api}/commits/abc123400ff/pull`]: { status: 200, body: { number: 3, title: "Docs", html_url: "http://gitea.local:3030/root/App/pulls/3", state: "open", head: { ref: "docs", sha: "ccc3333" } } },
        [`${api}/commits/abc123400ff/status`]: { status: 200, body: { state: "success", total_count: 1 } },
        [`${api}/commits/ccc3333/status`]: { status: 200, body: { state: "pending", total_count: 1 } },
        [`${api}/pulls?state=all&limit=50`]: { status: 200, body: [{ number: 4, title: "Docs 2", html_url: "http://gitea.local:3030/root/App/pulls/4", state: "open", head: { ref: "docs", sha: "ccc3333" } }, { number: 5, title: "Other", html_url: "http://gitea.local:3030/root/App/pulls/5", state: "open", head: { ref: "other", sha: "x" } }] },
      },
    });
    await refreshCi("/repo", [{ sha: "abc1234", branch: "docs" }], deps, file);
    expect(urls.every((u) => u.headers.Authorization === "token tok-secret")).toBe(true);
    const cache = readCiCache(file);
    expect(cache.commits.abc1234?.prs.map((p) => [p.number, p.checks])).toEqual([[3, "running"]]);
    expect(cache.commits.abc1234?.checks).toBe("passed");
    expect(cache.branches.docs?.prs.map((p) => p.number)).toEqual([4]);
    expect(readFileSync(file, "utf8")).not.toContain("tok-secret");
  });

  it("a commit Gitea has no pull request for (404) is saved as having none", async () => {
    const file = join(dir, "ci.json");
    const api = "http://g.example/api/v1/repos/o/r";
    const { deps } = fakeDeps({
      remotes: "o\thttp://g.example/o/r (fetch)",
      http: { [`${api}/commits/abc123400ff/pull`]: { status: 404 }, [`${api}/commits/abc123400ff/status`]: { status: 200, body: { state: "", total_count: 0 } } },
    });
    await refreshCi("/repo", [{ sha: "abc1234" }], deps, file);
    expect(readCiCache(file).commits.abc1234).toEqual({ at: 1_000_000, prs: [] });
  });

  it("without a remote, gh or the network nothing is saved and nothing fails", async () => {
    const file = join(dir, "ci.json");
    expect(await refreshCi("/repo", [{ sha: "abc1234" }], fakeDeps().deps, file)).toBe(false);
    const offline = fakeDeps({ remotes: "origin\thttps://github.com/me/app.git (fetch)\ng\thttp://g.example/o/r (fetch)" });
    expect(await refreshCi("/repo", [{ sha: "abc1234" }], offline.deps, file)).toBe(false);
    expect(readCiCache(file)).toEqual({ commits: {}, branches: {} });
  });

  it("skips entries that are still fresh", async () => {
    const file = join(dir, "ci.json");
    const { deps, calls } = fakeDeps({ remotes: "origin\thttps://github.com/me/app.git (fetch)", gh: { "repos/me/app/commits/abc123400ff/pulls": [] } });
    await refreshCi("/repo", [{ sha: "abc1234" }], deps, file);
    const before = calls.length;
    expect(await refreshCi("/repo", [{ sha: "abc1234" }], deps, file)).toBe(false);
    expect(calls.length).toBe(before);
  });
});

describe("ciCacheFile and readCiCache", () => {
  it("keeps one file per project beside the project list", () => {
    const a = ciCacheFile("/home/me/.progressor/projects.json", "/code/a");
    const b = ciCacheFile("/home/me/.progressor/projects.json", "/code/b");
    expect(a.replace(/\\/g, "/")).toMatch(/^\/home\/me\/\.progressor\/ci\/[0-9a-f]{16}\.json$/);
    expect(a).not.toBe(b);
  });
  it("reads a missing or broken file as empty", () => {
    expect(readCiCache(join(tmpdir(), "no-such-progressor-ci.json"))).toEqual({ commits: {}, branches: {} });
  });
});

describe("kickCiRefresh", () => {
  it("starts at most one refresh at a time per project and tells when it changed something", async () => {
    const dir = mkdtempSync(join(tmpdir(), "progressor-ci-"));
    try {
      const file = join(dir, "ci.json");
      let remoteCalls = 0;
      const deps: CiDeps = {
        async run(cmd, args) {
          if (cmd === "git" && args[0] === "remote") {
            remoteCalls++;
            return "origin\thttps://github.com/me/app.git (fetch)";
          }
          if (cmd === "git") return undefined;
          return JSON.stringify([]);
        },
        fetchJson: async () => undefined,
        now: () => Date.now(),
      };
      const tasks = [task("t", { commits: ["abc1234"], finishedAt: "2026-01-01T00:00:00Z" })];
      let told = 0;
      const first = kickCiRefresh("/repo-kick", () => tasks, file, deps, () => told++);
      const second = kickCiRefresh("/repo-kick", () => tasks, file, deps, () => told++);
      expect(second).toBeUndefined();
      await first;
      expect(told).toBe(1);
      expect(remoteCalls).toBe(1);
      // Tried just now: not again straight away.
      expect(kickCiRefresh("/repo-kick", () => tasks, file, deps, () => told++)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
