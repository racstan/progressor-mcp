// Steps follow local git: Project.syncWithGit (with git faked) and the line a tool reply gets.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
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
