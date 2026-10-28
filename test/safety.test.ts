import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { dashboardApi } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

const NOW = new Date("2026-10-28T10:00:00.000Z");
let root: string;
let agent: Project;

beforeEach(() => {
  root = tempDir("progressor-safety-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => NOW });
  const goal = agent.addGoal("Dark mode", [{ title: "Add the switch" }]);
  agent.claimGoal(goal.id);
  agent.addGoal("Search", [{ title: "Index it" }]);
});

const roadmapPath = () => join(root, ".progressor/roadmap.md");
const planPath = () => join(root, ".progressor/goals/dark-mode.md");
const PASTED = "oops, I pasted over this file\n";

describe("a damaged roadmap", () => {
  it("is never rewritten by a tool that changes it", () => {
    writeFileSync(roadmapPath(), PASTED);
    expect(() => agent.addGoal("Billing", [{ title: "Invoice" }])).toThrow(
      "`.progressor/roadmap.md` could not be read as a Progressor plan (it has no Goals section), so it was not changed. " +
        "Fix the file (git can restore it: `git checkout -- .progressor/roadmap.md`), then try again.",
    );
    expect(readFileSync(roadmapPath(), "utf8")).toBe(PASTED);
    expect(existsSync(join(root, ".progressor/goals/billing.md"))).toBe(false);
  });

  it("is reported when read, not shown as a roadmap with no Goals", () => {
    writeFileSync(roadmapPath(), PASTED);
    expect(() => agent.roadmap()).toThrow(/could not be read as a Progressor plan/);
    expect(() => agent.status()).toThrow(/roadmap\.md/);
  });

  it("does not crash the dashboard", () => {
    writeFileSync(roadmapPath(), PASTED);
    const page = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now: () => NOW });
    expect(() => dashboardApi(page).roadmap()).toThrow(/could not be read as a Progressor plan/);
  });

  it("is not an empty, title-only or goal-less roadmap", () => {
    for (const text of ["", "\n", "# Roadmap\n", "# Roadmap\n\n## Goals\n", "# Roadmap\n\n## Ideas\n\n- an idea ^i1\n"]) {
      writeFileSync(roadmapPath(), text);
      expect(() => agent.roadmap(), JSON.stringify(text)).not.toThrow();
    }
  });

  it("starts fresh when there is no file", () => {
    const fresh = new Project({ root: tempDir("progressor-safety-"), session: { id: "s-b", pid: process.pid }, now: () => NOW });
    expect(fresh.roadmap().goals).toEqual([]);
    expect(() => fresh.addGoal("First", [{ title: "One" }])).not.toThrow();
  });
});

describe("a damaged Plan File", () => {
  it("is never rewritten, and the message names the file", () => {
    const text = "some notes I typed over the plan\n";
    writeFileSync(planPath(), text);
    expect(() => agent.addTasks([{ title: "More" }])).toThrow(
      "`.progressor/goals/dark-mode.md` could not be read as a Progressor plan (it has no Tasks section), so it was not changed. " +
        "Fix the file (git can restore it: `git checkout -- .progressor/goals/dark-mode.md`), then try again.",
    );
    expect(readFileSync(planPath(), "utf8")).toBe(text);
  });

  it("does not stop the dashboard from showing the other Goals", () => {
    writeFileSync(planPath(), "some notes I typed over the plan\n");
    const page = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now: () => NOW });
    const goals = dashboardApi(page).roadmap().goals;
    expect(goals.map((g) => g.id).sort()).toEqual(["dark-mode", "search"]);
  });

  it("accepts a title-only file or one with a Tasks section", () => {
    for (const text of ["", "# Dark mode\n", "# Dark mode\n\n## Tasks\n"]) {
      writeFileSync(planPath(), text);
      expect(() => agent.plan("dark-mode"), JSON.stringify(text)).not.toThrow();
    }
  });
});

describe("saving a file", () => {
  const leftovers = () => readdirSync(join(root, ".progressor")).filter((f) => f.endsWith(".tmp"));
  const failing = (code: string, times: number) => {
    let calls = 0;
    const rename = (from: string, to: string) => {
      calls++;
      if (calls <= times) throw Object.assign(new Error(code), { code });
      renameSync(from, to);
    };
    return { rename, calls: () => calls };
  };
  const projectWith = (rename: (from: string, to: string) => void) => new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => NOW, rename });

  it("tries the rename again when Windows says the file is busy", () => {
    const f = failing("EBUSY", 2);
    projectWith(f.rename).addGoal("Billing", [{ title: "Invoice" }]);
    expect(f.calls()).toBeGreaterThan(2);
    expect(readFileSync(roadmapPath(), "utf8")).toContain("Billing");
    expect(leftovers()).toEqual([]);
  });

  it("writes straight to the file when the rename never works, and leaves no temp file", () => {
    const f = failing("EPERM", 1000);
    projectWith(f.rename).addGoal("Billing", [{ title: "Invoice" }]);
    expect(readFileSync(roadmapPath(), "utf8")).toContain("Billing");
    expect(leftovers()).toEqual([]);
  });

  it("removes the temp file and passes on any other error", () => {
    const f = failing("ENOSPC", 1000);
    expect(() => projectWith(f.rename).addGoal("Billing", [{ title: "Invoice" }])).toThrow("ENOSPC");
    expect(f.calls()).toBe(1);
    expect(leftovers()).toEqual([]);
    expect(readFileSync(roadmapPath(), "utf8")).not.toContain("Billing");
  });
});
