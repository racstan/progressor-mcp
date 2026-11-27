// Handing a Goal to another chat in one call (release_goal with to), and the clearer error when a
// chat tries to change a Goal another chat holds.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import type { ServerRecord } from "../src/servers.js";
import { tempDir } from "./tmp.js";

let root: string;
const alive = new Set<number>();
let now = new Date("2026-11-27T10:00:00.000Z");

function session(id: string, pid: number): Project {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive: (p) => alive.has(p), now: () => now });
}

beforeEach(() => {
  root = tempDir("progressor-");
  alive.clear();
  now = new Date("2026-11-27T10:00:00.000Z");
  session("s-setup", 1).addGoal("Login", [{ title: "one" }]);
});

describe("handing a Goal to another chat", () => {
  it("moves the claim straight to a running chat in this project", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    const goal = a.handGoal("login", "s-b", [{ session: "s-b", pid: 200 }]);

    expect(goal.claim?.session).toBe("s-b");
    expect(goal.claim?.pid).toBe(200);
    expect(goal.status).toBe("active");
    expect(a.claimedGoals()).toEqual([]);
    expect(session("s-b", 200).claimedGoals().map((g) => g.id)).toEqual(["login"]);
  });

  it("refuses a chat that is not running here, naming the ones that are", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    expect(() => a.handGoal("login", "s-x", [{ session: "s-b", pid: 200 }])).toThrow(/No chat running in this project is Session s-x.*s-b.*next/);
    expect(() => a.handGoal("login", "s-a", [])).toThrow(/already holds/);
  });

  it("keeps a Goal handed to the next chat until one takes it", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    a.handGoal("login", "next", []);
    expect(a.claimedGoals()).toEqual([]);

    // Another running chat may claim it without a takeover.
    const b = session("s-b", 200);
    expect(b.takeHandedGoals().map((g) => g.id)).toEqual(["login"]);
    expect(b.claimedGoals().map((g) => g.id)).toEqual(["login"]);
    expect(session("s-c", 300).takeHandedGoals()).toEqual([]);
  });

  it("lets a chat claim a Goal handed to the next chat", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    a.handGoal(undefined, "next", []);
    session("s-b", 200).claimGoal("login");
    expect(session("s-b", 200).claimedGoals().map((g) => g.id)).toEqual(["login"]);
  });

  it("pauses a Goal handed to the next chat when nobody takes it for a day", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    a.handGoal("login", "next", []);
    now = new Date("2026-11-28T11:00:00.000Z");
    const b = session("s-b", 200);
    expect(b.roadmap().goal("login")!.claim?.session).toBe("next");
    b.sessionStatus();
    expect(b.roadmap().goal("login")!.claim).toBeUndefined();
    expect(b.takeHandedGoals()).toEqual([]);
  });
});

describe("changing a Goal another chat holds", () => {
  it("says which chat holds it and how to take it", () => {
    session("s-other", 300).claimGoal("login");
    const me = session("s-me", 100);
    expect(() => me.releaseGoal("login")).toThrow(
      /Goal login is held by another chat, Session s-other \(still running\); this chat is Session s-me\. The per-message status lists every Goal in progress in this project, not only this chat's\./,
    );
  });

  it("says when a Goal is held by nobody", () => {
    expect(() => session("s-me", 100).releaseGoal("login")).toThrow(/Goal login is not held by any chat; claim it first \(claim_goal\)/);
  });
});

describe("release_goal with to", () => {
  let client: Client;
  let records: ServerRecord[];

  beforeEach(async () => {
    const project = new Project({ root, session: { id: "s-a", pid: process.pid } });
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
  const record = (session: string, pid: number): ServerRecord => ({
    pid,
    kind: "session",
    root,
    session,
    version: "0",
    startedAt: "2026-11-27T09:00:00.000Z",
    beatAt: "2026-11-27T09:59:50.000Z",
    memory: 0,
  });

  it("hands the Goal to a running chat and lists the chats in get_status", async () => {
    records = [record("s-a", process.pid), record("s-b", 4242)];
    await call("claim_goal", { goal: "login" });
    expect((await call("get_status")).text).toContain("Other chats in this project: s-b (no Goal)");
    const r = await call("release_goal", { goal: "login", to: "s-b" });
    expect(r.isError).toBe(false);
    expect(r.text).toBe("Handed Goal login to Session s-b; it holds it now.");
  });

  it("hands the Goal to the next chat, which takes it in get_status", async () => {
    await call("claim_goal", { goal: "login" });
    expect((await call("release_goal", { to: "next" })).text).toBe(
      "Handed Goal login to the next chat in this project: its get_status takes it. If nobody takes it within a day, it is paused.",
    );
    alive.add(5);
    const next = new Project({ root, session: { id: "s-n", pid: 5 }, isAlive: (p) => alive.has(p) || p === process.pid });
    const server = createServer(next, { servers: () => [] });
    const [c, s] = InMemoryTransport.createLinkedPair();
    const other = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(s), other.connect(c)]);
    const r = (await other.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] };
    const text = r.content.map((x) => x.text).join("\n");
    expect(text).toContain("Goal login was handed to this chat; it is claimed for you.");
    expect(text).toContain("claimed by this Session");
  });
});
