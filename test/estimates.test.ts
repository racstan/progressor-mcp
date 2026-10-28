import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { formatDuration, parseDuration, roughDuration, sayDuration, timeText } from "../src/estimate.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { parseRoadmap } from "../src/roadmap.js";
import { createServer, formatRules, scheduleLines } from "../src/server.js";
import { computeSchedule } from "../src/schedule.js";
import { tempDir } from "./tmp.js";

let root: string;
let clock: Date;
const at = (iso: string) => {
  clock = new Date(iso);
};

function agent(): Project {
  return new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => clock });
}
const read = (path: string) => readFileSync(join(root, ".progressor", path), "utf8");

beforeEach(() => {
  root = tempDir("progressor-");
  at("2026-10-26T10:00:00.000Z");
});

describe("times", () => {
  it("reads the ways an estimate is written, and nothing else", () => {
    expect(["45m", "45 min", "2h", "2 hours", "1.5h", "1h 30m", "1h30m", "1 h 10 m", "90 minutes", "1 hr, 15 mins"].map(parseDuration)).toEqual([
      45, 45, 120, 120, 90, 90, 90, 70, 90, 75,
    ]);
    for (const bad of ["", "soon", "90", "2d", "1h and a bit", "h"]) expect(parseDuration(bad)).toBeUndefined();
  });

  it("writes times for the files, for reading and roughly", () => {
    expect([45, 120, 70, 0].map(formatDuration)).toEqual(["45m", "2h", "1h 10m", "0m"]);
    expect(sayDuration(70)).toBe("1 h 10 m");
    expect([3, 22, 75, 380, 790].map(roughDuration)).toEqual(["5 m", "25 m", "1 h 30 m", "6 h 30 m", "13 h"]);
  });

  it("compares the estimate with the time taken", () => {
    expect(timeText({ estimate: 45, spent: 70, running: false })).toBe("took 1 h 10 m, estimated 45 m");
    expect(timeText({ estimate: 45, spent: 20, running: true })).toBe("20 m so far, estimated 45 m");
    expect(timeText({ spent: 30, running: false })).toBe("took 30 m");
    expect(timeText({ estimate: 45, spent: 0, running: false })).toBe("estimated 45 m");
    expect(timeText({ spent: 0, running: false })).toBeUndefined();
  });
});

describe("estimates in the plan files", () => {
  const plan = `# Login\n\n## Tasks\n\n- [x] Route ^t1\n  - estimate: 45m\n  - time spent: 1h 10m\n- [/] Callback ^t2\n  - state: with a helper\n  - estimate: 2h\n  - time spent: 15m\n  - timing since: 2026-10-26T09:00:00.000Z\n- [ ] Logout ^t3\n  - estimate: soon\n`;

  it("reads a Task's estimate, time spent and running clock, and gives back the same bytes", () => {
    const p = parsePlanFile(plan, "login");
    expect(p.tasks.map((t) => [t.id, t.estimate, t.spent, t.timingSince])).toEqual([
      ["t1", 45, 70, undefined],
      ["t2", 120, 15, "2026-10-26T09:00:00.000Z"],
      ["t3", undefined, 0, undefined],
    ]);
    expect(p.toString()).toBe(plan);
  });

  it("writes estimates in a fixed place among a Task's details", () => {
    const p = parsePlanFile(`# Login\n\n## Tasks\n`, "login");
    p.addTasks([{ title: "Route", summary: "Serve it.", code: ["a.ts"], estimate: 90 }]);
    expect(p.toString()).toBe(`# Login\n\n## Tasks\n\n- [ ] Route ^t1\n  - summary: Serve it.\n  - code: \`a.ts\`\n  - estimate: 1h 30m\n`);
    p.updateTask("t1", { estimate: null });
    expect(p.toString()).not.toContain("estimate");
  });

  it("reads a Goal's estimate and the helper limit from the Roadmap, and leaves them as written", () => {
    const text = `# Roadmap\n\n## Goals\n\n- [ ] [Login](goals/login.md) ^login\n  - estimate: 6h\n\n## Standing Instructions\n\n- At most 2 helpers in parallel ^s1\n  - hard: yes\n  - helpers at once: 2\n- Be brief ^s2\n  - helpers at once: many\n`;
    const roadmap = parseRoadmap(text);
    expect(roadmap.goal("login")!.estimate).toBe(360);
    expect(roadmap.standingInstructions.map((s) => s.helpersAtOnce)).toEqual([2, undefined]);
    expect(roadmap.toString()).toBe(text);
  });

  it("leaves an old plan without any of this unchanged when it is only read", () => {
    const old = `# Roadmap\n\n## Goals\n\n- [/] [Login](goals/login.md) ^login\n\n## Standing Instructions\n\n- Be brief ^s1\n`;
    const oldPlan = `# Login\n\n## Tasks\n\n- [x] Route ^t1\n- [/] Callback ^t2\n  - state: with a helper\n- [ ] Logout ^t3\n`;
    mkdirSync(join(root, ".progressor", "goals"), { recursive: true });
    writeFileSync(join(root, ".progressor", "roadmap.md"), old);
    writeFileSync(join(root, ".progressor", "goals", "login.md"), oldPlan);
    const p = agent();
    const schedule = p.schedule();
    expect(schedule.estimated).toBe(false);
    expect(schedule.unknown).toBe(2);
    expect(p.helperLoad()).toEqual({ busy: 1, limit: undefined, rule: undefined });
    expect(scheduleLines(schedule, ["login"])).toEqual([]);
    p.overview();
    expect(read("roadmap.md")).toBe(old);
    expect(read("goals/login.md")).toBe(oldPlan);
  });
});

describe("time spent on a Task", () => {
  it("runs from start or hand-off until done, and stops while the Task is paused", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route", estimate: 45 }]);
    p.claimGoal("login");
    p.startTask("t1");
    at("2026-10-26T10:20:00.000Z");
    p.setTaskState("t1", "pending"); // paused: 20 minutes so far
    expect(p.plan("login").task("t1")!.spent).toBe(20);
    expect(p.plan("login").task("t1")!.timingSince).toBeUndefined();
    at("2026-10-26T13:00:00.000Z"); // the pause does not count
    p.setTaskState("t1", "with a helper");
    at("2026-10-26T13:30:00.000Z");
    p.setTaskState("t1", "checked"); // still timed
    at("2026-10-26T13:50:00.000Z");
    p.completeTask("t1");
    expect(p.plan("login").task("t1")).toMatchObject({ status: "done", spent: 70, estimate: 45 });
    expect(read("goals/login.md")).toBe(`# Login\n\n## Tasks\n\n- [x] Route ^t1\n  - estimate: 45m\n  - time spent: 1h 10m\n`);
  });

  it("stops at released and at dropped, and keeps the time when a Task moves", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route" }, { title: "Logout" }, { title: "Docs" }]);
    p.addGoal("Docs", []);
    p.claimGoal("login");
    p.updateTasks([
      { action: "state", task: "t1", state: "with a helper" },
      { action: "state", task: "t2", state: "with a helper" },
      { action: "state", task: "t3", state: "with a helper" },
    ]);
    at("2026-10-26T10:30:00.000Z");
    p.setTaskState("t1", "released");
    p.dropTask("t2", "Not needed");
    const moved = p.moveTask("t3", "docs");
    expect(p.plan("login").tasks.map((t) => [t.id, t.spent, t.timingSince])).toEqual([
      ["t1", 30, undefined],
      ["t2", 30, undefined],
      ["t3", 30, undefined],
    ]);
    // The moved copy carries on with the same clock; the old one, dropped as a trace, keeps its time.
    expect(moved.timingSince).toBe("2026-10-26T10:00:00.000Z");
  });
});

describe("estimates through the tools", () => {
  let client: Client;
  beforeEach(async () => {
    const server = createServer(agent());
    const [c, s] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(s), client.connect(c)]);
  });
  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  }

  it("sets estimates on Goals and Tasks when adding and updating them", async () => {
    await call("add_goal", { title: "Login", estimate: "6h", claim: true, tasks: [{ title: "Route", estimate: "45m" }, { title: "Callback" }] });
    await call("add_tasks", { tasks: [{ title: "Logout", estimate: "1h 30m" }] });
    expect((await call("update_task", { task: "t2", estimate: "2h" })).text).toContain("Time: estimated 2 h");
    expect((await call("update_tasks", { operations: [{ action: "estimate", task: "t3", estimate: "1h" }] })).text).toContain("t3 Logout is pending, estimated 1 h");
    await call("update_goal", { goal: "login", estimate: "" });
    const plan = read("goals/login.md");
    expect(plan).toContain("- [ ] Route ^t1\n  - estimate: 45m\n- [ ] Callback ^t2\n  - estimate: 2h\n- [ ] Logout ^t3\n  - estimate: 1h");
    expect(read("roadmap.md")).not.toContain("estimate");
    const goal = (await call("get_item", { ref: "progressor://login" })).text;
    expect(goal).toContain("Estimate: 3 h 45 m from its open Tasks");
    expect(goal).toContain("Expected done in about 4 h");
  });

  it("refuses an estimate it cannot read, saying how to write one", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    const r = await call("update_task", { task: "t1", estimate: "a while" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/"45m", "2h" or "1h 30m"/);
  });

  it("warns, but still hands out the Task, when one more helper would pass the limit", async () => {
    await call("add_standing_instruction", { text: "At most 2 helpers in parallel", hard: true, helpers_at_once: 2 });
    expect(read("roadmap.md")).toContain("- At most 2 helpers in parallel ^s1\n  - hard: yes\n  - helpers at once: 2");
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "A" }, { title: "B" }, { title: "C" }] });
    const two = await call("update_tasks", { operations: [{ action: "state", task: "t1", state: "with a helper" }, { action: "state", task: "t2", state: "with a helper" }] });
    expect(two.text).not.toMatch(/Warning/);
    const three = await call("set_task_state", { task: "t3", state: "with a helper" });
    expect(three.isError).toBe(false);
    expect(three.text).toContain('Warning: 3 Tasks are now with a helper, over this project\'s limit of 2 at once (s1: "At most 2 helpers in parallel")');
    expect(read("goals/login.md")).toContain("- [/] C ^t3\n  - state: with a helper");
  });

  it("shows the limit in get_status and get_rules", async () => {
    await call("add_standing_instruction", { text: "At most 2 helpers in parallel", helpers_at_once: 2 });
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "A", estimate: "1h" }, { title: "B" }] });
    await call("set_task_state", { task: "t1", state: "with a helper" });
    const status = (await call("get_status")).text;
    expect(status).toContain("Helper limit: at most 2 Tasks with a helper at once; 1 now.");
    expect(status).toContain("Schedule: next login/t2 B · login done in about 1 h (1 Task not estimated).");
    expect(status).toContain("- s1 At most 2 helpers in parallel (limit: at most 2 Tasks with a helper at once)");
    const rules = (await call("get_rules")).text;
    expect(rules).toContain("Parallel limit: at most 2 helper agents work on this project at once");
    // Moving the limit to another rule takes it off the first.
    await call("add_standing_instruction", { text: "One helper at a time for now", helpers_at_once: 1 });
    expect(read("roadmap.md")).not.toContain("helpers at once: 2");
    expect((await call("update_standing_instruction", { id: "s2", helpers_at_once: 0 })).text).toBe("Changed Standing Instruction s2: One helper at a time for now");
    expect((await call("get_status")).text).not.toContain("Helper limit");
  });

  it("says how long a completed Task took against its estimate", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route", estimate: "45m" }] });
    await call("start_task", { task: "t1" });
    at("2026-10-26T11:10:00.000Z");
    expect((await call("complete_task", { task: "t1" })).text.split("\n").slice(0, 2)).toEqual(["Done: t1 Route.", "Time: t1 took 1 h 10 m, estimated 45 m."]);
    expect((await call("get_item", { ref: "progressor://login/t1" })).text).toContain("Time: took 1 h 10 m, estimated 45 m");
  });
});

describe("the status line", () => {
  it("names the next Task, each held Goal's finish and the Roadmap's", () => {
    const s = computeSchedule(
      [
        { goal: { id: "a", title: "A", status: "active" }, tasks: [{ id: "t1", title: "One", status: "pending", estimate: 120, spent: 0 }] },
        { goal: { id: "b", title: "B", status: "planned" }, tasks: [{ id: "t1", title: "Two", status: "pending", spent: 0 }] },
      ],
      undefined,
      new Date(),
    );
    expect(scheduleLines(s, ["a"])).toEqual(["Schedule: next a/t1 One · a done in about 2 h · Roadmap done in about 2 h (1 Task not estimated)."]);
  });

  it("rules without a limit say nothing about one", () => {
    expect(formatRules([{ id: "s1", ref: undefined, text: "Be brief", line: 1, hard: false }])).not.toContain("Parallel");
  });
});
