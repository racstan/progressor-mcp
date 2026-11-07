import { describe, expect, it } from "vitest";
import { type CalendarEvent, calendarEvents } from "../src/calendar.js";
import type { HandTest, Task } from "../src/planFile.js";
import type { Goal } from "../src/roadmap.js";
import type { Routine } from "../src/routines.js";
import type { Schedule } from "../src/schedule.js";
import { byHour, monthGrid, onDay, shownInCell, startOfWeek, step, viewDays, viewTitle } from "../src/ui/calendar.js";

const now = new Date(2026, 10, 7, 12, 0); // Saturday 7 November 2026, noon, local time

const goal = (over: Partial<Goal>): Goal => ({ id: "g", ref: "", title: "Goal", status: "active", line: 1, claim: undefined, outcome: undefined, reason: undefined, ...over }) as Goal;
const task = (over: Partial<Task>): Task => ({ id: "t1", ref: undefined, title: "Step", status: "done", line: 1, summary: undefined, code: [], movedFrom: undefined, addedBy: undefined, droppedBy: undefined, reason: undefined, spent: 0, fromHandTest: undefined, ...over }) as Task;
const test = (over: Partial<HandTest>): HandTest => ({ id: "h1", ref: undefined, text: "Try it", line: 1, result: "works", note: undefined, task: undefined, taskAdded: undefined, markedAt: undefined, seen: true, ...over }) as HandTest;
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const base = { schedule: undefined, routines: [] as Routine[], handoffs: [], now };
const kinds = (es: CalendarEvent[]) => es.map((e) => `${e.kind}:${e.title}`);

describe("calendar events", () => {
  it("a finished step is a block from its start to its finish; one without a start is a moment", () => {
    const es = calendarEvents({
      ...base,
      goals: [{ goal: goal({}), handTests: [], tasks: [
        task({ id: "t1", title: "Worked", startedAt: at(5, 9), finishedAt: at(5, 10, 30) }),
        task({ id: "t2", title: "Recorded", finishedAt: at(6, 14) }),
        task({ id: "t3", title: "Open", status: "pending" }),
        task({ id: "t4", title: "Dropped", status: "dropped", finishedAt: at(6, 15) }),
      ] }],
    });
    expect(es.map((e) => [e.title, e.start, e.end])).toEqual([
      ["Worked", at(5, 9), at(5, 10, 30)],
      ["Recorded", at(6, 14), undefined],
    ]);
    expect(es[0]).toMatchObject({ kind: "step", goal: "g", goalTitle: "Goal" });
  });

  it("a step started days before it finished shows only at its finish", () => {
    const [e] = calendarEvents({ ...base, goals: [{ goal: goal({}), handTests: [], tasks: [task({ startedAt: at(1, 9), finishedAt: at(5, 9) })] }] });
    expect(e).toMatchObject({ start: at(5, 9) });
    expect(e!.end).toBeUndefined();
  });

  it("goals added, hotfixes, finished goals and releases, at their own times", () => {
    const es = calendarEvents({
      ...base,
      goals: [
        { goal: goal({ id: "a", title: "Login", status: "done", added: { at: at(1, 9), by: "Developer" } }), handTests: [], tasks: [task({ finishedAt: at(3, 9) }), task({ id: "t2", finishedAt: at(4, 9) })] },
        { goal: goal({ id: "b", title: "Crash", hotfix: true, added: { at: at(2, 9), by: "AI" } }), handTests: [], tasks: [] },
        { goal: goal({ id: "c", title: "Release 1.2.0", status: "done", release: "1.2.0", updated: { at: at(6, 9), by: "AI" } }), handTests: [], tasks: [] },
      ],
    });
    expect(kinds(es)).toEqual([
      "goal-added:New goal: Login",
      "hotfix:Hotfix: Crash",
      "step:Step",
      "step:Step",
      "goal-done:Finished: Login",
      "release:Released 1.2.0: Release 1.2.0",
    ]);
    expect(es.find((e) => e.kind === "goal-done")!.start).toBe(at(4, 9));
    expect(es[0]!.detail).toBe("Added by you");
  });

  it("hand tests the Developer marked, not the ones still waiting", () => {
    const es = calendarEvents({ ...base, goals: [{ goal: goal({}), tasks: [], handTests: [
      test({ id: "h1", result: "works", markedAt: at(5, 9) }),
      test({ id: "h2", result: "doesn't work", markedAt: at(5, 10) }),
      test({ id: "h3", result: "pending" }),
    ] }] });
    expect(es.map((e) => e.detail)).toEqual(["You tried it: it works", "You tried it: it doesn't work"]);
  });

  it("the schedule's next steps and expected finishes are in the future, from now", () => {
    const schedule = {
      estimated: true, limit: undefined, capacity: 1, helpers: 0, finish: 180, unknown: 1, factor: undefined,
      running: [{ goal: "g", id: "t1", title: "Now", status: "in progress", left: 60, start: 0, end: 60, over: false }],
      next: [{ goal: "g", id: "t2", title: "Then", status: "pending", left: 120, start: 60, end: 180, over: false },
        { goal: "g", id: "t3", title: "Unknown", status: "pending", left: undefined, start: 180, end: 180, over: false }],
      goals: [{ id: "g", title: "Goal", finish: 180, unknown: 1 }],
    } as unknown as Schedule;
    const es = calendarEvents({ ...base, schedule, goals: [{ goal: goal({}), tasks: [], handTests: [] }] });
    expect(es.map((e) => [e.kind, e.title, e.start, e.end])).toEqual([
      ["planned", "Now", at(7, 12), at(7, 13)],
      ["planned", "Then", at(7, 13), at(7, 15)],
      ["due", "Should be done: Goal", at(7, 15), undefined],
    ]);
    expect(es[0]!.goalTitle).toBe("Goal");
    expect(es[2]!.detail).toContain("1 step without an estimate");
  });

  it("no schedule events when nothing is estimated", () => {
    const schedule = { estimated: false, running: [], next: [], goals: [{ id: "g", title: "Goal", finish: 0, unknown: 3 }] } as unknown as Schedule;
    expect(calendarEvents({ ...base, schedule, goals: [] })).toEqual([]);
  });

  it("a routine repeats up to the horizon; a paused one does not show", () => {
    const routines: Routine[] = [
      { id: "r1", ref: "", title: "Weekly audit", every: "1w", next: at(9, 9), outcome: undefined, steps: [], lastGoal: undefined, paused: false, line: 1 },
      { id: "r2", ref: "", title: "Paused", every: "1d", next: at(8, 9), outcome: undefined, steps: [], lastGoal: undefined, paused: true, line: 2 },
    ];
    const es = calendarEvents({ ...base, routines, goals: [], horizonDays: 21 });
    expect(es.map((e) => e.start)).toEqual([at(9, 9), at(16, 9), at(23, 9)]);
    expect(es.every((e) => e.kind === "routine" && e.title === "Weekly audit")).toBe(true);
  });

  it("a routine whose time has come shows on that date, then its turns after now", () => {
    const routines: Routine[] = [{ id: "r1", ref: "", title: "Daily", every: "1d", next: at(5, 9), outcome: undefined, steps: [], lastGoal: undefined, paused: false, line: 1 }];
    const es = calendarEvents({ ...base, routines, goals: [], horizonDays: 2 });
    expect(es.map((e) => e.start)).toEqual([at(5, 9), at(8, 9), at(9, 9)]);
  });

  it("handoffs at the time they were written", () => {
    const es = calendarEvents({ ...base, goals: [], handoffs: [{ file: "a.md", title: "Week one", range: "2026-11-01 to 2026-11-07", commits: 3, written: at(7, 9) }, { file: "b.md", title: "Undated", range: undefined, commits: undefined, written: undefined }] });
    expect(es).toEqual([{ id: "handoff:a.md", kind: "handoff", title: "Handoff: Week one", start: at(7, 9), detail: "Covers 2026-11-01 to 2026-11-07" }]);
  });
});

describe("calendar views", () => {
  it("a month view is 6 weeks from the Monday on or before the 1st", () => {
    const days = monthGrid(new Date(2026, 10, 18));
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual(new Date(2026, 9, 26)); // Monday 26 October
    expect(days[41]).toEqual(new Date(2026, 11, 6));
  });

  it("weeks start on Monday, also from a Sunday", () => {
    expect(startOfWeek(new Date(2026, 10, 8, 15))).toEqual(new Date(2026, 10, 2));
    expect(viewDays("week", now).map((d) => d.getDate())).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(viewDays("day", now)).toEqual([new Date(2026, 10, 7)]);
    expect(viewDays("list", now)).toHaveLength(30);
  });

  it("steps back and forward by a day, a week or a month, from the 1st so months never skip", () => {
    expect(step("day", now, 1)).toEqual(new Date(2026, 10, 8));
    expect(step("week", now, -1)).toEqual(new Date(2026, 9, 31));
    expect(step("month", new Date(2027, 0, 31), 1)).toEqual(new Date(2027, 1, 1));
  });

  it("titles each view", () => {
    expect(viewTitle("month", now, "en-GB")).toBe("November 2026");
    expect(viewTitle("week", now, "en-GB")).toBe("2 Nov – 8 Nov 2026");
    expect(viewTitle("day", now, "en-GB")).toMatch(/^Saturday,? 7 November 2026$/);
    expect(viewTitle("week", new Date(2026, 11, 30), "en-GB")).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("an event is on the days it starts in or runs into", () => {
    const e = { id: "x", kind: "step" as const, title: "x", start: at(6, 23), end: at(7, 1) };
    expect(onDay(e, new Date(2026, 10, 6))).toBe(true);
    expect(onDay(e, new Date(2026, 10, 7))).toBe(true);
    expect(onDay(e, new Date(2026, 10, 8))).toBe(false);
    const moment = { id: "y", kind: "due" as const, title: "y", start: at(7, 0) };
    expect(onDay(moment, new Date(2026, 10, 7))).toBe(true);
    expect(onDay(moment, new Date(2026, 10, 6))).toBe(false);
  });

  it("puts a day's events in the hour they start, and one from the day before in the first hour", () => {
    const ev = (id: string, start: string, end?: string) => ({ id, kind: "step" as const, title: id, start, ...(end ? { end } : {}) });
    const hours = byHour([ev("b", at(7, 9, 40)), ev("a", at(7, 9, 5)), ev("late", at(6, 23), at(7, 1)), ev("other", at(8, 9))], now);
    expect(hours).toHaveLength(24);
    expect(hours[9]!.map((e) => e.id)).toEqual(["a", "b"]);
    expect(hours[0]!.map((e) => e.id)).toEqual(["late"]);
    expect(hours.flat()).toHaveLength(3);
  });

  it("a week cell shows two events, or one and how many more", () => {
    expect([0, 1, 2, 3, 9].map((n) => shownInCell(n))).toEqual([0, 1, 2, 1, 1]);
  });
});
