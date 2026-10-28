import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { applyChanges, launchFor, planInit } from "../src/init.js";
import { PRIVATE_GITIGNORE, Project } from "../src/project.js";
import { INSTRUCTIONS } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
const ignore = () => readFileSync(join(root, ".progressor/.gitignore"), "utf8");
const project = () => new Project({ root, session: { id: "s-a", pid: process.pid } });

beforeEach(() => {
  root = tempDir("progressor-private-");
});

describe("a new plan stays out of git", () => {
  it("ignores everything in .progressor/ when the first change starts a plan, and says how to share it", () => {
    project().addGoal("Dark mode", [{ title: "Add the switch" }]);
    expect(ignore()).toBe(PRIVATE_GITIGNORE);
    expect(ignore()).toMatch(/^\*$/m);
    expect(ignore()).toMatch(/share/i);
  });

  it("keeps it private when init starts the plan", () => {
    applyChanges(planInit(root, launchFor({ viaNpx: false, platform: "linux" })));
    expect(ignore()).toBe(PRIVATE_GITIGNORE);
  });

  it("keeps the private line when talk/ and pictures/ are added", () => {
    const p = project();
    p.addGoal("Dark mode", [{ title: "Add the switch" }]);
    p.sendMessage("dark-mode", "Hello");
    expect(ignore().startsWith(PRIVATE_GITIGNORE)).toBe(true);
    expect(ignore()).toMatch(/^talk\/$/m);
  });

  it("tells the AI how to put the plan in git when the Developer asks, and how to make it private again", () => {
    expect(INSTRUCTIONS).toMatch(/\.progressor\/\.gitignore/);
    expect(INSTRUCTIONS).toMatch(/in git/);
  });

  it("leaves a plan that already exists as it is, so a shared plan stays shared", () => {
    mkdirSync(join(root, ".progressor"));
    writeFileSync(join(root, ".progressor/roadmap.md"), "# Roadmap\n\n## Goals\n");
    project().addGoal("Dark mode", [{ title: "Add the switch" }]);
    expect(existsSync(join(root, ".progressor/.gitignore"))).toBe(false);
    expect(planInit(root, launchFor({ viaNpx: false, platform: "linux" })).map((c) => c.file)).not.toContain(".progressor/.gitignore");
  });
});
