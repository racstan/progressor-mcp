import { describe, expect, it } from "vitest";
import { GOAL_WORD, STEP_HINT, STEP_MARK, STEP_WORD, ago, countsLine, goalState, isBadge, noteOrigin, statusClass, statusLine, stepOf, underWay } from "../src/ui/words.js";

const MIN = 60_000;
const now = Date.parse("2026-10-20T12:00:00Z");

describe("plain words", () => {
  it("names every status in everyday words", () => {
    expect(GOAL_WORD).toEqual({ planned: "Not started", active: "In progress", paused: "Paused", done: "Finished", dropped: "Cancelled" });
    expect(STEP_WORD.pending).toBe("To do");
    expect(STEP_WORD["in progress"]).toBe("Working on it");
    expect(STEP_WORD.dropped).toBe("Cancelled");
    expect(STEP_WORD.open).toBe("Side trip under way");
    expect(STEP_WORD["with a helper"]).toBe("With a helper");
    expect(STEP_WORD["waiting on you"]).toBe("Waiting on you");
    expect(STEP_WORD.checked).toBe("Checked");
    expect(STEP_WORD.released).toBe("Released");
    for (const hint of Object.values(STEP_HINT)) expect(hint).not.toMatch(/agent|task|detour|merge[^d]|helper agent/i);
    for (const word of Object.values(STEP_WORD)) expect(word).not.toMatch(/detour|recalibrat|merge|pending|dropped/i);
  });

  it("says how long ago, roughly", () => {
    expect(ago(now - 20_000, now)).toBe("just now");
    expect(ago(now - 2 * MIN, now)).toBe("2 min ago");
    expect(ago(now - 90 * MIN, now)).toBe("1 h ago");
    expect(ago(now - 50 * 60 * MIN, now)).toBe("2 days ago");
    expect(ago(now - 26 * 60 * MIN, now)).toBe("1 day ago");
  });
});

describe("which step", () => {
  it("counts the step being worked on, leaving cancelled steps out", () => {
    expect(stepOf(["done", "dropped", "in progress", "pending"])).toEqual({ step: 2, of: 3 });
    expect(stepOf(["done", "pending", "pending"])).toEqual({ step: 2, of: 3 });
    expect(stepOf(["done", "done"])).toEqual({ step: 2, of: 2 });
    expect(stepOf([])).toEqual({ step: 0, of: 0 });
  });
});

describe("what the AI is doing", () => {
  const active = { status: "active", updatedAt: now - 2 * MIN };
  it("is working while its chat is open and the plan changed lately", () => {
    expect(goalState({ ...active, running: true }, now).state).toBe("working");
  });
  it("is waiting when its chat is open but nothing changed for a while", () => {
    const s = goalState({ ...active, updatedAt: now - 40 * MIN, running: true }, now);
    expect(s.state).toBe("waiting");
    expect(s.hint).toMatch(/check the chat/i);
  });
  it("has stopped when its chat closed", () => {
    expect(goalState({ ...active, running: false }, now).state).toBe("stopped");
  });
  it("follows the Goal otherwise", () => {
    expect(goalState({ status: "paused", updatedAt: now, running: undefined }, now).state).toBe("paused");
    expect(goalState({ status: "planned", updatedAt: now, running: undefined }, now).state).toBe("planned");
    expect(goalState({ status: "done", updatedAt: now, running: undefined }, now).state).toBe("finished");
    expect(goalState({ status: "dropped", updatedAt: now, running: undefined }, now).state).toBe("cancelled");
  });
  it("explains every state in plain words", () => {
    for (const status of ["active", "paused", "planned", "done", "dropped"])
      for (const running of [true, false, undefined]) {
        const s = goalState({ status, updatedAt: now, running }, now);
        expect(s.label).toBeTruthy();
        expect(s.hint).not.toMatch(/session|claim|goal_|task|detour/i);
      }
  });
});

describe("the status line", () => {
  const steps = ["done", "done", "in progress", "pending", "pending", "pending", "pending"];
  it("says who is working, which step and when it last changed", () => {
    expect(statusLine({ status: "active", updatedAt: now - 2 * MIN, running: true }, steps, now)).toBe(
      "AI working · step 3 of 7 · last update 2 min ago",
    );
    expect(statusLine({ status: "active", updatedAt: now - 60 * MIN, running: false }, steps, now)).toBe(
      "AI stopped · step 3 of 7 · last update 1 h ago",
    );
  });
  it("keeps it short for work not started, finished or cancelled", () => {
    expect(statusLine({ status: "planned", updatedAt: now, running: undefined }, ["pending", "pending"], now)).toBe("Not started · 2 steps");
    expect(statusLine({ status: "done", updatedAt: now - 3 * 24 * 60 * MIN, running: undefined }, ["done", "dropped", "done"], now)).toBe(
      "Finished 3 days ago · 2 steps",
    );
    expect(statusLine({ status: "dropped", updatedAt: now, running: undefined }, ["pending"], now)).toBe("Cancelled");
  });
  it("says when a Goal has no steps yet", () => {
    expect(statusLine({ status: "active", updatedAt: now, running: true }, [], now)).toBe("AI working · no steps yet · last update just now");
  });
});

describe("the newer step states", () => {
  it("has a word, a mark and a CSS class for every status a step can have", () => {
    for (const status of ["pending", "in progress", "with a helper", "waiting on you", "checked", "done", "released", "dropped"]) {
      expect(STEP_WORD[status], status).toBeTruthy();
      expect(STEP_MARK[status], status).toBeDefined();
      expect(statusClass(status)).not.toMatch(/ /);
    }
    expect(statusClass("waiting on you")).toBe("waiting-on-you");
    expect(["with a helper", "waiting on you", "checked", "released"].every(isBadge)).toBe(true);
    expect(["pending", "in progress", "done", "dropped"].some(isBadge)).toBe(false);
  });

  it("counts released steps as done, and any step under way as the current one", () => {
    expect(stepOf(["released", "done", "waiting on you", "pending"])).toEqual({ step: 3, of: 4 });
    expect(stepOf(["done", "with a helper", "in progress"])).toEqual({ step: 2, of: 3 });
    expect(stepOf(["released", "released"])).toEqual({ step: 2, of: 2 });
  });

  it("puts a Goal waiting on the Developer ahead of every other state while it is open", () => {
    const g = { status: "active", updatedAt: now - 60 * MIN, running: false, waitingOnYou: true };
    expect(goalState(g, now)).toMatchObject({ state: "you", label: "Waiting on you" });
    expect(goalState({ ...g, status: "paused", running: undefined }, now).state).toBe("you");
    expect(goalState({ ...g, status: "done" }, now).state).toBe("finished");
    expect(goalState({ ...g, status: "planned" }, now).state).toBe("planned");
    expect(goalState({ ...g, waitingOnYou: false }, now).state).toBe("stopped");
    expect(statusLine(g, ["done", "waiting on you", "pending"], now)).toBe("Waiting on you · step 2 of 3 · last update 1 h ago");
  });

  it("sums up the steps that need an eye, in plain words", () => {
    expect(countsLine({ pending: 2, "waiting on you": 1, "with a helper": 2, checked: 0, done: 3 })).toBe("1 waiting on you · 2 with a helper");
    expect(countsLine({ pending: 2, done: 1 })).toBe("");
  });

  it("says what a Goal's steps are doing, the Developer's own first", () => {
    const step = (title: string, status: string) => ({ title, status });
    expect(underWay([step("A", "in progress"), step("B", "waiting on you")])).toBe('waiting on you for "B"');
    expect(underWay([step("A", "waiting on you"), step("B", "waiting on you")])).toBe("waiting on you for 2 steps");
    expect(underWay([step("A", "done"), step("B", "in progress")])).toBe('working on "B"');
    expect(underWay([step("A", "with a helper"), step("B", "pending")])).toBe('"A" is with a helper');
    expect(underWay([step("A", "with a helper"), step("B", "with a helper")])).toBe("2 steps are with helpers");
    expect(underWay([step("A", "checked")])).toBe('"A" is checked, not released yet');
    expect(underWay([step("A", "done"), step("B", "pending")])).toBeUndefined();
  });

  it("says where a note was found, by the title of that Goal", () => {
    const goals = [{ ref: "progressor://login", title: "Let people sign in" }];
    expect(noteOrigin("progressor://login", goals)).toBe("Found while working on Let people sign in");
    expect(noteOrigin("progressor://gone", goals)).toBe("Found while working on another goal");
    expect(noteOrigin(undefined, goals)).toBeUndefined();
  });
});
