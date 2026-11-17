// The dashboard reads the same plan files on every request: Project keeps each file's text until its
// size or modified time changes. A change made by another process (an AI chat's own server) must still
// show at once, even one that keeps the file the same size.
import { readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

const make = () => {
  const root = tempDir("progressor-read-cache-");
  const p = new Project({ root, session: { id: "s", pid: process.pid } });
  p.addGoal("Login", [{ title: "Route" }]);
  return { root, p, file: join(root, ".progressor", "goals", "login.md") };
};

describe("reading unchanged plan files once", () => {
  it("sees a change made by another process, even one that keeps the file the same size", () => {
    const { p, file } = make();
    expect(p.plan("login").tasks[0]!.title).toBe("Route");
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace("Route", "Rout2"));
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    expect(p.plan("login").tasks[0]!.title).toBe("Rout2");
  });

  it("sees its own changes and a file that was removed", () => {
    const { root, p } = make();
    p.claimGoal("login");
    p.addTasks([{ title: "Form" }]);
    expect(p.plan("login").tasks.map((t) => t.title)).toEqual(["Route", "Form"]);
    const roadmap = join(root, ".progressor", "roadmap.md");
    expect(p.roadmap().goals.map((g) => g.id)).toEqual(["login"]);
    writeFileSync(roadmap, readFileSync(roadmap, "utf8").replace("[Login]", "[Sign in]"));
    const later = new Date(Date.now() + 5000);
    utimesSync(roadmap, later, later);
    expect(p.roadmap().goal("login")!.title).toBe("Sign in");
  });

  it("gives each caller its own copy to change", () => {
    const { p } = make();
    const a = p.plan("login");
    a.tasks[0]!.title = "changed in memory only";
    expect(p.plan("login").tasks[0]!.title).toBe("Route");
  });
});
