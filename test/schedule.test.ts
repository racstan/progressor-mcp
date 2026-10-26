import { describe, expect, it } from "vitest";
import { type PlannedGoal, computeSchedule } from "../src/schedule.js";
import type { TaskStatus } from "../src/planFile.js";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function task(id: string, status: TaskStatus, estimate?: number, extra: { spent?: number; timingSince?: string } = {}) {
  return { id, title: `Task ${id}`, status, ...(estimate !== undefined ? { estimate } : {}), spent: extra.spent ?? 0, ...(extra.timingSince ? { timingSince: extra.timingSince } : {}) };
}

function goal(id: string, tasks: PlannedGoal["tasks"], options: { status?: string; estimate?: number } = {}): PlannedGoal {
  return {
    goal: { id, title: `Goal ${id}`, status: (options.status ?? "active") as PlannedGoal["goal"]["status"], ...(options.estimate !== undefined ? { estimate: options.estimate } : {}) },
    tasks,
  };
}

describe("the schedule", () => {
  it("runs one Task at a time without a limit or anything running, in Roadmap and Task order", () => {
    const s = computeSchedule([goal("a", [task("t1", "pending", 30), task("t2", "pending", 60)]), goal("b", [task("t1", "pending", 45)], { status: "planned" })], undefined, NOW);
    expect(s.capacity).toBe(1);
    expect(s.goals.map((g) => [g.id, g.finish, g.unknown, g.estimate])).toEqual([
      ["a", 90, 0, 90],
      ["b", 135, 0, 45],
    ]);
    expect(s.finish).toBe(135);
    expect(s.next.map((t) => `${t.goal}/${t.id}`)).toEqual(["a/t1"]);
    expect(s.estimated).toBe(true);
  });

  it("runs at most the helper limit at once, starting each next Task as a slot frees", () => {
    const s = computeSchedule(
      [goal("a", [task("t1", "with a helper", 60, { timingSince: minutesAgo(20) }), task("t2", "pending", 30), task("t3", "pending", 30), task("t4", "pending", 30)])],
      2,
      NOW,
    );
    expect(s.capacity).toBe(2);
    expect(s.helpers).toBe(1);
    expect(s.running.map((t) => [t.id, t.left])).toEqual([["t1", 40]]);
    // t2 starts now in the free slot, t3 when t2 ends at 30, t4 when t1 ends at 40.
    expect(s.next.map((t) => [t.id, t.start])).toEqual([["t2", 0], ["t3", 30]]);
    expect(s.goals[0]!.finish).toBe(70);
  });

  it("keeps the Tasks already running beyond the limit, and starts no more until it is below it", () => {
    const helper = (id: string, estimate: number) => task(id, "with a helper", estimate, { timingSince: NOW.toISOString() });
    const s = computeSchedule([goal("a", [helper("t1", 30), helper("t2", 60), helper("t3", 90), task("t4", "pending", 10)])], 2, NOW);
    expect(s.helpers).toBe(3);
    // Two slots are free again only once t2 is done, at 60.
    expect(s.next[0]).toMatchObject({ id: "t4", start: 60, end: 70 });
    expect(s.finish).toBe(90);
  });

  it("without a limit, keeps as many running at once as run now", () => {
    const s = computeSchedule([goal("a", [task("t1", "in progress", 30), task("t2", "with a helper", 30), task("t3", "pending", 30)])], undefined, NOW);
    expect(s.capacity).toBe(2);
    expect(s.finish).toBe(60);
  });

  it("counts Tasks without an estimate as unknown instead of guessing", () => {
    const s = computeSchedule([goal("a", [task("t1", "pending", 60), task("t2", "pending"), task("t3", "pending")]), goal("b", [task("t1", "pending")])], undefined, NOW);
    expect(s.goals.map((g) => [g.id, g.finish, g.unknown])).toEqual([
      ["a", 60, 2],
      ["b", 60, 1],
    ]);
    expect(s.unknown).toBe(3);
    expect(s.goals[1]!.estimate).toBeUndefined();
  });

  it("is not estimated at all when nothing has an estimate", () => {
    const s = computeSchedule([goal("a", [task("t1", "pending")])], undefined, NOW);
    expect(s.estimated).toBe(false);
    expect(s.unknown).toBe(1);
  });

  it("takes off the time already spent, and flags a Task past its estimate", () => {
    const s = computeSchedule(
      [goal("a", [task("t1", "in progress", 45, { spent: 30, timingSince: minutesAgo(40) }), task("t2", "pending", 60, { spent: 15 })])],
      undefined,
      NOW,
    );
    expect(s.running[0]).toMatchObject({ id: "t1", left: 0, over: true });
    expect(s.goals[0]!.finish).toBe(45);
  });

  it("lets a Goal's own estimate cover its Tasks that have none, and stand for a Goal not broken down yet", () => {
    const s = computeSchedule(
      [
        goal("a", [task("t1", "pending", 60), task("t2", "pending"), task("t3", "pending")], { estimate: 180 }),
        goal("b", [], { status: "planned", estimate: 120 }),
      ],
      undefined,
      NOW,
    );
    expect(s.goals.map((g) => [g.id, g.finish, g.unknown, g.estimate, g.estimateSet])).toEqual([
      ["a", 180, 0, 180, true],
      ["b", 300, 0, 120, true],
    ]);
  });

  it("adds no time for Tasks waiting on the Developer or checked, and skips finished work and Goals", () => {
    const s = computeSchedule(
      [
        goal("a", [task("t1", "done", 60), task("t2", "waiting on you", 60), task("t3", "checked", 30), task("t4", "dropped", 30)]),
        goal("b", [task("t1", "pending", 60)], { status: "done" }),
      ],
      undefined,
      NOW,
    );
    expect(s.goals.map((g) => [g.id, g.finish, g.unknown])).toEqual([["a", 0, 0]]);
    expect(s.running).toEqual([]);
  });
});
