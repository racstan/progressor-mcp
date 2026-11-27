// Waiting time per step: who a step waited on and for how long, kept on the step and shown as totals.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { DEVELOPER, formatWaited, openWait, parseWaited, stepWaitLine, stepWaits, waitLine, waitTotals } from "../src/waits.js";
import { tempDir } from "./tmp.js";

// Local times, so "today" is the same wherever the tests run.
const at = (h: number, m = 0, day = 27) => new Date(2026, 10, day, h, m);
const iso = (d: Date) => d.toISOString();

describe("the waited line on a step", () => {
  it("writes and reads stretches, names with spaces included", () => {
    const waits = [
      { who: "Stripe support", at: iso(at(12, 10)), minutes: 20 },
      { who: "CI", at: iso(at(10)), minutes: 95 },
    ];
    const text = formatWaited(waits);
    expect(text).toBe(`Stripe support ${iso(at(12, 10))} 20m; CI ${iso(at(10))} 1h 35m`);
    expect(parseWaited(text)).toEqual(waits);
  });

  it("keeps the newest 20 and skips what cannot be read", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ who: "CI", at: iso(at(1, i)), minutes: 1 }));
    expect(parseWaited(formatWaited(many))).toHaveLength(20);
    expect(parseWaited("junk; CI nope 5m; ")).toEqual([]);
  });

  it("turns a semicolon in a name into a comma", () => {
    expect(parseWaited(formatWaited([{ who: "A; B", at: iso(at(9)), minutes: 5 }]))[0]!.who).toBe("A, B");
  });
});

describe("totals", () => {
  const tasks = [
    { waits: [{ who: "CI", at: iso(at(9)), minutes: 60 }, { who: "CI", at: iso(at(10, 0, 26)), minutes: 170 }] },
    { waits: [{ who: DEVELOPER, at: iso(at(11)), minutes: 20 }] },
    { waits: [], waitingSince: { who: "CI", at: iso(at(13)) } },
  ];
  const now = at(13, 10);

  it("counts an open stretch up to now", () => {
    expect(stepWaits(tasks[2]!, now)).toEqual([{ who: "CI", at: iso(at(13)), minutes: 10, open: true }]);
    expect(openWait(tasks[2]!, now)?.minutes).toBe(10);
  });

  it("adds up by who, biggest first, with what falls today", () => {
    expect(waitTotals(tasks, now)).toEqual([
      { who: "CI", minutes: 240, today: 70 },
      { who: DEVELOPER, minutes: 20, today: 20 },
    ]);
  });

  it("counts only the part of an old stretch that falls today", () => {
    const crossing = [{ waits: [{ who: "CI", at: iso(at(23, 0, 26)), minutes: 120 }] }];
    expect(waitTotals(crossing, now)).toEqual([{ who: "CI", minutes: 120, today: 60 }]);
  });

  it("says it in plain words, and says nothing when there is nothing", () => {
    expect(waitLine(waitTotals(tasks, now))).toBe("Waited: 4 h on CI (1 h 10 m today), 20 m on the Developer (20 m today)");
    expect(waitLine(waitTotals([{ waits: [{ who: "CI", at: iso(at(9, 0, 20)), minutes: 230 }] }], now))).toBe("Waited: 3 h 50 m on CI");
    expect(waitLine([])).toBeUndefined();
  });

  it("says each stretch in plain words", () => {
    expect(stepWaitLine({ who: "CI", at: iso(at(10)), minutes: 45 })).toBe("Waited on CI for 45 m");
    expect(stepWaitLine({ who: DEVELOPER, at: iso(at(10)), minutes: 20 })).toBe("Waited on the Developer for 20 m");
    expect(stepWaitLine({ who: "CI", at: iso(at(10)), minutes: 10, open: true })).toBe("Waiting on CI for 10 m so far");
  });
});

describe("recording stretches as a step changes state", () => {
  let root: string;
  let now: Date;
  let p: Project;
  const plan = () => readFileSync(join(root, ".progressor", "goals", "login.md"), "utf8");
  const step = () => p.plan("login").tasks.find((t) => t.id === "t1")!;

  beforeEach(() => {
    root = tempDir("progressor-waits-");
    now = at(10);
    p = new Project({ root, session: { id: "s", pid: process.pid }, now: () => now });
    p.addGoal("Login", [{ title: "Route" }, { title: "Page" }]);
    p.claimGoal("login");
  });

  it("records a stretch when the step leaves waiting on someone", () => {
    p.setTaskState("t1", "waiting on someone", "login", { person: "CI", need: "finish the run" });
    now = at(10, 45);
    expect(step().waitingSince?.who).toBe("CI");
    p.setTaskState("t1", "in progress", "login");
    expect(step().waits).toEqual([{ who: "CI", at: iso(at(10)), minutes: 45 }]);
    expect(step().waitingSince).toBeUndefined();
    expect(plan()).toMatch(/- waited: CI \S+ 45m/);
    expect(plan()).not.toMatch(/waiting since/);
  });

  it("records the Developer for waiting on you, and closes it when the step is done", () => {
    p.setTaskState("t1", "waiting on you", "login");
    now = at(10, 20);
    p.completeTask("t1", [], undefined, "login");
    expect(step().waits).toEqual([{ who: DEVELOPER, at: iso(at(10)), minutes: 20 }]);
  });

  it("closes the stretch and opens another when it changes who it waits on", () => {
    p.setTaskState("t1", "waiting on you", "login");
    now = at(10, 30);
    p.setTaskState("t1", "waiting on someone", "login", { person: "CI" });
    now = at(11);
    p.setTaskState("t1", "waiting on someone", "login", { person: "Stripe support" });
    expect(step().waits).toEqual([
      { who: "CI", at: iso(at(10, 30)), minutes: 30 },
      { who: DEVELOPER, at: iso(at(10)), minutes: 30 },
    ]);
    expect(step().waitingSince).toEqual({ who: "Stripe support", at: iso(at(11)) });
  });

  it("keeps the stretch running when the same person is set again", () => {
    p.setTaskState("t1", "waiting on someone", "login", { person: "CI" });
    now = at(10, 30);
    p.setTaskState("t1", "waiting on someone", "login", { person: "ci", need: "still running" });
    expect(step().waits ?? []).toEqual([]);
    expect(step().waitingSince?.at).toBe(iso(at(10)));
  });

  it("closes a stretch when the step is dropped, and skips one under half a minute", () => {
    p.setTaskState("t1", "waiting on you", "login");
    now = at(10, 5);
    p.dropTask("t1", "not needed", "login");
    expect(step().waits).toEqual([{ who: DEVELOPER, at: iso(at(10)), minutes: 5 }]);
    p.setTaskState("t2", "waiting on you", "login");
    p.setTaskState("t2", "pending", "login");
    expect(p.plan("login").tasks.find((t) => t.id === "t2")!.waits ?? []).toEqual([]);
  });

  it("keeps the newest 20 stretches on a step", () => {
    for (let i = 0; i < 22; i++) {
      now = at(1, i * 2);
      p.setTaskState("t1", "waiting on you", "login");
      now = at(1, i * 2 + 1);
      p.setTaskState("t1", "in progress", "login");
    }
    expect(step().waits).toHaveLength(20);
    expect(step().waits![0]!.at).toBe(iso(at(1, 42)));
  });

  it("leaves the time spent alone", () => {
    p.startTask("t1", "login");
    now = at(10, 10);
    p.setTaskState("t1", "waiting on you", "login");
    now = at(10, 40);
    p.setTaskState("t1", "in progress", "login");
    now = at(11);
    p.completeTask("t1", [], undefined, "login");
    expect(step().spent).toBe(60);
  });
});

describe("what the AI sees", () => {
  let root: string;
  let now: Date;
  let p: Project;
  let call: (name: string, args?: Record<string, unknown>) => Promise<string>;

  beforeEach(async () => {
    root = tempDir("progressor-waits-tool-");
    now = at(14);
    p = new Project({ root, session: { id: "s", pid: process.pid }, now: () => now });
    p.addGoal("Login", [{ title: "Route" }, { title: "Page" }]);
    p.claimGoal("login");
    p.setTaskState("t1", "waiting on someone", "login", { person: "CI" });
    now = at(14, 45);
    p.setTaskState("t1", "in progress", "login");
    p.setTaskState("t2", "waiting on you", "login");
    now = at(15);
    const server = createServer(p, { servers: () => [] });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(b), client.connect(a)]);
    call = async (name, args = {}) => ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
  });

  it("lists a step's waits in get_item, an open one counted to now", async () => {
    expect(await call("get_item", { ref: "progressor://login/t1" })).toContain("Waits:\n- Waited on CI for 45 m");
    expect(await call("get_item", { ref: "progressor://login/t2" })).toContain("Waits:\n- Waiting on the Developer for 15 m so far");
  });

  it("gives totals for a goal in get_item and get_status, only when there is any", async () => {
    const line = "Waited: 45 m on CI (45 m today), 15 m on the Developer (15 m today)";
    expect(await call("get_item", { ref: "progressor://login" })).toContain(line);
    expect(await call("get_status")).toContain(line);
    const quiet = new Project({ root: tempDir("progressor-waits-quiet-"), session: { id: "q", pid: process.pid }, now: () => now });
    quiet.addGoal("Plain", [{ title: "One" }]);
    quiet.claimGoal("plain");
    expect(quiet.sessionStatus().held[0]!.waited).toBeUndefined();
  });
});
