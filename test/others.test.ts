import { describe, expect, it } from "vitest";
import { groupByPerson, othersWaitingWords, waitingLine, type WaitLine } from "../src/ui/others.js";
import { dashboardApi } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";
import { homeSections, sidebarSections } from "../src/ui/home.js";

const line = (step: string, who: string | undefined, need = "Do it", goal = "g1"): WaitLine => ({ goal, goalTitle: goal.toUpperCase(), step, title: `Step ${step}`, ...(who ? { waitingFor: who } : {}), need });

describe("waiting on others, by person", () => {
  const people = [{ id: "p1", name: "Priya", role: "payments lawyer" }, { id: "p2", name: "Stripe support" }];

  it("groups steps under each person with their role, in the order of the people file", () => {
    const groups = groupByPerson([line("1", "Stripe support"), line("2", "priya"), line("3", "Priya", "Sign it", "g2")], people);
    expect(groups.map((g) => [g.name, g.role, g.steps.map((s) => s.step)])).toEqual([
      ["Priya", "payments lawyer", ["2", "3"]],
      ["Stripe support", undefined, ["1"]],
    ]);
  });

  it("keeps someone not in the people file, after the known ones, and names a step with nobody 'Someone'", () => {
    const groups = groupByPerson([line("1", "Zed"), line("2", undefined), line("3", "Priya")], people);
    expect(groups.map((g) => g.name)).toEqual(["Priya", "Zed", "Someone"]);
  });

  it("gives nothing when nothing waits", () => {
    expect(groupByPerson([], people)).toEqual([]);
  });

  it("counts them in words", () => {
    expect(othersWaitingWords(groupByPerson([line("1", "Priya"), line("2", "Priya"), line("3", "Zed")], people))).toBe("3 steps waiting on 2 people");
    expect(othersWaitingWords(groupByPerson([line("1", "Priya")], people))).toBe("1 step waiting on 1 person");
  });

  it("words a step's line", () => {
    expect(waitingLine("Priya", "Sign and send back the contract")).toBe("Waiting on Priya: Sign and send back the contract");
    expect(waitingLine(undefined, undefined)).toBe("Waiting on someone");
  });
});

describe("who holds what on the dashboard", () => {
  it("lists the steps waiting on someone with their goal, and the people; the goal does not wait on you", () => {
    const p = new Project({ root: tempDir("progressor-others-"), session: { id: "s", pid: process.pid }, now: () => new Date("2026-11-17T10:00:00Z") });
    p.addGoal("Payments", [{ title: "Sign the contract" }, { title: "Wire the API" }]);
    p.claimGoal("payments");
    p.addPerson("Priya", "payments lawyer");
    p.setTaskState("t1", "waiting on someone", "payments", { person: "Priya", need: "Sign and send back the contract" });
    const view = dashboardApi(p).roadmap();
    expect(view.waitingOnOthers).toEqual([{ goal: "payments", goalTitle: "Payments", step: "t1", title: "Sign the contract", waitingFor: "Priya", need: "Sign and send back the contract" }]);
    expect(view.people).toEqual([{ id: "p1", name: "Priya", role: "payments lawyer" }]);
    expect(view.goals[0]).toMatchObject({ waitingOnYou: false, waitingSteps: 0 });
    p.setTaskState("t1", "in progress", "payments");
    expect(dashboardApi(p).roadmap().waitingOnOthers).toEqual([]);
  });
});

describe("waiting on someone is not waiting on you", () => {
  const goal = { id: "a", title: "A", status: "active", done: 0, total: 2, waitingOnYou: false, openQuestions: 0, untriedTests: 0, waitingSteps: 0 };
  it("keeps a goal out of Needs you", () => {
    const project = { id: "p", name: "P", root: "/p", goals: [goal] };
    expect(homeSections([project]).needsYou).toEqual([]);
    expect(sidebarSections([goal]).map((s) => s.label)).toEqual(["In progress"]);
  });
});
