// Cost on the project's Dashboard page: the goals that used most, and the cost of a finished step.
// Pure (ui/costStats.ts).
import { describe, expect, it } from "vitest";
import { costSummary } from "../src/ui/costStats.js";

const line = (tokens: number, money?: number) => ({ tokens, ...(money !== undefined ? { money } : {}), steps: {} });

describe("cost on the Dashboard page", () => {
  it("ranks the goals that used most, at most five, with what a finished step cost in each", () => {
    const s = costSummary(
      { priced: false, other: { tokens: 0 }, goals: { a: line(100), b: line(900), c: line(0), gone: line(50), d: line(10), e: line(20), f: line(30), g: line(40) } },
      [
        { id: "a", title: "A", done: 2 },
        { id: "b", title: "B", done: 3 },
        { id: "c", title: "C", done: 1 },
        { id: "d", title: "D", done: 0 },
        { id: "e", title: "E", done: 1 },
        { id: "f", title: "F", done: 1 },
        { id: "g", title: "G", done: 1 },
      ],
    );
    expect(s!.ranked.map((r) => [r.id, r.tokens, r.perStep?.tokens])).toEqual([
      ["b", 900, 300],
      ["a", 100, 50],
      ["gone", 50, undefined],
      ["g", 40, 40],
      ["f", 30, 30],
    ]);
    expect(s!.ranked[2]!.title).toBe("gone");
    // per finished step: goals with tokens and finished steps (a, b, e, f, g): 1090 tokens over 8 steps
    expect(s!.perStep!.tokens).toBe(Math.round(1090 / 8));
    expect(s!.total.tokens).toBe(1150);
  });

  it("works out money when a price is set", () => {
    const s = costSummary({ priced: true, other: { tokens: 0, money: 0 }, goals: { a: line(1000, 2) } }, [{ id: "a", title: "A", done: 4 }]);
    expect(s!.perStep).toEqual({ tokens: 250, money: 0.5 });
    expect(s!.total).toEqual({ tokens: 1000, money: 2 });
  });

  it("is nothing while no tokens were counted", () => {
    expect(costSummary({ priced: false, other: { tokens: 0 }, goals: {} }, [])).toBeUndefined();
    expect(costSummary(undefined, [])).toBeUndefined();
  });
});
