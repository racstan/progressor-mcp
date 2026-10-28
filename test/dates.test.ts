import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildGoalGraph } from "../src/dashboard/graph.js";
import { dashboardApi } from "../src/dashboard/http.js";
import { formatStamp, parseStamp, stampDates } from "../src/dates.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { parseRoadmap } from "../src/roadmap.js";
import { tempDir } from "./tmp.js";

const T0 = "2026-10-28T10:00:00.000Z";
const T1 = "2026-10-28T11:30:00.000Z";
const T2 = "2026-10-28T12:00:00.000Z";
let clock = new Date(T0);
let root: string;
let agent: Project;
/** The dashboard: the Session "dashboard", as in http.ts. */
let page: Project;

const at = (iso: string) => (clock = new Date(iso));
beforeEach(() => {
  clock = new Date(T0);
  root = tempDir("progressor-dates-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => clock });
  page = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now: () => clock });
});

const file = (name: string) => join(root, ".progressor", name);
const text = (name: string) => readFileSync(file(name), "utf8");
const plan = (goal = "login") => parsePlanFile(text(`goals/${goal}.md`), goal);
const roadmap = () => parseRoadmap(text("roadmap.md"));
const ai = (iso: string) => ({ at: iso, by: "AI" });
const dev = (iso: string) => ({ at: iso, by: "Developer" });

function start() {
  agent.addGoal("Login", [{ title: "Add route" }, { title: "Callback" }]);
  agent.claimGoal("login");
}

describe("the date lines", () => {
  it("reads and writes `<time> by AI` and `<time> by Developer`", () => {
    expect(parseStamp(`${T0} by AI`)).toEqual(ai(T0));
    expect(parseStamp(`${T0} by Developer`)).toEqual(dev(T0));
    expect(formatStamp(dev(T1) as never)).toBe(`${T1} by Developer`);
  });

  it("ignores a line that is not a time and a name", () => {
    expect(parseStamp("yesterday by AI")).toBeUndefined();
    expect(parseStamp(`${T0} by Bob`)).toBeUndefined();
    expect(parseStamp(undefined)).toBeUndefined();
  });
});

describe("what the AI adds", () => {
  it("dates a new goal, step, decision, note and hand test with the AI", () => {
    start();
    agent.addDecision("Use cookies");
    agent.addNote("login", "Logout overlaps");
    agent.addHandTest("Try the login by hand");
    expect(roadmap().goals[0]).toMatchObject({ added: ai(T0) });
    expect(roadmap().goals[0]!.updated).toEqual(ai(T0)); // claiming it started it
    const p = plan();
    for (const item of [p.tasks[0]!, p.tasks[1]!, p.decisions[0]!, p.notes[0]!, p.handTests[0]!]) {
      expect(item.added).toEqual(ai(T0));
      expect(item.updated).toBeUndefined();
    }
    expect(text("goals/login.md")).toContain(`- [ ] Add route ^t1\n  - added: ${T0} by AI\n`);
  });

  it("puts the date lines last in an item's lines", () => {
    agent.addGoal("Login", [{ title: "Add route", summary: "The route", estimate: 30 }]);
    agent.claimGoal("login");
    agent.startTask("t1");
    expect(text("goals/login.md")).toMatch(/- \[\/\] Add route \^t1\n(  - .*\n)*  - added: .* by AI\n  - updated: .* by AI\n/);
    expect(text("goals/login.md").split("\n").slice(-3, -1).map((l) => l.trim().split(":")[0])).toEqual(["- added", "- updated"]);
    expect(text("roadmap.md")).toMatch(/  - claimed by: .*\n  - added: .* by AI\n/);
  });
});

describe("what changes", () => {
  it("completing a step sets updated and keeps added", () => {
    start();
    at(T1);
    agent.completeTask("t1", ["src/a.ts"]);
    expect(plan().task("t1")).toMatchObject({ added: ai(T0), updated: ai(T1) });
    expect(plan().task("t2")).toMatchObject({ added: ai(T0) });
    expect(plan().task("t2")!.updated).toBeUndefined();
  });

  it("editing a step sets updated, and only on that step", () => {
    start();
    at(T1);
    agent.updateTask("t2", { summary: "Handle the redirect" });
    expect(plan().task("t2")).toMatchObject({ added: ai(T0), updated: ai(T1) });
    expect(plan().task("t1")!.updated).toBeUndefined();
  });

  it("editing a decision and resolving a note set updated", () => {
    start();
    agent.addDecision("Use cookies");
    agent.addNote("login", "Logout overlaps");
    at(T1);
    agent.updateDecision("c1", "Use tokens");
    expect(plan().decision("c1")).toMatchObject({ added: ai(T0), updated: ai(T1) });
  });

  it("a save that changes nothing leaves the dates and the file alone", () => {
    start();
    const before = [text("roadmap.md"), text("goals/login.md")];
    at(T2);
    agent.updateTask("t1", { summary: undefined });
    agent.status();
    expect([text("roadmap.md"), text("goals/login.md")]).toEqual(before);
    expect(plan().task("t1")!.updated).toBeUndefined();
  });

  it("the AI seeing a hand test mark and a goal's claim are not changes", () => {
    start();
    agent.addHandTest("Try it");
    page.markHandTest("login", "h1", "works");
    const marked = plan().handTest("h1")!;
    expect(marked.updated).toEqual(dev(T0));
    at(T2);
    agent.acknowledgeHandTests("login"); // the AI is shown the mark
    expect(plan().handTest("h1")).toMatchObject({ seen: true, updated: dev(T0) });
    const goalDates = roadmap().goals[0]!.updated;
    agent.releaseGoal();
    agent.claimGoal("login");
    expect(roadmap().goals[0]!.updated).toEqual(goalDates);
  });

  it("a Goal changed on the Roadmap gets updated", () => {
    start();
    at(T1);
    agent.updateGoal("login", { outcome: "People can log in" });
    expect(roadmap().goals[0]).toMatchObject({ added: ai(T0), updated: ai(T1) });
  });
});

describe("what the Developer does on the dashboard", () => {
  beforeEach(() => {
    start();
    agent.addHandTest("Try the login by hand");
    agent.askDeveloper("Cookies or tokens?", ["Cookies", "Tokens"]);
  });

  it("marking a hand test is the Developer's update", () => {
    at(T1);
    page.markHandTest("login", "h1", "works");
    expect(plan().handTest("h1")).toMatchObject({ added: ai(T0), updated: dev(T1) });
  });

  it("a failed hand test adds a step by the Developer", () => {
    at(T1);
    page.markHandTest("login", "h1", "doesn't work", "it froze");
    const added = plan().handTest("h1")!.taskAdded!;
    expect(plan().task(added)).toMatchObject({ added: dev(T1) });
    expect(plan().task(added)!.updated).toBeUndefined();
    expect(plan().task("t1")!.updated).toBeUndefined();
  });

  it("answering a question adds the decision it makes by the Developer", () => {
    at(T1);
    page.answerQuestion("login", "q1", "Tokens");
    expect(plan().decision("c1")).toMatchObject({ added: dev(T1) });
  });

  it("an option can say who made the changes", () => {
    const other = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => clock, actor: "Developer" });
    at(T1);
    other.addDecision("By hand", "login");
    expect(plan().decision("c1")!.added).toEqual(dev(T1));
  });

  it("a change made from another project is the AI's, even from the dashboard's Session", () => {
    const elsewhere = page.elsewhere(root, "other-project");
    at(T1);
    elsewhere.addNote("login", "From over there");
    expect(plan().notes[0]!.added).toEqual(ai(T1));
  });
});

describe("moving and dropping", () => {
  it("a step moved to another goal keeps its added", () => {
    start();
    agent.addGoal("Docs", [{ title: "Write" }]);
    at(T1);
    const moved = agent.moveTask("t2", "docs");
    expect(plan("docs").task(moved.id!)).toMatchObject({ added: ai(T0) });
    expect(plan("docs").task(moved.id!)!.updated).toBeUndefined();
    // The trace left behind was changed (it is dropped).
    expect(plan().task("t2")).toMatchObject({ status: "dropped", added: ai(T0), updated: ai(T1) });
  });
});

describe("plans from before dates", () => {
  const OLD_PLAN = "# Login\n\n## Tasks\n\n- [ ] Add route ^t1\n  - summary: The route\n";
  const OLD_ROADMAP = "# Roadmap\n\n## Goals\n\n- [/] [Login](goals/login.md) ^login\n  - claimed by: s-a (pid 1)\n";

  beforeEach(() => {
    agent.addGoal("Other"); // makes the .progressor folder
    writeFileSync(file("roadmap.md"), OLD_ROADMAP);
    writeFileSync(file("goals/login.md"), OLD_PLAN);
  });

  it("parse with no dates, and reading does not rewrite them", () => {
    expect(plan().task("t1")).toMatchObject({ title: "Add route" });
    expect(plan().task("t1")!.added).toBeUndefined();
    expect(roadmap().goals[0]!.added).toBeUndefined();
    page.plan("login");
    page.roadmap();
    page.status();
    expect(text("goals/login.md")).toBe(OLD_PLAN);
    expect(text("roadmap.md")).toBe(OLD_ROADMAP);
  });

  it("a step that changes gets updated but no added; one that does not is left as it was", () => {
    agent.addTasks([{ title: "Callback" }], "login");
    at(T1);
    agent.updateTask("t1", { summary: "A better summary" });
    expect(plan().task("t1")).toMatchObject({ updated: ai(T1) });
    expect(plan().task("t1")!.added).toBeUndefined();
    expect(plan().task("t2")).toMatchObject({ added: ai(T0) });
  });
});

describe("on the dashboard", () => {
  it("the map's steps and the goal carry their dates", () => {
    start();
    at(T1);
    agent.completeTask("t1");
    const task = buildGoalGraph(agent.plan("login")).nodes.find((n) => n.kind === "task" && n.id === "t1");
    expect(task).toMatchObject({ added: ai(T0), updated: ai(T1) });
    expect(dashboardApi(page).goal("login")!.goal).toMatchObject({ added: ai(T0) });
  });
});

describe("round trip", () => {
  it("keeps the date lines as they are when a plan is read and written again", () => {
    start();
    at(T1);
    agent.completeTask("t1");
    const before = text("goals/login.md");
    expect(parsePlanFile(before, "login").toString()).toBe(before);
    expect(stampDates(before, before, { sections: ["Tasks"], ignore: [] }, new Date(T2), "AI")).toBe(before);
  });

  it("stampDates dates a new file's items and keeps dates that are already there", () => {
    const written = "# L\n\n## Tasks\n\n- [ ] One ^t1\n  - added: 2026-01-01T00:00:00.000Z by Developer\n- [ ] Two ^t2\n";
    const out = stampDates(written, undefined, { sections: ["Tasks"], ignore: [] }, new Date(T0), "AI");
    expect(out).toBe(
      `# L\n\n## Tasks\n\n- [ ] One ^t1\n  - added: 2026-01-01T00:00:00.000Z by Developer\n- [ ] Two ^t2\n  - added: ${T0} by AI\n`,
    );
  });
});
