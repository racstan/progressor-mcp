// Steps that are not finished and pull requests that point at them: what ci.ts asks and keeps.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CiDeps, type CiTask, kickCiRefresh, parsePulls, readCiCache, refreshCi, stepLookups } from "../src/ci.js";

const task = (id: string, extra: Partial<CiTask> = {}): CiTask => ({ id, status: "pending", ...extra });

describe("reading a pull request's extras", () => {
  it("keeps the steps its title or body points at, once each", () => {
    const [pr] = parsePulls([
      {
        number: 5,
        title: "Export (progressor://less/t3)",
        body: "Closes progressor://less/t3 and progressor://less/t12.\nNot progressor://x/y",
        html_url: "https://github.com/o/r/pull/5",
        state: "open",
        created_at: "2026-11-27T09:00:00Z",
      },
    ]);
    expect(pr).toMatchObject({ refs: ["less/t3", "less/t12"], createdAt: "2026-11-27T09:00:00Z" });
  });

  it("keeps the merge commit and time of a merged one only", () => {
    const [m, o] = parsePulls([
      { number: 1, title: "a", html_url: "https://h/1", state: "closed", merged_at: "2026-11-27T10:00:00Z", merge_commit_sha: "abc9999", head: { ref: "x", sha: "s1" } },
      { number: 2, title: "b", html_url: "https://h/2", state: "open", merge_commit_sha: "test-merge" },
    ]);
    expect(m).toMatchObject({ state: "merged", mergeSha: "abc9999", mergedAt: "2026-11-27T10:00:00Z" });
    expect(o).not.toHaveProperty("mergeSha");
    expect(o).not.toHaveProperty("refs");
  });
});

describe("looking up open steps by branch", () => {
  it("asks about the branch recorded on an open step, and one naming it when branches are known", () => {
    const tasks = [
      task("t1", { helperBranch: "odd-name" }),
      task("t2"),
      task("t3", { status: "in progress" }),
      task("t4", { status: "done", helperBranch: "old" }),
    ];
    expect(stepLookups(tasks)).toEqual([{ branch: "odd-name" }]);
    expect(stepLookups(tasks, ["main", "t2-docs", "t30-x"])).toEqual([{ branch: "odd-name" }, { branch: "t2-docs" }]);
  });

  it("never asks about the main branch or an unsafe name, or twice about one branch", () => {
    expect(stepLookups([task("t1", { helperBranch: "main" }), task("t2", { helperBranch: "a b;c" })])).toEqual([]);
    expect(stepLookups([task("t1", { helperBranch: "x" }), task("t2", { helperBranch: "x" })])).toEqual([{ branch: "x" }]);
  });
});

describe("listing recent pull requests", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "progressor-ci-steps-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const prJson = (n: number, over: Record<string, unknown> = {}) => ({ number: n, title: `pr ${n}`, html_url: `https://github.com/me/app/pull/${n}`, state: "open", head: { ref: `b${n}`, sha: `abc000${n}` }, ...over });

  it("keeps them from GitHub with checks for the open ones, and refs", async () => {
    const asked: string[] = [];
    const deps: CiDeps = {
      async run(cmd, args) {
        if (cmd === "git") return "origin\thttps://github.com/me/app.git (fetch)";
        const path = args[args.length - 1]!;
        asked.push(path);
        if (path === "repos/me/app/pulls?state=all&per_page=30")
          return JSON.stringify([prJson(1, { body: "progressor://g/t1" }), prJson(2, { state: "closed", merged_at: "2026-11-27T10:00:00Z" })]);
        if (path === "repos/me/app/commits/abc0001/check-runs") return JSON.stringify({ check_runs: [{ status: "completed", conclusion: "success" }] });
        return undefined;
      },
      fetchJson: async () => undefined,
      now: () => 1_000_000,
    };
    const file = join(dir, "ci.json");
    expect(await refreshCi("/repo", [], deps, file, { recent: true })).toBe(true);
    const recent = readCiCache(file).recent!;
    expect(recent.at).toBe(1_000_000);
    expect(recent.prs.map((p) => [p.number, p.state, p.checks, p.refs])).toEqual([
      [1, "open", "passed", ["g/t1"]],
      [2, "merged", undefined, undefined],
    ]);
    expect(asked.some((a) => a.includes("abc0002"))).toBe(false);
    // Fresh now: not asked again.
    expect(await refreshCi("/repo", [], deps, file, { recent: true })).toBe(false);
  });

  it("does not list them unless asked to", async () => {
    const deps: CiDeps = { run: async () => "origin\thttps://github.com/me/app.git (fetch)", fetchJson: async () => undefined, now: () => 1 };
    expect(await refreshCi("/repo", [], deps, join(dir, "ci.json"))).toBe(false);
  });

  it("keeps them from Gitea, at most 30", async () => {
    const list = Array.from({ length: 40 }, (_, i) => ({ number: i + 1, title: "x", html_url: `http://g.local/o/r/pulls/${i + 1}`, state: "closed", merged: true, head: { ref: "b", sha: "s" } }));
    const deps: CiDeps = {
      run: async (cmd) => (cmd === "git" ? "origin\thttp://g.local/o/r.git (fetch)" : undefined),
      fetchJson: async (url) => (url === "http://g.local/api/v1/repos/o/r/pulls?state=all&limit=50" ? { status: 200, body: list } : undefined),
      now: () => 1_000_000,
    };
    const file = join(dir, "ci.json");
    await refreshCi("/repo", [], deps, file, { recent: true });
    expect(readCiCache(file).recent!.prs).toHaveLength(30);
  });

  it("a background refresh runs for an open step with nothing else due, and not when every step is finished", async () => {
    let remote = 0;
    const deps: CiDeps = {
      run: async (cmd, args) => {
        if (cmd === "git" && args[0] === "remote") {
          remote++;
          return "origin\thttps://github.com/me/app.git (fetch)";
        }
        return JSON.stringify([]);
      },
      fetchJson: async () => undefined,
      now: () => Date.now(),
    };
    await kickCiRefresh("/repo-open-step", () => [task("t1")], join(dir, "a.json"), deps, () => undefined);
    expect(remote).toBe(1);
    expect(kickCiRefresh("/repo-all-done", () => [task("t1", { status: "done" })], join(dir, "b.json"), deps, () => undefined)).toBeUndefined();
  });
});
