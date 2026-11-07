import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listHistory } from "../src/history.js";
import { Project } from "../src/project.js";
import { dueRoutines, everyWords, nextDue, parseEvery } from "../src/routines.js";
import { writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

let root: string;
let clock: Date;
const agent = (id = "s", pid = process.pid) => new Project({ root, session: { id, pid }, isAlive: (p) => p === process.pid, now: () => clock });
const roadmapText = () => readFileSync(join(root, ".progressor", "roadmap.md"), "utf8");
const savedTZ = process.env.TZ;

beforeEach(() => {
  root = tempDir("progressor-routines-");
  process.env.TZ = "Europe/Amsterdam";
  clock = new Date("2026-11-02T08:00:00.000Z"); // a Monday, 09:00 in Amsterdam
});

afterEach(() => {
  if (savedTZ === undefined) delete process.env.TZ;
  else process.env.TZ = savedTZ;
});

describe("how often a routine comes back", () => {
  it("reads days, weeks, months and weekdays", () => {
    expect(parseEvery("1d")).toEqual({ kind: "days", n: 1 });
    expect(parseEvery("1w")).toEqual({ kind: "days", n: 7 });
    expect(parseEvery("2w")).toEqual({ kind: "days", n: 14 });
    expect(parseEvery("1mo")).toEqual({ kind: "months", n: 1 });
    expect(parseEvery("monday")).toEqual({ kind: "weekday", day: 1 });
    expect(parseEvery(" Friday ")).toEqual({ kind: "weekday", day: 5 });
    expect(parseEvery("weekly")).toEqual({ kind: "days", n: 7 });
    expect(parseEvery("fortnightly")).toEqual({ kind: "days", n: 14 });
    expect(parseEvery("every 3d")).toEqual({ kind: "days", n: 3 });
    for (const bad of ["", "0d", "sometimes", "1y", "-1w", "mo"]) expect(parseEvery(bad)).toBeUndefined();
  });

  it("says it in plain words", () => {
    expect(everyWords("1d")).toBe("every day");
    expect(everyWords("1w")).toBe("every week");
    expect(everyWords("2w")).toBe("every 2 weeks");
    expect(everyWords("1mo")).toBe("every month");
    expect(everyWords("monday")).toBe("every Monday");
  });

  it("keeps the same time of day across a clock change", () => {
    // Summer time starts in Amsterdam on 29 March 2026: 09:00 is 08:00Z before and 07:00Z after.
    expect(nextDue(parseEvery("1d")!, new Date("2026-03-28T08:00:00.000Z")).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    // It ends on 25 October 2026.
    expect(nextDue(parseEvery("1w")!, new Date("2026-10-20T07:00:00.000Z")).toISOString()).toBe("2026-10-27T08:00:00.000Z");
    expect(nextDue(parseEvery("1mo")!, new Date("2026-03-15T08:00:00.000Z")).toISOString()).toBe("2026-04-15T07:00:00.000Z");
  });

  it("keeps a month's end inside the next month", () => {
    expect(nextDue(parseEvery("1mo")!, new Date("2026-01-31T08:00:00.000Z")).toISOString()).toBe("2026-02-28T08:00:00.000Z");
  });

  it("comes back at the start of the named weekday", () => {
    // Wednesday 4 November → Monday 9 November, midnight in Amsterdam.
    expect(nextDue(parseEvery("monday")!, new Date("2026-11-04T12:00:00.000Z")).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    // On a Monday, the next one is a week later.
    expect(nextDue(parseEvery("monday")!, new Date("2026-11-02T08:00:00.000Z")).toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });
});

describe("routines in the plan", () => {
  const audit = () => {
    const p = agent();
    p.addGoal("Weekly dependency audit", [{ title: "Run npm audit", estimate: 30 }, { title: "Update what is safe", estimate: 60 }], { outcome: "No known holes in the dependencies." });
    return { p, routine: p.repeatGoal("weekly-dependency-audit", "1w") };
  };

  it("writes a Routines section and marks the goal as made from it", () => {
    const { p, routine } = audit();
    expect(routine.id).toBe("r1");
    const text = roadmapText();
    expect(text).toContain(
      "## Routines\n\n- Weekly dependency audit ^r1\n  - every: 1w\n  - next: 2026-11-09T08:00:00.000Z\n  - outcome: No known holes in the dependencies.\n  - step: Run npm audit (30m)\n  - step: Update what is safe (1h)\n  - last goal: weekly-dependency-audit\n",
    );
    expect(text).toContain("  - from routine: r1\n");
    expect(p.roadmap().goal("weekly-dependency-audit")!.fromRoutine).toBe("r1");
    expect(p.routines()).toMatchObject([{ id: "r1", title: "Weekly dependency audit", every: "1w", paused: false, lastGoal: "weekly-dependency-audit" }]);
  });

  it("refuses a pace it can't read", () => {
    const p = agent();
    p.addGoal("Audit");
    expect(() => p.repeatGoal("audit", "sometimes")).toThrow(/1d, 1w, 2w, 1mo or a weekday/);
  });

  it("is not due before its time", () => {
    const { p } = audit();
    clock = new Date("2026-11-09T07:59:00.000Z");
    expect(p.runRoutines()).toEqual([]);
  });

  it("never stacks: no new goal while the last one is still open", () => {
    const { p } = audit();
    clock = new Date("2026-11-09T09:00:00.000Z");
    expect(dueRoutines(p.roadmap(), clock)).toEqual([]);
    expect(p.runRoutines()).toEqual([]);
    p.dropGoal("weekly-dependency-audit", "not this week");
    expect(dueRoutines(p.roadmap(), clock).map((r) => r.id)).toEqual(["r1"]);
    const made = p.runRoutines();
    expect(made.map((g) => g.id)).toEqual(["weekly-dependency-audit-2"]);
    expect(p.runRoutines()).toEqual([]);
  });

  it("makes the goal with the routine's outcome and steps, and moves next past now", () => {
    const { p } = audit();
    p.dropGoal("weekly-dependency-audit", "skip");
    clock = new Date("2026-12-01T10:00:00.000Z"); // several weeks missed: still only one goal
    const [made] = p.runRoutines();
    expect(made).toMatchObject({ title: "Weekly dependency audit", outcome: "No known holes in the dependencies.", fromRoutine: "r1", status: "planned" });
    expect(p.plan(made!.id).tasks.map((t) => [t.title, t.estimate])).toEqual([["Run npm audit", 30], ["Update what is safe", 60]]);
    const r = p.routines()[0]!;
    expect(r.lastGoal).toBe(made!.id);
    expect(r.next).toBe("2026-12-07T08:00:00.000Z");
  });

  it("two processes running it at once make one goal", () => {
    audit().p.dropGoal("weekly-dependency-audit", "skip");
    clock = new Date("2026-11-10T08:00:00.000Z");
    const a = agent("s-a");
    const b = new Project({ root, session: { id: "dashboard", pid: process.pid }, actor: "AI", clearStaleClaims: false, now: () => clock });
    const made = [...a.runRoutines(), ...b.runRoutines(), ...a.runRoutines()];
    expect(made).toHaveLength(1);
    expect(agent().roadmap().goals.filter((g) => g.fromRoutine === "r1" && g.status === "planned")).toHaveLength(1);
  });

  it("is one change in the plan's history, made by the AI", () => {
    const { p } = audit();
    p.dropGoal("weekly-dependency-audit", "skip");
    clock = new Date("2026-11-10T08:00:00.000Z");
    const before = listHistory(p.historyDir).length;
    p.runRoutines();
    const items = listHistory(p.historyDir);
    expect(items.length).toBe(before + 1);
    expect(items.at(-1) ?? items[0]).toBeDefined();
    const last = items.find((i) => i.label.startsWith("Routine"));
    expect(last).toMatchObject({ actor: "AI", label: "Routine: Weekly dependency audit" });
  });

  it("a paused routine waits; resumed, it comes back; stopped, it is gone", () => {
    const { p } = audit();
    p.dropGoal("weekly-dependency-audit", "skip");
    p.pauseRoutine("r1", true);
    expect(roadmapText()).toContain("  - paused: yes\n");
    clock = new Date("2026-11-10T08:00:00.000Z");
    expect(p.runRoutines()).toEqual([]);
    p.pauseRoutine("r1", false);
    expect(roadmapText()).not.toContain("paused");
    expect(p.runRoutines()).toHaveLength(1);
    p.stopRoutine("r1");
    expect(p.routines()).toEqual([]);
    expect(roadmapText()).not.toContain("^r1");
    expect(() => p.stopRoutine("r1")).toThrow(/No routine r1/);
  });

  it("dropping a goal with stop repeating stops its routine", () => {
    const { p } = audit();
    p.dropGoal("weekly-dependency-audit", "no longer needed", { stopRepeating: true });
    expect(p.routines()).toEqual([]);
    clock = new Date("2027-01-01T08:00:00.000Z");
    expect(p.runRoutines()).toEqual([]);
  });
});

describe("routines through the AI's tools", () => {
  async function connect(settingsFile = join(tempDir("progressor-set-"), "settings.json")) {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../src/server.js");
    const server = createServer(agent(), { settingsFile });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await server.connect(x);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(y);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
    };
  }

  it("add_goal with repeat makes a routine; get_status says in one line when it adds the next goal", async () => {
    const call = await connect();
    const added = await call("add_goal", { title: "Audit", tasks: [{ title: "Run npm audit", estimate: "30m" }], repeat: "1w" });
    expect(added.isError).toBe(false);
    expect(added.text).toContain("Comes back every week (routine r1).");
    expect((await call("get_status")).text).not.toContain("Routine");
    await call("drop_goal", { goal: "audit", reason: "skip" });
    clock = new Date("2026-11-10T08:00:00.000Z");
    const status = (await call("get_status")).text;
    expect(status.split("\n").filter((l) => l.startsWith("Routine r1"))).toEqual(['Routine r1 added goal audit-2 "Audit" (every week).']);
    expect(status).toContain("audit-2");
    expect((await call("get_status")).text).not.toContain("Routine r1 added");
  });

  it("a bad repeat is refused before anything is added", async () => {
    const call = await connect();
    const r = await call("add_goal", { title: "Audit", repeat: "sometimes" });
    expect(r.isError).toBe(true);
    expect(agent().roadmap().goals).toEqual([]);
  });

  it("drop_goal with stop_repeating stops the routine", async () => {
    const call = await connect();
    await call("add_goal", { title: "Audit", repeat: "1d" });
    const r = await call("drop_goal", { goal: "audit", reason: "done with it", stop_repeating: true });
    expect(r.text).toContain("It won't come back.");
    expect(agent().routines()).toEqual([]);
  });

  it("makes nothing while routines are turned off in settings", async () => {
    const settings = join(tempDir("progressor-set-"), "settings.json");
    const call = await connect(settings);
    await call("add_goal", { title: "Audit", repeat: "1d" });
    await call("drop_goal", { goal: "audit", reason: "skip" });
    writeSettings(settings, "routines", { enabled: false });
    clock = new Date("2026-11-10T08:00:00.000Z");
    expect((await call("get_status")).text).not.toContain("Routine r1");
    expect(agent().roadmap().goals).toHaveLength(1);
  });
});

describe("routines on the dashboard", () => {
  it("the dashboard's timer adds a due goal as the AI, unless the settings say not to", async () => {
    const { runRoutinesIn } = await import("../src/dashboard/routes/routines.js");
    const settings = join(tempDir("progressor-set-"), "settings.json");
    const p = agent();
    p.addGoal("Audit");
    p.repeatGoal("audit", "1d");
    p.dropGoal("audit", "skip");
    clock = new Date("2026-11-04T08:00:00.000Z");
    writeSettings(settings, "routines", { createFromDashboard: false });
    expect(runRoutinesIn(root, settings, () => clock)).toBe(0);
    writeSettings(settings, "routines", { createFromDashboard: true });
    expect(runRoutinesIn(root, settings, () => clock)).toBe(1);
    expect(runRoutinesIn(root, settings, () => clock)).toBe(0);
    expect(listHistory(p.historyDir).at(-1)).toMatchObject({ actor: "AI", label: "Routine: Audit" });
    expect(runRoutinesIn(tempDir("progressor-empty-"), settings)).toBe(0);
  });

  it("lists them, and pauses, resumes and stops one only from the dashboard's own page", async () => {
    const p = agent();
    p.addGoal("Audit", [{ title: "Run npm audit" }]);
    p.repeatGoal("audit", "monday");
    const { startDashboard } = await import("../src/dashboard/http.js");
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const dash = await startDashboard({ project: agent(), registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const id = (await (await fetch(new URL("/api/projects", dash.url!))).json())[0].id as string;
      const list = new URL(`/api/projects/${id}/routines`, dash.url!);
      const listed = (await (await fetch(list)).json()).routines;
      expect(listed).toMatchObject([{ id: "r1", title: "Audit", every: "monday", words: "every Monday", paused: false, lastGoal: "audit", steps: ["Run npm audit"] }]);
      const send = (action: string, headers: Record<string, string> = {}) =>
        fetch(new URL(`/api/projects/${id}/routines/r1/${action}`, dash.url!), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });
      const own = { origin: new URL(dash.url!).origin, "x-progressor": "routines" };
      expect((await send("pause")).status).toBe(403);
      expect((await send("pause", own)).status).toBe(200);
      expect((await (await fetch(list)).json()).routines[0].paused).toBe(true);
      expect((await send("resume", own)).status).toBe(200);
      expect((await (await fetch(list)).json()).routines[0].paused).toBe(false);
      expect((await send("stop", own)).status).toBe(200);
      expect((await (await fetch(list)).json()).routines).toEqual([]);
      expect((await send("stop", own)).status).toBe(404);
      expect(listHistory(agent().historyDir).at(-1)).toMatchObject({ actor: "Developer" });
    } finally {
      await dash.close();
    }
  });
});
