import { describe, expect, it } from "vitest";
import { type StatsGoal, type StatsTask, projectStats } from "../src/stats.js";

// Local times, so the days match wherever the tests run.
const at = (day: number, h = 12, m = 0) => new Date(2026, 9, day, h, m).toISOString();
const NOW = new Date(2026, 9, 28, 16, 0);

const task = (id: string, status: StatsTask["status"], extra: Partial<StatsTask> = {}): StatsTask => ({ id, title: id.toUpperCase(), status, spent: 0, ...extra });
const goal = (id: string, status: StatsGoal["status"], tasks: StatsTask[], detours: StatsGoal["detours"] = []): StatsGoal => ({ id, title: id, status, tasks, detours });

const plan: StatsGoal[] = [
  goal("login", "done", [
    task("t1", "done", { estimate: 60, spent: 90, finishedAt: at(27, 10) }),
    task("t2", "released", { estimate: 30, spent: 20, finishedAt: at(28, 9) }),
    task("t3", "dropped", { droppedBy: "d1" }),
    task("t4", "done", { spent: 15, addedBy: "d1", updated: { at: at(28, 11) } }),
  ], [{ status: "recalibrated" }]),
  goal("voice", "active", [
    task("t1", "in progress", { estimate: 45, spent: 10, timingSince: new Date(NOW.getTime() - 20 * 60_000).toISOString() }),
    task("t2", "pending", { estimate: 30 }),
  ], [{ status: "merged back" }, { status: "open" }]),
  goal("old", "dropped", [task("t1", "done", { spent: 5, finishedAt: at(1) })]),
];

describe("statistics from the plan", () => {
  const s = projectStats(plan, NOW);

  it("counts goals and steps", () => {
    expect(s.goals).toEqual({ finished: 1, open: 1, cancelled: 1 });
    expect(s.steps).toEqual({ done: 4, open: 2, cancelled: 1 });
  });

  it("adds up the time worked, counting a step still running up to now", () => {
    expect(s.time.spent).toBe(90 + 20 + 15 + 30 + 5);
  });

  it("compares finished steps that have both an estimate and a time against their estimates", () => {
    expect(s.time.compared).toEqual({ steps: 2, estimated: 90, spent: 110, withinEstimate: 1 });
  });

  it("says how often work drifted: side trips, how they ended, steps added after one and steps cancelled", () => {
    expect(s.drift).toEqual({
      sideTrips: 3,
      goalsWithSideTrips: 2,
      goals: 2,
      endings: { "merged back": 1, returned: 0, recalibrated: 1, open: 1 },
      stepsAdded: 1,
      stepsCancelled: 1,
    });
  });

  it("counts steps finished on each of the last 14 days, oldest first, using when an older step last changed", () => {
    expect(s.perDay).toHaveLength(14);
    expect(s.perDay.at(-1)).toEqual({ day: "2026-10-28", count: 2 });
    expect(s.perDay.at(-2)).toEqual({ day: "2026-10-27", count: 1 });
    expect(s.perDay[0]).toEqual({ day: "2026-10-15", count: 0 });
    expect(s.perDay.reduce((n, d) => n + d.count, 0)).toBe(3); // the one on 1 Oct is too old
  });

  it("lists the longest finished steps", () => {
    expect(s.longest.map((l) => [l.goal, l.id, l.spent, l.estimate])).toEqual([
      ["login", "t1", 90, 60],
      ["login", "t2", 20, 30],
      ["login", "t4", 15, undefined],
      ["old", "t1", 5, undefined],
    ]);
  });

  it("gives a line per goal that was not cancelled", () => {
    expect(s.perGoal).toEqual([
      { id: "login", title: "login", status: "done", done: 3, total: 3, spent: 125, estimate: 90, sideTrips: 1 },
      { id: "voice", title: "voice", status: "active", done: 0, total: 2, spent: 30, estimate: 75, sideTrips: 2 },
    ]);
  });

  it("is all zeros for an empty plan", () => {
    const e = projectStats([], NOW);
    expect(e.steps).toEqual({ done: 0, open: 0, cancelled: 0 });
    expect(e.time.compared.steps).toBe(0);
    expect(e.perDay.every((d) => d.count === 0)).toBe(true);
    expect(e.longest).toEqual([]);
  });
});
