import { describe, expect, it } from "vitest";
import { ageWords, dashboardLine, oncePerDay, reminderLine, summarizeUntried, thingsWords } from "../src/untried.js";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000 - 3_600_000).toISOString();

describe("summarizeUntried", () => {
  it("counts things, goals and the oldest date", () => {
    const s = summarizeUntried([{ goal: "a", at: daysAgo(1) }, { goal: "a", at: daysAgo(4) }, { goal: "b" }]);
    expect(s).toEqual({ count: 3, goals: 2, oldestAt: daysAgo(4) });
  });
  it("is empty when nothing is untried", () => {
    expect(summarizeUntried([])).toEqual({ count: 0, goals: 0 });
  });
});

describe("words", () => {
  it("says how old in days", () => {
    expect(ageWords(daysAgo(0), NOW)).toBe("today");
    expect(ageWords(daysAgo(1), NOW)).toBe("yesterday");
    expect(ageWords(daysAgo(4), NOW)).toBe("4 days ago");
  });
  it("says how many, in plain words", () => {
    expect(thingsWords({ count: 7, goals: 3 })).toBe("7 things to try across 3 goals");
    expect(thingsWords({ count: 1, goals: 1 })).toBe("1 thing to try");
    expect(thingsWords({ count: 2, goals: 1 })).toBe("2 things to try in 1 goal");
  });
  it("writes the AI line and the dashboard line", () => {
    const s = { count: 7, goals: 3, oldestAt: daysAgo(4) };
    expect(reminderLine(s, NOW)).toBe(
      "The Developer has 7 things to try across 3 goals, the oldest from 4 days ago; mention them once when you next report, and point to the dashboard's Try them one by one.",
    );
    expect(dashboardLine(s, NOW)).toBe("7 things to try across 3 goals · the oldest was added 4 days ago");
  });
  it("leaves the age out when no date is known, and says nothing for none", () => {
    expect(reminderLine({ count: 2, goals: 1 }, NOW)).toMatch(/^The Developer has 2 things to try in 1 goal; mention/);
    expect(reminderLine({ count: 0, goals: 0 }, NOW)).toBeUndefined();
    expect(dashboardLine({ count: 0, goals: 0 }, NOW)).toBeUndefined();
  });
});

describe("oncePerDay", () => {
  it("lets a line through once, then again after a day", () => {
    let t = NOW.getTime();
    const once = oncePerDay(() => new Date(t));
    expect(once("x")).toBe("x");
    expect(once("x")).toBeUndefined();
    t += 23 * 3_600_000;
    expect(once("x")).toBeUndefined();
    t += 2 * 3_600_000;
    expect(once("x")).toBe("x");
  });
  it("does not use up the day on nothing", () => {
    const once = oncePerDay(() => NOW);
    expect(once(undefined)).toBeUndefined();
    expect(once("x")).toBe("x");
  });
});
