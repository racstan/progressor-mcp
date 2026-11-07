import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import type { GitFacts } from "../src/gitFacts.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

let root: string;
let settings: string;
let facts: { commits: string[] | undefined; dirty: boolean | undefined; branch: string | undefined; asked: { since?: string; files: string[] }[] };
const fakeGit: GitFacts = {
  commitsSince: (_root, since, files) => {
    facts.asked.push({ since, files });
    return facts.commits;
  },
  dirty: () => facts.dirty,
  branch: () => facts.branch,
  commitLink: () => "https://github.com/o/r/commit/",
};
const plan = () => readFileSync(join(root, ".progressor", "goals", "login.md"), "utf8");

beforeEach(() => {
  root = tempDir("progressor-evidence-");
  settings = join(tempDir("progressor-settings-"), "settings.json");
  facts = { commits: ["b2c3d4e", "a1b2c3d"], dirty: false, branch: "main", asked: [] };
});

async function connect() {
  const p = new Project({ root, session: { id: "s", pid: process.pid }, git: fakeGit });
  p.addGoal("Login", [{ title: "Route", code: ["src/route.ts:12"] }, { title: "Callback" }]);
  p.claimGoal("login");
  const server = createServer(p, { settingsFile: settings });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "t", version: "1" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: !!r.isError };
  };
  return { p, call };
}

describe("a finished step records its commits, branch and tests", () => {
  it("finds the commits since the step started, for its files", async () => {
    const { call } = await connect();
    await call("start_task", { task: "t1" });
    const r = await call("complete_task", { task: "t1", tests: "715 passed" });
    expect(r.isError).toBe(false);
    expect(r.text).not.toContain("Warning");
    expect(facts.asked.at(-1)!.files).toEqual(["src/route.ts:12"]);
    expect(facts.asked.at(-1)!.since).toBeTruthy();
    expect(plan()).toContain("  - commits: b2c3d4e a1b2c3d\n  - branch: main\n  - tests: 715 passed\n");
  });

  it("takes the commits the AI names over the ones it finds", async () => {
    const { call } = await connect();
    await call("update_tasks", { operations: [{ action: "complete", task: "t2", commits: ["ffff111"], tests: "12 passed" }] });
    expect(plan()).toContain("  - commits: ffff111\n  - branch: main\n  - tests: 12 passed\n");
  });

  it("warns in one line when the step's files have changes not saved in git", async () => {
    facts.dirty = true;
    const { call } = await connect();
    const r = await call("complete_task", { task: "t1" });
    expect(r.text).toContain("Warning: t1 is done but its files have changes not saved in git.");
    expect(plan()).toContain("  - uncommitted: yes\n");
  });

  it("records them when a step is set done or released by state too", async () => {
    const { call } = await connect();
    await call("set_task_state", { task: "t1", state: "released" });
    expect(plan()).toContain("  - branch: main\n");
  });

  it("takes them away again when the step is reopened", async () => {
    facts.dirty = true;
    const { call } = await connect();
    await call("complete_task", { task: "t1", tests: "1 passed" });
    await call("set_task_state", { task: "t1", state: "pending" });
    expect(plan()).not.toMatch(/commits:|branch:|tests:|uncommitted:/);
  });

  it("records nothing when the setting is off, and does not warn when that is off", async () => {
    writeSettings(settings, "evidence", { record: false });
    facts.dirty = true;
    const { call } = await connect();
    const r = await call("complete_task", { task: "t1", tests: "1 passed" });
    expect(plan()).not.toMatch(/commits:|branch:|tests:|uncommitted:/);
    expect(r.text).not.toContain("Warning");
    writeSettings(settings, "evidence", { record: true, warnUncommitted: false });
    const again = await call("complete_task", { task: "t2" });
    expect(again.text).not.toContain("Warning");
  });

  it("says nothing extra when git knows nothing", async () => {
    facts = { commits: undefined, dirty: undefined, branch: undefined, asked: [] };
    const { call } = await connect();
    const r = await call("complete_task", { task: "t1" });
    expect(r.text).not.toContain("Warning");
    expect(plan()).not.toMatch(/commits:|branch:|uncommitted:/);
  });

  it("gives the page the step's evidence and the commit link", async () => {
    const { p, call } = await connect();
    await call("complete_task", { task: "t1", tests: "715 passed" });
    const t = p.plan("login").task("t1")!;
    expect(t.commits).toEqual(["b2c3d4e", "a1b2c3d"]);
    expect(t.branch).toBe("main");
    expect(t.tests).toBe("715 passed");
    expect(t.uncommitted).toBeFalsy();
    expect(p.commitLink()).toBe("https://github.com/o/r/commit/");
  });
});
