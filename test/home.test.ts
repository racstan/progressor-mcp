import { describe, expect, it } from "vitest";
import { homeSections, needsWords, progressWords, sidebarSections } from "../src/ui/home.js";

const g = (id: string, status: string, extra: Partial<{ done: number; total: number; waitingOnYou: boolean; openQuestions: number; untriedTests: number; waitingSteps: number; updatedAt: number }> = {}) => ({
  id,
  title: id.toUpperCase(),
  status,
  done: 0,
  total: 4,
  waitingOnYou: false,
  openQuestions: 0,
  untriedTests: 0,
  waitingSteps: 0,
  ...extra,
});

describe("why a goal needs you", () => {
  it("says it in a few plain words, the most pressing first", () => {
    expect(needsWords({ openQuestions: 1, untriedTests: 2, waitingSteps: 1 })).toBe("A question for you · 1 step to check · 2 things to try");
    expect(needsWords({ openQuestions: 2, untriedTests: 0, waitingSteps: 0 })).toBe("2 questions for you");
    expect(needsWords({ openQuestions: 0, untriedTests: 1, waitingSteps: 3 })).toBe("3 steps to check · 1 thing to try");
    expect(needsWords({ openQuestions: 0, untriedTests: 0, waitingSteps: 0 })).toBe("");
  });

  it("says how far along a goal is", () => {
    expect(progressWords({ done: 3, total: 7 })).toBe("3 of 7 steps");
    expect(progressWords({ done: 0, total: 0 })).toBe("No steps yet");
    expect(progressWords({ done: 1, total: 1 })).toBe("1 of 1 step");
  });
});

describe("the home page", () => {
  const overview = [
    { id: "a", name: "Shop", root: "/a", goals: [g("pay", "active", { waitingOnYou: true, openQuestions: 1, updatedAt: 5 }), g("cart", "active", { done: 2, updatedAt: 9 }), g("old", "done"), g("later", "planned")] },
    { id: "b", name: "Blog", root: "/b", goals: [g("post", "paused", { waitingOnYou: true, untriedTests: 2, updatedAt: 7 }), g("seo", "paused", { done: 1, updatedAt: 1 })] },
    { id: "c", name: "Empty", root: "/c", goals: [] },
  ];

  it("puts what needs you first, then what is being worked on, then every project", () => {
    const s = homeSections(overview);
    expect(s.needsYou.map((x) => [x.project.name, x.goal.id, x.why])).toEqual([
      ["Blog", "post", "2 things to try"],
      ["Shop", "pay", "A question for you"],
    ]);
    expect(s.inProgress.map((x) => x.goal.id)).toEqual(["cart"]);
    expect(s.projects.map((p) => [p.name, p.open, p.finished])).toEqual([
      ["Shop", 3, 1],
      ["Blog", 2, 0],
      ["Empty", 0, 0],
    ]);
  });

  it("counts it all for the line at the top", () => {
    expect(homeSections(overview).summary).toBe("2 goals need you · 1 in progress · 3 projects");
    expect(homeSections([]).summary).toBe("No projects yet");
  });

  it("orders what needs you by the latest change, newest first", () => {
    const s = homeSections(overview);
    expect(s.needsYou[0]!.goal.updatedAt).toBeGreaterThan(s.needsYou[1]!.goal.updatedAt!);
  });
});

describe("the sidebar", () => {
  it("groups goals: needs you, in progress, up next; finished goals are left to their own group", () => {
    const goals = [g("a", "active"), g("b", "paused", { waitingOnYou: true }), g("c", "planned"), g("d", "paused"), g("e", "active", { waitingOnYou: true })];
    const s = sidebarSections(goals);
    expect(s.map((x) => [x.label, x.goals.map((y) => y.id)])).toEqual([
      ["Needs you", ["b", "e"]],
      ["In progress", ["a"]],
      ["Up next", ["c", "d"]],
    ]);
  });

  it("leaves out a group with nothing in it", () => {
    expect(sidebarSections([g("a", "planned")]).map((x) => x.label)).toEqual(["Up next"]);
  });
});
