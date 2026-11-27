// Fewer calls for the AI: update_tasks and complete_goal carry hand tests, decisions and the next goal;
// get_item takes several refs; get_status and add_goal answer shorter.
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer, INSTRUCTIONS } from "../src/server.js";
import { applyChanges, launchFor, planInit } from "../src/init.js";
import { tempDir } from "./tmp.js";

let root: string;
let registry: string;
let project: Project;

beforeEach(() => {
  root = tempDir("progressor-less-");
  registry = join(tempDir("progressor-reg-"), "registry.json");
});

async function connect(app = "t") {
  project = new Project({ root, session: { id: "s", pid: process.pid } });
  project.addGoal("Login", [{ title: "Route" }, { title: "Form" }]);
  project.addGoal("Billing", [{ title: "Checkout" }]);
  project.addStandingInstruction("Write tests first");
  project.setContext("A web app in TypeScript.");
  const server = createServer(project, { registryFile: registry, settingsFile: join(tempDir("progressor-settings-"), "settings.json"), claudeHome: tempDir("progressor-home-") });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: app, version: "1" });
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return r.content.map((c) => c.text).join("\n");
  };
}

describe("update_tasks with hand tests and decisions", () => {
  it("saves them with the completed step and says how many", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    await call("update_tasks", { operations: [{ action: "start", task: "t1" }] });
    const r = await call("update_tasks", {
      operations: [
        { action: "complete", task: "t1", hand_tests: ["Open /login and sign in", "Sign in with a wrong password"], decisions: ["Sessions last a day"] },
        { action: "start", task: "t2" },
      ],
    });
    expect(r).toContain("2 hand tests");
    expect(r).toContain("1 decision");
    const plan = project.plan("login");
    expect(plan.handTests.map((h) => [h.text, h.task])).toEqual([
      ["Open /login and sign in", "t1"],
      ["Sign in with a wrong password", "t1"],
    ]);
    expect(plan.decisions.map((d) => d.text)).toEqual(["Sessions last a day"]);
  });

  it("changes nothing when a later operation fails", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    await call("update_tasks", { operations: [{ action: "start", task: "t1" }] });
    const r = await call("update_tasks", {
      operations: [
        { action: "complete", task: "t1", hand_tests: ["Try it"], decisions: ["A choice"] },
        { action: "complete", task: "t9" },
      ],
    });
    expect(r.toLowerCase()).toMatch(/t9|no task|not found/);
    const plan = project.plan("login");
    expect(plan.handTests).toHaveLength(0);
    expect(plan.decisions).toHaveLength(0);
    expect(plan.tasks.find((t) => t.id === "t1")!.status).toBe("in progress");
  });

  it("refuses an empty hand test without changing anything", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    await call("update_tasks", { operations: [{ action: "start", task: "t1" }] });
    await call("update_tasks", { operations: [{ action: "complete", task: "t1", hand_tests: ["  "] }] });
    expect(project.plan("login").tasks.find((t) => t.id === "t1")!.status).toBe("in progress");
  });

  it("add_tasks with done takes hand_tests and decisions too", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    const r = await call("add_tasks", { tasks: [{ title: "Fix typo", done: true, hand_tests: ["Read the page"] }], decisions: ["Keep wording"] });
    expect(r).toContain("Saved hand test");
    expect(project.plan("login").handTests).toHaveLength(1);
    expect(project.plan("login").decisions).toHaveLength(1);
  });
});

describe("complete_goal with hand tests and next", () => {
  it("adds hand tests first so the goal waits on them, then claims the next goal", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "billing" });
    await call("update_tasks", { operations: [{ action: "start", task: "t1" }, { action: "complete", task: "t1" }] }).catch(() => undefined);
    await call("update_tasks", { operations: [{ action: "complete", task: "t1" }] });
    const r = await call("complete_goal", { hand_tests: ["Pay with a test card"], next: "login" });
    expect(r).toContain("waiting on the Developer's hand tests");
    expect(project.plan("billing").handTests).toHaveLength(1);
    expect(r).toContain("Goal: Login");
    expect(project.claimedGoals().map((g) => g.id)).toEqual(["login"]);
  });

  it("keeps the completion when the next goal cannot be claimed, and says why", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "billing" });
    await call("update_tasks", { operations: [{ action: "start", task: "t1" }, { action: "complete", task: "t1" }] });
    const r = await call("complete_goal", { next: "nope" });
    expect(r).toContain("Goal billing is done");
    expect(r).toMatch(/Could not claim nope/);
    expect(project.roadmap().goal("billing")!.status).toBe("done");
  });
});

describe("get_item with several refs", () => {
  it("returns each item, and reports a bad ref by itself", async () => {
    const call = await connect();
    const r = await call("get_item", { refs: ["progressor://login/t1", "progressor://login/t99", "progressor://login/t2"] });
    const parts = r.split("\n\n");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("Route");
    expect(parts[1]).toMatch(/t99/);
    expect(parts[2]).toContain("Form");
  });

  it("still takes one ref, and needs one of the two", async () => {
    const call = await connect();
    expect(await call("get_item", { ref: "progressor://login/t1" })).toContain("Route");
    expect(await call("get_item", {})).toMatch(/ref/);
  });
});

describe("shorter replies", () => {
  it("get_status repeats the rules in full only the first time, or when they change, or with full", async () => {
    const call = await connect("claude-code");
    applyChanges(planInit(root, launchFor({ viaNpx: false, platform: "linux" }), { server: false }));
    const first = await call("get_status");
    expect(first).toContain("- s1 Write tests first");
    const second = await call("get_status");
    expect(second).not.toContain("Write tests first");
    expect(second).toContain("unchanged since this chat last saw them");
    expect(await call("get_status", { full: true })).toContain("- s1 Write tests first");
    await call("save_standing_instruction", { text: "Use British English" });
    expect(await call("get_status")).toContain("Use British English");
  });

  for (const app of ["cursor", "claude-code"]) {
    it(`get_status always repeats the rules in ${app} without hooks, where nothing gives them back after compaction`, async () => {
      const call = await connect(app);
      await call("get_status");
      expect(await call("get_status")).toContain("- s1 Write tests first");
    });
  }

  it("add_goal without claim answers with the goal's id, title, steps and estimate only", async () => {
    const call = await connect();
    const r = await call("add_goal", { title: "Search", tasks: [{ title: "Index", estimate: "1h" }, { title: "Query", estimate: "30m" }] });
    expect(r).toContain("search");
    expect(r).toContain("Search");
    expect(r).toContain("2 steps");
    expect(r).toContain("1 h 30 m");
    expect(r).not.toContain("Standing Instructions");
    expect(r).not.toContain("Progress:");
  });

  it("add_goal with claim answers with the brief claim status", async () => {
    const call = await connect();
    const r = await call("add_goal", { title: "Search", tasks: [{ title: "Index" }], claim: true });
    expect(r).toContain("claimed by this Session");
    expect(r).toContain("Progress:");
  });
});

describe("instructions", () => {
  it("tell the AI to save few decisions, fold calls together, and load tools once", () => {
    expect(INSTRUCTIONS).toMatch(/surprise/);
    expect(INSTRUCTIONS).toMatch(/one update_tasks call/);
    expect(INSTRUCTIONS).toMatch(/select:/);
  });
});
