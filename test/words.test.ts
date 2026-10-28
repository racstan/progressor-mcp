import { describe, expect, it } from "vitest";
import { computeSchedule } from "../src/schedule.js";
import {
  messageStateWords,
  talkSummary,
  GOAL_WORD,
  STEP_HINT,
  STEP_MARK,
  STEP_WORD,
  ago,
  countsLine,
  finishWords,
  goalState,
  goalTime,
  handTestsLine,
  handTestsOpen,
  isBadge,
  noteOrigin,
  scheduleLine,
  statusClass,
  statusLine,
  stepOf,
  stepTime,
  underWay,
} from "../src/ui/words.js";

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
  it("is working, not waiting, while steps are with helpers, however quiet the plan is", () => {
    const quiet = { ...active, updatedAt: now - 60 * MIN, running: true };
    expect(goalState({ ...quiet, helpers: 3 }, now)).toMatchObject({ state: "working", label: "Helpers working" });
    expect(goalState({ ...quiet, helpers: 1 }, now).hint).toMatch(/a step to helper agents/);
    expect(goalState({ ...quiet, helpers: 0 }, now).state).toBe("waiting");
  });
  it("still puts waiting on you, a closed chat and a paused goal ahead of helpers", () => {
    const g = { ...active, running: true, helpers: 2 };
    expect(goalState({ ...g, waitingOnYou: true }, now).state).toBe("you");
    expect(goalState({ ...g, running: false }, now).state).toBe("stopped");
    expect(goalState({ ...g, running: undefined }, now).state).toBe("paused");
    expect(goalState({ ...g, status: "done" }, now).state).toBe("finished");
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
  it("counts the helpers instead of the step while they work", () => {
    const quiet = { status: "active", updatedAt: now - 19 * MIN, running: true };
    expect(statusLine(quiet, ["with a helper", "with a helper", "checked", "with a helper", "pending"], now)).toBe(
      "Helpers working · 3 of 5 steps with helpers · last update 19 min ago",
    );
    expect(statusLine(quiet, ["done", "with a helper"], now)).toBe("Helpers working · 1 of 2 steps with a helper · last update 19 min ago");
    // A checked step is the AI's own turn to merge it: with no helper left, a quiet plan is the AI waiting.
    expect(statusLine(quiet, ["checked", "pending"], now)).toBe("AI waiting · step 1 of 2 · last update 19 min ago");
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

describe("the schedule in plain words", () => {
  const at = new Date(now);
  const task = (id: string, status: string, estimate?: number) => ({ id, title: `Step ${id}`, status: status as any, spent: 0, ...(estimate ? { estimate } : {}), ...(status === "with a helper" ? { timingSince: at.toISOString() } : {}) });
  const phase8 = { goal: { id: "phase-8", title: "Phase 8", status: "active" as const }, tasks: [task("t1", "with a helper", 120), task("t2", "with a helper", 60), task("t3", "pending", 240), task("t4", "pending"), task("t5", "pending"), task("t6", "pending")] };
  const later = { goal: { id: "later", title: "Later", status: "planned" as const, estimate: 120 }, tasks: [] };

  it("says what runs now, what is next and when the goal and the whole plan should be done", () => {
    const s = computeSchedule([phase8, later], 2, at);
    expect(scheduleLine(s, "phase-8")).toBe(
      "Now: 2 helpers busy, at most 2 at once · Next: Step t3, then Step t4 · Phase 8 done in about 5 h (3 steps not estimated) · all goals done in about 5 h (3 steps not estimated)",
    );
  });

  it("says when more helpers are busy than allowed, and says nothing without estimates or a limit", () => {
    const busy = { goal: phase8.goal, tasks: [task("t1", "with a helper"), task("t2", "with a helper"), task("t3", "with a helper")] };
    expect(scheduleLine(computeSchedule([busy], 2, at))).toBe("Now: 3 helpers busy, more than the 2 allowed at once");
    expect(scheduleLine(computeSchedule([busy], undefined, at))).toBeUndefined();
  });

  it("says a goal's estimate and finish, and steps not estimated instead of a time", () => {
    const s = computeSchedule([phase8, { goal: { id: "x", title: "X", status: "planned" as const }, tasks: [task("t1", "pending")] }], undefined, at);
    expect(goalTime(s.goals[0])).toBe("Estimated 7 h · done in about 5 h (3 steps not estimated)");
    expect(goalTime(s.goals[1])).toBe("1 step not estimated");
    expect(finishWords({ finish: 0, left: 0, unknown: 0 })).toBeUndefined();
    expect(goalTime(undefined)).toBeUndefined();
  });

  it("compares a step's estimate with its time, counting a stretch still running", () => {
    expect(stepTime({ status: "done", estimate: 45, spent: 70 })).toBe("Took 1 h 10 m, estimated 45 m");
    expect(stepTime({ status: "with a helper", estimate: 45, spent: 10, timingSince: new Date(now - 20 * MIN).toISOString() }, now)).toBe("30 m so far, estimated 45 m");
    expect(stepTime({ status: "pending", estimate: 45 })).toBe("Estimated 45 m");
    expect(stepTime({ status: "pending" })).toBeUndefined();
  });
});

describe("the things to try by hand", () => {
  const tests = [{ result: "pending" }, { result: "pending" }, { result: "works" }, { result: "doesn't work" }, { result: "won't test" }];
  it("sums them up in everyday words, leaving out what there is none of", () => {
    expect(handTestsLine(tests)).toBe("2 to try · 1 works · 1 doesn't work · 1 won't test");
    expect(handTestsLine([{ result: "works" }])).toBe("1 works");
    expect(handTestsLine([])).toBe("");
  });
  it("counts what is still to try", () => {
    expect(handTestsOpen(tests)).toBe(2);
    expect(handTestsOpen([{ result: "works" }])).toBe(0);
  });
});

describe("talking with your AI", () => {
  it("says where a message stands in everyday words", () => {
    expect(messageStateWords("new")).toBe("sent; your AI reads it at its next update");
    expect(messageStateWords("seen")).toBe("read by your AI");
    expect(messageStateWords("replied")).toBe("answered");
  });

  it("sums up what was said before", () => {
    expect(talkSummary([{ state: "replied" }], [])).toBe("1 message");
    expect(talkSummary([{ state: "new" }, { state: "seen" }], [{}])).toBe("2 messages, 2 not answered yet · 1 answer you gave");
    expect(talkSummary([], [{}, {}])).toBe("2 answers you gave");
  });

  it("a goal with a question for you is waiting on you", () => {
    expect(goalState({ status: "active", updatedAt: undefined, running: true, waitingOnYou: true }).hint).toBe(
      "Your AI is waiting on you: a step to check or a question to answer. Open the goal to see what.",
    );
  });
});
