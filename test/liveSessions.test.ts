// Live sessions: the AI chats working on a project right now (from the heartbeat records each chat's
// Progressor server keeps), what each holds and is on, and the helpers at work against the limit.
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { liveSessions } from "../src/liveSessions.js";
import { Project } from "../src/project.js";
import { computeSchedule, helperCount } from "../src/schedule.js";
import type { ServerRecord } from "../src/servers.js";
import { tempDir } from "./tmp.js";

const NOW = new Date("2026-11-17T10:00:00Z");
let root: string;

const record = (over: Partial<ServerRecord>): ServerRecord => ({
  pid: 100,
  kind: "session",
  root,
  session: "s-a",
  version: "1.4.0",
  startedAt: "2026-11-17T09:00:00Z",
  beatAt: "2026-11-17T09:59:50Z",
  memory: 1,
  ...over,
});

beforeEach(() => {
  root = tempDir("progressor-live-");
});

describe("counting helpers", () => {
  it("counts one helper per branch (or folder), however many steps it has", () => {
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addGoal("Login", [{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }]);
    p.claimGoal("login");
    p.setTaskState("t1", "with a helper", "login", { helper: { branch: "helper/x" } });
    p.setTaskState("t2", "with a helper", "login", { helper: { branch: "helper/x" } });
    p.setTaskState("t3", "with a helper", "login", { helper: { folder: "/w/y" } });
    p.setTaskState("t4", "with a helper", "login"); // no helper info: counts on its own
    expect(helperCount([{ goal: p.roadmap().goal("login")!, tasks: p.plan("login").tasks }])).toBe(3);
    expect(p.helperLoad().busy).toBe(3);
    expect(computeSchedule([{ goal: p.roadmap().goal("login")!, tasks: p.plan("login").tasks }], 1, NOW).helpers).toBe(3);
  });
});

describe("the chats working on a project", () => {
  it("lists each chat's server for this project, with the goals it holds and the step it is on", () => {
    const p = new Project({ root, session: { id: "s-a", pid: 100 }, isAlive: () => true });
    p.addGoal("Login", [{ title: "Route" }, { title: "Callback" }]);
    p.claimGoal("login");
    p.startTask("t2", "login");
    const other = new Project({ root, session: { id: "s-b", pid: 200 }, isAlive: () => true });
    other.addGoal("Billing", [{ title: "Checkout" }]);
    other.claimGoal("billing");
    const records = [
      record({}),
      record({ pid: 200, session: "s-b", startedAt: "2026-11-17T09:30:00Z" }),
      record({ pid: 300, session: "s-c", root: join(root, "..", "elsewhere") }), // another project
      record({ pid: 400, kind: "dashboard", session: undefined }),
    ];
    const live = liveSessions(p, records);
    expect(live).toEqual([
      { session: "s-a", pid: 100, since: "2026-11-17T09:00:00Z", seen: "2026-11-17T09:59:50Z", goals: [{ id: "login", title: "Login", step: { id: "t2", title: "Callback" } }] },
      { session: "s-b", pid: 200, since: "2026-11-17T09:30:00Z", seen: "2026-11-17T09:59:50Z", goals: [{ id: "billing", title: "Billing" }] },
    ]);
  });

  it("shows a helper chat started in a worktree, with its folder and branch", () => {
    const p = new Project({ root, session: { id: "s-a", pid: 100 }, isAlive: () => true });
    p.addGoal("Login");
    const live = liveSessions(p, [record({ pid: 500, session: "s-h", worktree: "/w/t3", branch: "t3-export" })]);
    expect(live).toMatchObject([{ session: "s-h", worktree: "/w/t3", branch: "t3-export", goals: [] }]);
  });

  it("shows a helper chat on the step its branch is for, in a goal another chat holds", () => {
    const p = new Project({ root, session: { id: "s-a", pid: 100 }, isAlive: () => true });
    p.addGoal("Login", [{ title: "Route" }, { title: "Callback" }, { title: "Export" }]);
    p.addGoal("Billing", [{ title: "Checkout" }, { title: "Refunds" }]); // nobody holds it: its t2 is not meant
    p.claimGoal("login");
    p.setTaskState("t3", "with a helper", "login", { helper: { branch: "helper/csv" } });
    const live = liveSessions(p, [
      record({}),
      record({ pid: 500, session: "s-h", worktree: "/w/t2", branch: "t2-callback" }),
      record({ pid: 600, session: "s-i", worktree: "/w/csv", branch: "helper/csv" }),
      record({ pid: 700, session: "s-j", worktree: "/w/x", branch: "misc" }),
    ]);
    expect(live[1]).toMatchObject({ session: "s-h", helper: true, goals: [{ id: "login", title: "Login", step: { id: "t2", title: "Callback" } }] });
    expect(live[2]).toMatchObject({ session: "s-i", helper: true, goals: [{ id: "login", step: { id: "t3", title: "Export" } }] });
    expect(live[3]).toMatchObject({ session: "s-j", goals: [] });
  });

  it("shows a chat with no goal as looking around", () => {
    const p = new Project({ root, session: { id: "s-a", pid: 100 } });
    p.addGoal("Login");
    expect(liveSessions(p, [record({})])).toEqual([{ session: "s-a", pid: 100, since: "2026-11-17T09:00:00Z", seen: "2026-11-17T09:59:50Z", goals: [] }]);
  });
});

describe("passing the helper limit", () => {
  it("is said on every message while more helpers work than the limit allows", async () => {
    const { runHook } = await import("../src/hooks.js");
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addStandingInstruction("At most one helper at a time", false, 1);
    p.addGoal("Login", [{ title: "A" }, { title: "B" }]);
    p.claimGoal("login");
    const prompt = () =>
      runHook({ event: "prompt", input: JSON.stringify({ cwd: root, hook_event_name: "UserPromptSubmit" }), env: { PROGRESSOR_REGISTRY: join(tempDir("progressor-reg-"), "r.json") }, isAlive: () => true, now: () => NOW });
    p.setTaskState("t1", "with a helper", "login", { helper: { branch: "helper/a" } });
    expect(prompt()).not.toMatch(/helper limit/);
    p.setTaskState("t2", "with a helper", "login", { helper: { branch: "helper/b" } });
    expect(prompt()).toMatch(/2 helpers are at work, over the helper limit of 1 \(s1\): hand out no more until one comes back\./);
  });
});
