import { describe, expect, it } from "vitest";
import { CHECKS_WHY, RISK_WHY, homeSections, needsWords, progressWords, sidebarSections, untriedAcross } from "../src/ui/home.js";

const g = (id: string, status: string, extra: Partial<{ oldestUntried: string; done: number; total: number; waitingOnYou: boolean; openQuestions: number; untriedTests: number; waitingSteps: number; updatedAt: number }> = {}) => ({
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

describe("untried things across goals", () => {
  it("adds them up with the oldest, leaving out goals with none", () => {
    const goals = [g("a", "active", { untriedTests: 2, oldestUntried: "2026-11-05T00:00:00Z" }), g("b", "active"), g("c", "active", { untriedTests: 1, oldestUntried: "2026-11-02T00:00:00Z" })];
    expect(untriedAcross(goals)).toEqual({ count: 3, goals: 2, oldestAt: "2026-11-02T00:00:00Z" });
    expect(untriedAcross([g("b", "active")])).toEqual({ count: 0, goals: 0 });
  });
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
      ["Shop", "pay", "A question for you"],
      ["Blog", "post", "2 things to try"],
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

  it("lists what needs you in each project's plan order, which the AI sets, not by the latest change", () => {
    const s = homeSections([
      { id: "a", name: "Shop", root: "/a", goals: [g("first", "active", { waitingOnYou: true, untriedTests: 1, updatedAt: 1 }), g("second", "active", { waitingOnYou: true, untriedTests: 1, updatedAt: 9 })] },
      { id: "b", name: "Blog", root: "/b", goals: [g("third", "active", { waitingOnYou: true, openQuestions: 1, updatedAt: 5 })] },
    ]);
    expect(s.needsYou.map((x) => x.goal.id)).toEqual(["first", "second", "third"]);
  });
});

describe("serious risks in Needs you", () => {
  const risk = (id: string) => ({ id, title: `Risk ${id}` });
  const projects = [
    { id: "a", name: "Shop", root: "/a", goals: [], seriousRisks: [risk("r1"), risk("r2")] },
    { id: "b", name: "Blog", root: "/b", goals: [g("post", "active", { waitingOnYou: true, openQuestions: 1 })] },
    { id: "c", name: "Old", root: "/c", goals: [] },
  ];

  it("lists each project's serious risks apart from its goals, in plain words", () => {
    const s = homeSections(projects);
    expect(s.seriousRisks.map((x) => [x.project.name, x.risk.id])).toEqual([["Shop", "r1"], ["Shop", "r2"]]);
    expect(RISK_WHY).toBe("A serious risk has nothing reducing it");
    expect(s.needsYou.map((x) => x.goal.id)).toEqual(["post"]);
  });

  it("counts them in the line at the top", () => {
    expect(homeSections(projects).summary).toBe("1 goal needs you · 2 serious risks · 3 projects");
    expect(homeSections([{ ...projects[0]!, seriousRisks: [risk("r1")] }]).summary).toBe("1 serious risk · 1 project");
  });

  it("works for an older server that sends no risks", () => {
    expect(homeSections([projects[2]!]).seriousRisks).toEqual([]);
  });
});

describe("goals whose checks failed in Needs you", () => {
  const projects = [
    { id: "a", name: "Shop", root: "/a", goals: [g("cart", "active"), g("pay", "active", { waitingOnYou: true, openQuestions: 1 })], failedChecks: [{ id: "cart", title: "CART" }, { id: "pay", title: "PAY" }] },
    { id: "b", name: "Blog", root: "/b", goals: [g("post", "active")] },
  ];

  it("lists them in plain words, once each: a goal already there says it beside its other reasons", () => {
    const s = homeSections(projects);
    expect(CHECKS_WHY).toBe("Checks failed on its latest work");
    expect(s.failedChecks.map((x) => [x.project.name, x.goal.id])).toEqual([["Shop", "cart"]]);
    expect(s.needsYou.map((x) => [x.goal.id, x.why])).toEqual([["pay", `A question for you · ${CHECKS_WHY}`]]);
    expect(s.inProgress.map((x) => x.goal.id)).toEqual(["post"]);
  });

  it("counts them in the line at the top", () => {
    expect(homeSections(projects).summary).toBe("1 goal needs you · 1 goal with failed checks · 1 in progress · 2 projects");
  });

  it("works for an older server that sends none", () => {
    expect(homeSections([projects[1]!]).failedChecks).toEqual([]);
  });
});

describe("things to try, put off with Not now", () => {
  const overview = [
    { id: "a", name: "Shop", root: "/a", goals: [g("pay", "active", { waitingOnYou: true, untriedTests: 2 }), g("ask", "active", { waitingOnYou: true, untriedTests: 1, openQuestions: 1 })] },
  ];

  it("moves a goal that only has things to try out of Needs you", () => {
    const s = homeSections(overview, { "a/pay": 2, "a/ask": 1 });
    expect(s.needsYou.map((x) => [x.goal.id, x.why])).toEqual([["ask", "A question for you"]]);
    expect(s.inProgress.map((x) => x.goal.id)).toEqual(["pay"]);
  });

  it("brings it back when the AI adds something new to try", () => {
    const s = homeSections(overview, { "a/pay": 1 });
    expect(s.needsYou.map((x) => x.goal.id)).toContain("pay");
  });

  it("says whether the reason can be put off", () => {
    const s = homeSections(overview);
    expect(s.needsYou.map((x) => [x.goal.id, x.canPutOff])).toEqual([["pay", true], ["ask", true]]);
    expect(homeSections([{ ...overview[0]!, goals: [g("q", "active", { waitingOnYou: true, openQuestions: 1 })] }]).needsYou[0]!.canPutOff).toBe(false);
  });

  it("works in the sidebar too", () => {
    const goals = [g("pay", "active", { waitingOnYou: true, untriedTests: 2 })];
    expect(sidebarSections(goals, { pay: 2 }).map((x) => x.label)).toEqual(["In progress"]);
    expect(sidebarSections(goals, { pay: 1 }).map((x) => x.label)).toEqual(["Needs you"]);
  });

  it("keeps a goal the server says waits on you when it gives no reasons (an older Progressor)", () => {
    expect(sidebarSections([{ ...g("old", "active"), waitingOnYou: true, untriedTests: undefined as unknown as number }], {}).map((x) => x.label)).toEqual(["Needs you"]);
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

  it("puts a goal waiting on your tests under Needs you, and under Up next once its tests are put off", () => {
    const goals = [g("t", "testing", { waitingOnYou: true, untriedTests: 2 })];
    expect(sidebarSections(goals).map((x) => x.label)).toEqual(["Needs you"]);
    expect(sidebarSections(goals, { t: 2 }).map((x) => x.label)).toEqual(["Up next"]);
    expect(homeSections([{ id: "p", name: "P", root: "/p", goals }]).needsYou.map((x) => x.goal.id)).toEqual(["t"]);
    expect(homeSections([{ id: "p", name: "P", root: "/p", goals }]).projects[0]!.open).toBe(1);
  });

  it("leaves out a group with nothing in it", () => {
    expect(sidebarSections([g("a", "planned")]).map((x) => x.label)).toEqual(["Up next"]);
  });
});
