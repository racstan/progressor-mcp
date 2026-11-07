import { describe, expect, it } from "vitest";
import { calibration, type StatsGoal, type StatsTask } from "../src/stats.js";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function step(n: number, estimate: number | undefined, spent: number, ago = n, status: StatsTask["status"] = "done"): StatsTask {
  return { id: `t${n}`, title: `Step ${n}`, status, ...(estimate !== undefined ? { estimate } : {}), spent, finishedAt: daysAgo(ago) };
}
const goal = (tasks: StatsTask[]): StatsGoal => ({ id: "g", title: "G", status: "active", tasks, detours: [] });
const OPTIONS = { window: 20, min: 5 };

describe("calibration", () => {
  it("has no factor with fewer than 5 samples", () => {
    const r = calibration([goal([1, 2, 3, 4].map((n) => step(n, 60, 120)))], NOW, OPTIONS);
    expect(r.samples).toBe(4);
    expect(r.factor).toBeUndefined();
  });

  it("is the median of time spent over the estimate", () => {
    const spent = [30, 60, 90, 120, 150];
    const r = calibration([goal(spent.map((s, i) => step(i + 1, 60, s)))], NOW, OPTIONS);
    expect(r.samples).toBe(5);
    expect(r.factor).toBeCloseTo(1.5);
  });

  it("averages the middle two of an even number", () => {
    const r = calibration([goal([60, 60, 60, 120, 120, 120].map((s, i) => step(i + 1, 60, s)))], NOW, OPTIONS);
    expect(r.factor).toBeCloseTo(1.5);
  });

  it("clamps to 0.5 and 3", () => {
    expect(calibration([goal([1, 2, 3, 4, 5].map((n) => step(n, 60, 6)))], NOW, OPTIONS).factor).toBe(0.5);
    expect(calibration([goal([1, 2, 3, 4, 5].map((n) => step(n, 10, 600)))], NOW, OPTIONS).factor).toBe(3);
  });

  it("uses only the most recent finished steps within the window", () => {
    const old = [1, 2, 3, 4, 5].map((n) => step(n, 60, 300, 100 + n));
    const recent = [1, 2, 3, 4, 5].map((n) => step(10 + n, 60, 60, n));
    const r = calibration([goal([...old, ...recent])], NOW, { window: 5, min: 5 });
    expect(r.samples).toBe(5);
    expect(r.factor).toBe(1);
  });

  it("skips steps without an estimate, without time, or not finished", () => {
    const tasks = [step(1, undefined, 60), step(2, 60, 0), step(3, 60, 90, 3, "in progress"), step(4, 60, 90, 4, "dropped")];
    expect(calibration([goal(tasks)], NOW, OPTIONS).samples).toBe(0);
  });

  it("counts released steps and steps across goals", () => {
    const a = goal([1, 2, 3].map((n) => step(n, 60, 60)));
    const b = goal([4, 5].map((n) => step(n, 60, 60, n, "released")));
    expect(calibration([a, b], NOW, OPTIONS).samples).toBe(5);
  });
});
