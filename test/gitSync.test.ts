// Steps follow local git: Project.syncWithGit (with git faked) and the line a tool reply gets.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type CiDeps, ciCacheFile } from "../src/ci.js";
import type { GitFacts } from "../src/gitFacts.js";
import type { LiveSession } from "../src/liveSessions.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import type { ServerRecord } from "../src/servers.js";
import { tempDir } from "./tmp.js";

let root: string;
let now: Date;
let exists: Set<string>;
let merged: Set<string>;
let ahead: Record<string, string[]>;
let known: boolean;
let mergedInto: Record<string, { commits: string[]; at: string }>;
let asked: number;
const fakeGit: GitFacts = {
  commitsSince: () => [],
  dirty: () => false,
  branch: () => "main",
  commitLink: () => undefined,
  branches: () => {
    asked++;
    return known ? { exists, merged } : undefined;
  },
  ahead: (_r, b) => ahead[b],
  mergedInto: (_r, b) => mergedInto[b],
};
const helper = (session: string, branch: string): LiveSession => ({ session, pid: 9, since: "", seen: "", goals: [], branch, worktree: `/w/${session}` });

function lead(): Project {
  const p = new Project({ root, session: { id: "s-main", pid: process.pid }, now: () => now, git: fakeGit });
  return p;
}

beforeEach(() => {
  root = tempDir("progressor-gitsync-");
  now = new Date("2026-11-27T10:00:00.000Z");
  exists = new Set(["main", "t1-export", "t2-docs"]);
  merged = new Set(["main"]);
  ahead = {};
  mergedInto = {};
  known = true;
  asked = 0;
  const p = lead();
  p.addGoal("Login", [{ title: "Export" }, { title: "Docs" }, { title: "Other" }]);
  p.claimGoal("login");
});

describe("syncWithGit", () => {
  it("marks a step with a helper while another chat works in a worktree on its branch", () => {
    const p = lead();
    const line = p.syncWithGit([helper("s-1a2b3c", "t2-docs")]);
    expect(line).toBe("Kept in step with git: t2 is with a helper (chat s-1a2b3c on branch t2-docs).");
    const t = p.plan("login").tasks.find((x) => x.id === "t2")!;
    expect(t.status).toBe("with a helper");
    expect(t.helper).toEqual({ branch: "t2-docs", folder: "/w/s-1a2b3c", label: "chat s-1a2b3c" });
  });

  it("marks a step done, with the commits, once its branch is merged", () => {
    const p = lead();
    ahead = { "t1-export": ["a1b2c3", "d4e5f6"] };
    expect(p.syncWithGit([])).toBeUndefined(); // seen ahead, not merged yet
    now = new Date("2026-11-27T10:01:00.000Z");
    merged.add("t1-export");
    ahead = {};
    expect(p.syncWithGit([])).toBe("Kept in step with git: t1 is done (branch t1-export merged, commits a1b2c3, d4e5f6).");
    const t = p.plan("login").tasks.find((x) => x.id === "t1")!;
    expect(t.status).toBe("done");
    expect(t.commits).toEqual(["a1b2c3", "d4e5f6"]);
    expect(t.branch).toBe("t1-export");
  });

  it("closes a step from the merge commit when the merge was never seen coming", () => {
    const p = lead();
    p.startTask("t1", "login");
    merged.add("t1-export");
    mergedInto = { "t1-export": { commits: ["aaaa111", "bbbb222"], at: "2026-11-27T10:30:00.000Z" } };
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBe("Kept in step with git: t1 is done (branch t1-export merged, commits aaaa111, bbbb222).");
    expect(p.plan("login").tasks.find((x) => x.id === "t1")!.commits).toEqual(["aaaa111", "bbbb222"]);
  });

  it("does not close a step from an old branch that only holds its ID in the name", () => {
    const p = lead();
    p.startTask("t1", "login");
    merged.add("t1-export");
    mergedInto = { "t1-export": { commits: ["cccc333"], at: "2026-05-01T10:00:00.000Z" } };
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBeUndefined();
  });

  it("closes a step whose recorded branch was merged long ago", () => {
    const p = lead();
    exists.add("odd");
    merged.add("odd");
    p.setTaskState("t3", "with a helper", "login", { helper: { branch: "odd" } });
    mergedInto = { odd: { commits: ["dddd444"], at: "2026-05-01T10:00:00.000Z" } };
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBe("Kept in step with git: t3 is done (branch odd merged, commits dddd444).");
  });

  it("does not call a branch with no work of its own done", () => {
    expect(lead().syncWithGit([])).toBeUndefined();
    merged.add("t1-export"); // a branch just made from HEAD is merged
    now = new Date("2026-11-27T10:05:00.000Z");
    expect(lead().syncWithGit([])).toBeUndefined();
  });

  it("checks at most every 30 seconds", () => {
    const p = lead();
    p.syncWithGit([]);
    expect(asked).toBe(1);
    now = new Date("2026-11-27T10:00:20.000Z");
    p.syncWithGit([]);
    expect(asked).toBe(1);
    now = new Date("2026-11-27T10:00:31.000Z");
    p.syncWithGit([]);
    expect(asked).toBe(2);
  });

  it("says nothing and changes nothing when git cannot say", () => {
    known = false;
    expect(lead().syncWithGit([helper("s-h", "t2-docs")])).toBeUndefined();
    expect(lead().plan("login").tasks.find((x) => x.id === "t2")!.status).toBe("pending");
  });

  it("does nothing for a chat that holds no goal, and runs no git", () => {
    const other = new Project({ root, session: { id: "s-x", pid: 4242 }, now: () => now, git: fakeGit });
    expect(other.syncWithGit([helper("s-h", "t2-docs")])).toBeUndefined();
    expect(asked).toBe(0);
  });

  it("does not run git when every step is finished", () => {
    const p = lead();
    for (const id of ["t1", "t2", "t3"]) p.completeTask(id, [], undefined, "login");
    expect(p.syncWithGit([])).toBeUndefined();
    expect(asked).toBe(0);
  });

  it("never fails when git throws", () => {
    const p = new Project({
      root,
      session: { id: "s-main", pid: process.pid },
      now: () => now,
      git: { ...fakeGit, branches: () => { throw new Error("boom"); } },
    });
    expect(p.syncWithGit([])).toBeUndefined();
  });
});

describe("the line on a tool reply", () => {
  let client: Client;
  let records: ServerRecord[];

  beforeEach(async () => {
    const project = lead();
    records = [];
    const server = createServer(project, { servers: () => records });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };
  const rec = (session: string, pid: number, extra: Partial<ServerRecord> = {}): ServerRecord => ({
    pid,
    kind: "session",
    root,
    session,
    version: "0",
    startedAt: "2026-11-27T09:00:00.000Z",
    beatAt: "2026-11-27T09:59:50.000Z",
    memory: 0,
    ...extra,
  });

  it("ends the reply with what was kept in step, once, and nothing when there is nothing to do", async () => {
    records = [rec("s-main", process.pid), rec("s-1a2b3c", 4242, { worktree: "/w/h", branch: "t2-docs" })];
    const first = await call("get_status");
    expect(first.isError).toBe(false);
    expect(first.text).toContain("Kept in step with git: t2 is with a helper (chat s-1a2b3c on branch t2-docs).");
    const second = await call("get_status");
    expect(second.text).not.toContain("Kept in step with git");
  });
});

describe("steps follow pull requests", () => {
  const deps: CiDeps = { run: async () => undefined, fetchJson: async () => undefined, now: () => Date.now() };
  let cacheFile: string;
  let on: boolean;
  const keep = (cache: object) => {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(cache));
  };
  const pr = (over: Record<string, unknown> = {}) => ({ number: 12, title: "Export", url: "https://github.com/o/r/pull/12", state: "open", branch: "t1-export", headSha: "a1b2c3d4e5f6a1b2c3d4", ...over });
  const onBranch = (prs: object[]) => keep({ commits: {}, branches: { "t1-export": { at: Date.now(), prs } } });
  const follower = () => {
    const p = lead();
    p.followPullRequests({ cacheFile: () => cacheFile, deps, on: () => on });
    return p;
  };
  beforeEach(() => {
    cacheFile = join(tempDir("progressor-ci-"), "ci", "x.json");
    on = true;
  });

  it("closes a step whose pull request is merged, with the head and merge commits", () => {
    const p = follower();
    p.startTask("t1", "login");
    onBranch([pr({ state: "merged", mergeSha: "99887766554433", mergedAt: "2026-11-27T10:30:00.000Z" })]);
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBe("Kept in step with git: t1 is done (PR #12 merged, commits a1b2c3d, 9988776).");
    const t = p.plan("login").tasks.find((x) => x.id === "t1")!;
    expect(t.status).toBe("done");
    expect(t.commits).toEqual(["a1b2c3d", "9988776"]);
  });

  it("marks a step checked, with evidence, once its open pull request's checks pass", () => {
    const p = follower();
    p.startTask("t1", "login");
    onBranch([pr({ checks: "passed", createdAt: "2026-11-27T10:30:00.000Z" })]);
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBe("Kept in step with git: t1 is checked (CI passed on PR #12).");
    const t = p.plan("login").tasks.find((x) => x.id === "t1")!;
    expect(t.status).toBe("checked");
    expect(t.evidence).toBe("CI passed on PR #12");
  });

  it("does nothing for failed checks, when pull requests are off, or without a kept answer", () => {
    const p = follower();
    p.startTask("t1", "login");
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBeUndefined(); // nothing kept yet
    onBranch([pr({ checks: "failed", createdAt: "2026-11-27T10:30:00.000Z" })]);
    now = new Date("2026-11-27T11:01:00.000Z");
    expect(p.syncWithGit([])).toBeUndefined();
    onBranch([pr({ state: "merged", mergedAt: "2026-11-27T10:30:00.000Z" })]);
    on = false;
    now = new Date("2026-11-27T11:02:00.000Z");
    expect(p.syncWithGit([])).toBeUndefined();
    expect(p.plan("login").tasks.find((x) => x.id === "t1")!.status).toBe("in progress");
  });

  it("finds a pull request by a ref to the step among the recent ones", () => {
    const p = follower();
    p.startTask("t2", "login");
    keep({ commits: {}, branches: {}, recent: { at: Date.now(), prs: [pr({ branch: "whatever", state: "merged", refs: ["login/t2"] })] } });
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBe("Kept in step with git: t2 is done (PR #12 merged, commits a1b2c3d).");
  });

  it("puts a git change and a pull request change on the one line", () => {
    const p = follower();
    p.startTask("t1", "login");
    onBranch([pr({ checks: "passed", createdAt: "2026-11-27T10:30:00.000Z" })]);
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([helper("s-h", "t2-docs")])).toBe("Kept in step with git: t2 is with a helper (chat s-h on branch t2-docs); t1 is checked (CI passed on PR #12).");
  });

  it("leaves a step that is already finished alone", () => {
    const p = follower();
    p.completeTask("t1", [], undefined, "login");
    onBranch([pr({ state: "merged", mergedAt: "2026-11-27T10:30:00.000Z" })]);
    now = new Date("2026-11-27T11:00:00.000Z");
    expect(p.syncWithGit([])).toBeUndefined();
  });
});

describe("the server follows pull requests", () => {
  it("reads the kept answers beside the project list and adds the line to a reply", async () => {
    const registryFile = join(tempDir("progressor-reg-"), "projects.json");
    const file = ciCacheFile(registryFile, root);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ commits: {}, branches: {}, recent: { at: Date.now(), prs: [{ number: 9, title: "x", url: "https://github.com/o/r/pull/9", state: "open", branch: "t1-export", headSha: "a1b2c3d", checks: "passed", createdAt: "2099-01-01T00:00:00Z" }] } }));
    const project = lead();
    const ci: CiDeps = { run: async () => undefined, fetchJson: async () => undefined, now: () => Date.now() };
    const server = createServer(project, { servers: () => [], registryFile, ci });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    project.startTask("t1", "login");
    now = new Date("2026-11-27T11:00:00.000Z");
    const r = (await client.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] };
    expect(r.content.map((c) => c.text).join("\n")).toContain("Kept in step with git: t1 is checked (CI passed on PR #9).");
  });
});
