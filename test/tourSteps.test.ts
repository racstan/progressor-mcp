import { describe, expect, it } from "vitest";
import { TOUR_STEPS, firstTarget, markTourSeen, tourMove, tourSeen } from "../src/ui/tourSteps.js";
import { FREE_NOTICE } from "../src/ui/words.js";

const store = (items: Record<string, string> = {}) => {
  const map = new Map(Object.entries(items));
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
};
const broken = { getItem: () => { throw new Error("no storage"); }, setItem: () => { throw new Error("no storage"); } };

describe("the tour's steps", () => {
  it("opens with a welcome that points at nothing and says, first of all, that Progressor is free", () => {
    const [welcome] = TOUR_STEPS;
    expect(welcome!.title).toBe("Welcome to Progressor");
    expect(welcome!.targets).toEqual([]);
    expect(welcome!.notice).toBe(FREE_NOTICE);
    expect(TOUR_STEPS.slice(1).every((s) => s.notice === undefined)).toBe(true);
  });

  it("then has 4 to 6 short steps, each with a title, words and somewhere to point", () => {
    const rest = TOUR_STEPS.slice(1);
    expect(rest.length).toBeGreaterThanOrEqual(4);
    expect(rest.length).toBeLessThanOrEqual(6);
    for (const s of TOUR_STEPS) {
      expect(s.title).toMatch(/^[A-Z]/);
      expect(s.body.length).toBeGreaterThan(20);
    }
    for (const s of rest) expect(s.targets.length).toBeGreaterThan(0);
  });

  it("covers Home, a goal, Needs you, Message your AI, the Dashboard and Calendar, and Settings, in that order", () => {
    expect(TOUR_STEPS.map((s) => s.title)).toEqual([
      "Welcome to Progressor",
      "Home and your projects",
      "A goal and its steps",
      "Needs you",
      "Message your AI",
      "Dashboard and Calendar",
      "Settings, if you want them",
    ]);
    const words = TOUR_STEPS.map((s) => `${s.title} ${s.body}`).join(" ");
    for (const w of ["Home", "goal", "Needs you", "Message your AI", "Dashboard", "Calendar", "Settings"]) expect(words).toContain(w);
  });
});

describe("moving through the tour", () => {
  it("goes forward and back, never before the first step", () => {
    expect(tourMove(0, "next", 5)).toBe(1);
    expect(tourMove(3, "back", 5)).toBe(2);
    expect(tourMove(0, "back", 5)).toBe(0);
  });

  it("ends after the last step, or at once on Skip", () => {
    expect(tourMove(4, "next", 5)).toBeUndefined();
    expect(tourMove(2, "skip", 5)).toBeUndefined();
  });
});

describe("what the tour points at", () => {
  it("is the first of its places that is on the page, or nothing", () => {
    const on = new Set([".b", ".c"]);
    expect(firstTarget([".a", ".b", ".c"], (s) => on.has(s))).toBe(".b");
    expect(firstTarget([".a"], (s) => on.has(s))).toBeUndefined();
  });
});

describe("showing the tour once", () => {
  it("shows the first time, and not after it was seen", () => {
    const s = store();
    expect(tourSeen(s)).toBe(false);
    markTourSeen(s);
    expect(tourSeen(s)).toBe(true);
  });

  it("never shows by itself, and never fails, when the browser can't keep anything", () => {
    expect(tourSeen(broken)).toBe(true);
    expect(() => markTourSeen(broken)).not.toThrow();
  });
});
