import { describe, expect, it } from "vitest";
import { GOAL_SORTS, readGoalSort, sortGoals } from "../src/ui/goalSort.js";

const g = (id: string, title: string, spent: number, estimate: number | undefined, sideTrips: number) => ({ id, title, spent, estimate, sideTrips });
// oldest first, as the plan lists them
const goals = [g("a", "Login", 120, 60, 0), g("b", "billing", 30, 60, 3), g("c", "Calendar", 300, undefined, 1), g("d", "Docs", 0, 10, 0)];
const ids = (sort: Parameters<typeof sortGoals>[1]) => sortGoals(goals, sort).map((x) => x.id).join("");

describe("sorting the Dashboard page's goals", () => {
  it("puts the newest first by default, and the oldest first when asked", () => {
    expect(ids("newest")).toBe("dcba");
    expect(ids("oldest")).toBe("abcd");
  });

  it("sorts by time spent, most first", () => {
    expect(ids("time")).toBe("cabd");
  });

  it("sorts by how far over the estimate, goals without an estimate last", () => {
    // a: +60, d: -10, b: -30, c: no estimate
    expect(ids("over")).toBe("adbc");
  });

  it("sorts by side trips, most first, newest first among equals", () => {
    expect(ids("sideTrips")).toBe("bcda");
  });

  it("sorts A to Z, ignoring capitals", () => {

    expect(sortGoals(goals, "az").map((x) => x.title)).toEqual(["billing", "Calendar", "Docs", "Login"]);
  });

  it("never changes the list it was given", () => {
    const before = goals.map((x) => x.id).join("");
    sortGoals(goals, "az");
    expect(goals.map((x) => x.id).join("")).toBe(before);
  });

  it("names each sort for the list's heading", () => {
    expect(GOAL_SORTS.find((s) => s.id === "newest")!.heading).toBe("newest first");
    expect(GOAL_SORTS.map((s) => s.id)).toEqual(["newest", "oldest", "time", "over", "sideTrips", "az"]);
  });

  it("reads a remembered sort, falling back to newest first for anything else", () => {
    expect(readGoalSort("az")).toBe("az");
    expect(readGoalSort("bogus")).toBe("newest");
    expect(readGoalSort(null)).toBe("newest");
  });
});

describe("goals with no estimate", () => {
  it("all go last when sorting by estimate, newest first among them", () => {
    const list = [g("x", "X", 5, undefined, 0), g("y", "Y", 9, undefined, 0), g("z", "Z", 1, 2, 0)];
    expect(sortGoals(list, "over").map((x) => x.id)).toEqual(["z", "y", "x"]);
  });
});
