import { describe, expect, it } from "vitest";
import { doneMark, groupGoals, seenOnFirstVisit } from "../src/ui/goalList.js";

const goal = (id: string, status: string, done = 0, total = 2) => ({ id, status, done, total });
const goals = [
  goal("a", "active", 1),
  goal("b", "done", 2),
  goal("c", "planned"),
  goal("d", "dropped"),
  goal("e", "done", 3, 3),
];
const ids = (list: { id: string }[]) => list.map((g) => g.id);

describe("groupGoals", () => {
  it("keeps a newly finished Goal in the list, marked fresh, until the Developer has seen it", () => {
    const g = groupGoals(goals, { finished: "review", seen: { e: doneMark(goals[4]!) }, hidden: [] });
    expect(ids(g.open)).toEqual(["a", "b", "c"]);
    expect([...g.fresh]).toEqual(["b"]);
    expect(ids(g.done)).toEqual(["d", "e"]);
  });

  it("moves finished Goals to Done straight away when the Developer prefers that", () => {
    const g = groupGoals(goals, { finished: "auto", seen: {}, hidden: [] });
    expect(ids(g.open)).toEqual(["a", "c"]);
    expect(ids(g.done)).toEqual(["b", "d", "e"]);
    expect(g.fresh.size).toBe(0);
  });

  it("marks a reopened Goal fresh again once it is finished with more Tasks", () => {
    const seen = { b: "2/2" };
    expect(groupGoals([goal("b", "done", 2)], { finished: "review", seen, hidden: [] }).fresh.has("b")).toBe(false);
    expect(groupGoals([goal("b", "done", 3, 3)], { finished: "review", seen, hidden: [] }).fresh.has("b")).toBe(true);
    expect(ids(groupGoals([goal("b", "active", 2, 3)], { finished: "review", seen, hidden: [] }).open)).toEqual(["b"]);
  });

  it("puts hidden Goals aside whatever their status", () => {
    const g = groupGoals(goals, { finished: "review", seen: {}, hidden: ["a", "b", "gone"] });
    expect(ids(g.hidden)).toEqual(["a", "b"]);
    expect(ids(g.open)).toEqual(["c", "e"]);
    expect(g.fresh.has("b")).toBe(false);
  });
});

describe("seenOnFirstVisit", () => {
  it("counts every Goal already finished as seen, so a first visit isn't covered in dots", () => {
    expect(seenOnFirstVisit(goals)).toEqual({ b: "2/2", e: "3/3" });
  });
});
