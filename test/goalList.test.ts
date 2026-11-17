import { describe, expect, it } from "vitest";
import { DATE_UNKNOWN, FINISHED_SORT_DEFAULT, dayGroups, dayHeading, doneMark, groupGoals, groupOpen, hideAll, seenOnFirstVisit, sortFinished } from "../src/ui/goalList.js";

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

describe("groupOpen", () => {
  it("opens by itself while it holds the goal on screen", () => {
    expect(groupOpen({ pinned: false, closedFor: undefined, holdsShown: true, shown: "b" })).toBe(true);
    expect(groupOpen({ pinned: false, closedFor: undefined, holdsShown: false, shown: "a" })).toBe(false);
  });
  it("stays open when the Developer opened it", () => {
    expect(groupOpen({ pinned: true, closedFor: undefined, holdsShown: false, shown: "a" })).toBe(true);
  });
  it("closes on click even while it holds the goal on screen, until another goal is shown", () => {
    expect(groupOpen({ pinned: false, closedFor: "b", holdsShown: true, shown: "b" })).toBe(false);
    expect(groupOpen({ pinned: false, closedFor: "b", holdsShown: true, shown: "e" })).toBe(true);
  });
});

describe("hideAll", () => {
  it("adds the given Goals to the hidden list once each, keeping what was hidden", () => {
    expect(hideAll(["x"], ["b", "e"])).toEqual(["x", "b", "e"]);
    expect(hideAll(["b"], ["b", "e"])).toEqual(["b", "e"]);
    expect(hideAll([], [])).toEqual([]);
  });
});

// 17 Nov 2026 is a Tuesday; local times so the tests hold in any time zone.
const NOW = new Date(2026, 10, 17, 15, 0).getTime();
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("dayHeading", () => {
  it("uses plain words for today and yesterday, else the weekday and date", () => {
    expect(dayHeading(at(2026, 11, 17, 1), NOW)).toBe("Today");
    expect(dayHeading(at(2026, 11, 16, 23), NOW)).toBe("Yesterday");
    expect(dayHeading(at(2026, 11, 3), NOW)).toBe("Tue 3 Nov");
  });
  it("adds the year when it is not this year", () => {
    expect(dayHeading(at(2025, 12, 3), NOW)).toBe("Wed 3 Dec 2025");
  });
  it("says the date is not known for a missing or broken time", () => {
    expect(dayHeading(undefined, NOW)).toBe(DATE_UNKNOWN);
    expect(dayHeading("nonsense", NOW)).toBe(DATE_UNKNOWN);
  });
});

describe("sortFinished", () => {
  const g = (id: string, title: string, fin?: string, add?: string) => ({
    id, title, ...(fin ? { updated: { at: fin } } : {}), ...(add ? { added: { at: add } } : {}),
  });
  const list = [
    g("b", "beta", at(2026, 11, 2), at(2026, 10, 1)),
    g("n", "no dates"),
    g("a", "Alpha", at(2026, 11, 9), at(2026, 10, 20)),
    g("c", "charlie", at(2026, 11, 5), at(2026, 9, 1)),
  ];
  it("newest finished first, goals with no date last", () => {
    expect(ids(sortFinished(list, "finished-new"))).toEqual(["a", "c", "b", "n"]);
    expect(FINISHED_SORT_DEFAULT).toBe("finished-new");
  });
  it("oldest finished first, goals with no date still last", () => {
    expect(ids(sortFinished(list, "finished-old"))).toEqual(["b", "c", "a", "n"]);
  });
  it("by name, ignoring capitals", () => {
    expect(ids(sortFinished(list, "name"))).toEqual(["a", "b", "c", "n"]);
  });
  it("newest added first", () => {
    expect(ids(sortFinished(list, "added-new"))).toEqual(["a", "b", "c", "n"]);
  });
  it("leaves the original list alone", () => {
    const copy = [...list];
    sortFinished(list, "name");
    expect(list).toEqual(copy);
  });
});

describe("dayGroups", () => {
  const items = [
    { id: "1", t: at(2026, 11, 17, 9) },
    { id: "2", t: at(2026, 11, 17, 14) },
    { id: "3", t: at(2026, 11, 16) },
    { id: "4", t: undefined },
    { id: "5", t: at(2026, 11, 3) },
  ];
  it("groups by day, newest day first, unknown last, keeping order inside a day", () => {
    const groups = dayGroups(items, (i) => i.t, "newest", NOW);
    expect(groups.map((x) => x.heading)).toEqual(["Today", "Yesterday", "Tue 3 Nov", DATE_UNKNOWN]);
    expect(groups.map((x) => ids(x.items))).toEqual([["1", "2"], ["3"], ["5"], ["4"]]);
  });
  it("oldest day first, unknown still last", () => {
    const groups = dayGroups(items, (i) => i.t, "oldest", NOW);
    expect(groups.map((x) => x.heading)).toEqual(["Tue 3 Nov", "Yesterday", "Today", DATE_UNKNOWN]);
  });
  it("gives no groups for no items", () => {
    expect(dayGroups([], () => undefined, "newest", NOW)).toEqual([]);
  });
});
