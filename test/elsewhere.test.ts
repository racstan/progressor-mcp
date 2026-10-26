import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectEntry, registerProject } from "../src/dashboard/registry.js";
import { dashboardApi } from "../src/dashboard/http.js";
import { changesSince, elsewhereLine, lastSeen, resolveProject, seenFile, takeElsewhereLine } from "../src/elsewhere.js";
import { runHook } from "../src/hooks.js";
import { lockFile, withLock } from "../src/lock.js";
import { formatOrigin, parseOrigin } from "../src/origin.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { elsewhereTag, lastChangeFromElsewhere, statusLine } from "../src/ui/words.js";
import { tempDir } from "./tmp.js";

// Two projects: "here" (where the Agent works) and "there" (the plan it changes from here).
let registry: string;
let here: string;
let there: string;
const alive = new Set<number>();
const isAlive = (pid: number) => alive.has(pid);

function folder(name: string, plan = true): string {
  const dir = join(tempDir("progressor-"), name);
  mkdirSync(plan ? join(dir, ".progressor") : dir, { recursive: true });
  return dir;
}

const local = (root: string, id = "s-here", pid = 100) => {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive });
};

beforeEach(() => {
  registry = join(tempDir("progressor-registry-"), "projects.json");
  here = folder("kdeaichat");
  there = folder("progressor-mcp");
  registerProject(here, registry);
  registerProject(there, registry);
  alive.clear();
});

describe("resolveProject", () => {
  it("finds a project by its ID, its name or its folder's full path", () => {
    const { id } = projectEntry(there);
    expect(resolveProject(id, { registryFile: registry }).root).toBe(there);
    expect(resolveProject("progressor-mcp", { registryFile: registry }).root).toBe(there);
    expect(resolveProject("PROGRESSOR-MCP", { registryFile: registry }).id).toBe(id);
    expect(resolveProject(there, { registryFile: registry })).toMatchObject({ id, name: "progressor-mcp", root: there });
  });

  it("turns a path into the real folder it points at", () => {
    const link = join(tempDir("progressor-"), "link");
    symlinkSync(there, link);
    expect(resolveProject(link, { registryFile: registry }).root).toBe(there);
    expect(resolveProject(`${there}/../progressor-mcp`, { registryFile: registry }).root).toBe(there);
  });

  it("refuses an unknown project, and a folder without a plan", () => {
    const none = () => [];
    expect(() => resolveProject("nope", { registryFile: registry, projects: none })).toThrow(/No project called nope/);
    expect(() => resolveProject("../progressor-mcp", { registryFile: registry, projects: none })).toThrow(/No project called/);
    const bare = folder("bare", false);
    expect(() => resolveProject(bare, { registryFile: registry })).toThrow(/has no Progressor plan/);
    expect(() => resolveProject(join(bare, "missing"), { registryFile: registry })).toThrow(/has no Progressor plan/);
    expect(existsSync(join(bare, ".progressor"))).toBe(false);
  });

  it("asks which one when two projects share a name", () => {
    const twin = folder("progressor-mcp");
    registerProject(twin, registry);
    expect(() => resolveProject("progressor-mcp", { registryFile: registry })).toThrow(/Several projects are called progressor-mcp/);
    expect(resolveProject(projectEntry(twin).id, { registryFile: registry }).root).toBe(twin);
  });
});

describe("Changing another project's plan", () => {
  const from = () => local(here).elsewhere(there, "kdeaichat");

  it("records a finished Goal, marked as updated from the other project", () => {
    const goal = from().addGoal("Release 0.7.1", [{ title: "Tag v0.7.1", done: true }], { id: "v0-7-1", done: true });
    expect(goal.status).toBe("done");
    expect(goal.updatedFrom?.project).toBe("kdeaichat");
    const roadmap = readFileSync(join(there, ".progressor", "roadmap.md"), "utf8");
    expect(roadmap).toMatch(/- \[x\] \[Release 0\.7\.1\]\(goals\/v0-7-1\.md\) \^v0-7-1\n  - updated from: kdeaichat at \d{4}-\d\d-\d\dT[\d:.]+Z\n/);
    const plan = readFileSync(join(there, ".progressor", "goals", "v0-7-1.md"), "utf8");
    expect(plan).toMatch(/- \[x\] Tag v0\.7\.1 \^t1\n  - updated from: kdeaichat at /);
    expect(local(there, "s-there", 200).plan("v0-7-1").tasks[0]!.updatedFrom?.project).toBe("kdeaichat");
  });

  it("changes a Goal no running Session holds, without claiming it", () => {
    const owner = local(there, "s-there", 200);
    owner.addGoal("Ship it", [{ title: "Build" }, { title: "Test" }]);
    const other = from();
    other.updateTasks([{ action: "complete", task: "t1" }, { action: "start", task: "t2" }], "ship-it");
    other.addDecision("Ship on Fridays", "ship-it");
    const goal = owner.roadmap().goal("ship-it")!;
    expect(goal.claim).toBeUndefined();
    // Started from elsewhere: it reads as paused, not "not started" with a step done.
    expect(goal.status).toBe("paused");
    const plan = owner.plan("ship-it");
    expect(plan.tasks.map((t) => [t.status, t.updatedFrom?.project])).toEqual([["done", "kdeaichat"], ["in progress", "kdeaichat"]]);
    expect(plan.decisions[0]!.updatedFrom?.project).toBe("kdeaichat");
    other.completeTask("t2", ["src/x.ts"], undefined, "ship-it");
    expect(other.completeGoal("ship-it").status).toBe("done");
  });

  it("needs the Goal named, since nothing is claimed there", () => {
    local(there, "s-there", 200).addGoal("Ship it", [{ title: "Build" }]);
    expect(() => from().addTasks([{ title: "More" }])).toThrow(/Say which Goal with goal/);
  });

  it("leaves a Goal a running Session holds alone, but for notes", () => {
    const owner = local(there, "s-there", 200);
    owner.addGoal("Ship it", [{ title: "Build" }], { outcome: "Out" });
    owner.claimGoal("ship-it");
    owner.addNote("ship-it", "Their own note");
    const other = from();
    const refused = /being worked on by an AI chat in that project \(Session s-there, still running\)/;
    expect(() => other.addTasks([{ title: "More" }], "ship-it")).toThrow(refused);
    expect(() => other.setTaskState("t1", "done", "ship-it")).toThrow(refused);
    expect(() => other.updateTasks([{ action: "complete", task: "t1" }], "ship-it")).toThrow(refused);
    expect(() => other.completeGoal("ship-it")).toThrow(refused);
    expect(() => other.addDecision("No", "ship-it")).toThrow(refused);
    expect(() => other.updateGoal("ship-it", { title: "Renamed" })).toThrow(refused);
    expect(() => other.moveGoal("ship-it", { after: "ship-it" })).toThrow(refused);
    expect(() => other.updateNote("ship-it", "n1", { resolved: true })).toThrow(refused);
    const note = other.addNote("ship-it", "Released from the kdeaichat chat");
    expect(note.updatedFrom?.project).toBe("kdeaichat");
    expect(note.from).toBeUndefined();
    expect(owner.plan("ship-it").tasks[0]!.status).toBe("pending");
    expect(owner.roadmap().goal("ship-it")!.claim?.session).toBe("s-there");
  });

  it("changes a Goal whose Session has ended, leaving the old Claim for that project to clear", () => {
    const owner = local(there, "s-there", 200);
    owner.addGoal("Ship it", [{ title: "Build" }]);
    owner.claimGoal("ship-it");
    alive.delete(200);
    from().setTaskState("t1", "done", "ship-it");
    expect(owner.plan("ship-it").tasks[0]!.status).toBe("done");
  });

  it("refuses finished and dropped Goals, except for notes and renames", () => {
    const other = from();
    other.addGoal("Old", [{ title: "Done", done: true }], { done: true });
    expect(() => other.addTasks([{ title: "More" }], "old")).toThrow(/finished. To add to it, reopen it from its own project/);
    expect(other.updateGoal("old", { outcome: "It shipped" }).outcome).toBe("It shipped");
    other.addNote("old", "Seen later");
  });

  it("never starts a plan in a folder that has none", () => {
    const bare = folder("bare", false);
    expect(() => local(here).elsewhere(bare, "kdeaichat").addGoal("X")).toThrow(/never started from another project/);
    expect(existsSync(join(bare, ".progressor"))).toBe(false);
  });

  it("leaves this project's own changes unmarked", () => {
    const own = local(here);
    own.addGoal("Mine", [{ title: "Step" }]);
    expect(own.roadmap().goal("mine")!.updatedFrom).toBeUndefined();
    expect(readFileSync(join(here, ".progressor", "goals", "mine.md"), "utf8")).not.toContain("updated from");
  });
});

describe("the updated from line", () => {
  it("reads back what it writes, and a hand-written one without a time", () => {
    const o = { project: "kdeaichat", at: "2026-10-26T12:00:00.000Z" };
    expect(formatOrigin(o)).toBe("kdeaichat at 2026-10-26T12:00:00.000Z");
    expect(parseOrigin(formatOrigin(o))).toEqual(o);
    expect(parseOrigin("look at me at 2026-10-26T12:00:00.000Z")).toEqual({ project: "look at me", at: "2026-10-26T12:00:00.000Z" });
    expect(parseOrigin("kdeaichat")).toEqual({ project: "kdeaichat", at: undefined });
    expect(parseOrigin("  ")).toBeUndefined();
  });

  it("goes after a Task's other details, and a later change from elsewhere replaces it", () => {
    const plan = parsePlanFile("# G\n\n## Tasks\n\n- [ ] Build ^t1\n  - code: `a.ts`\n", "g");
    plan.markOrigin("t1", { project: "one", at: "2026-10-26T12:00:00.000Z" });
    plan.updateTask("t1", { summary: "Build it" });
    plan.markOrigin("t1", { project: "two", at: "2026-10-26T13:00:00.000Z" });
    expect(plan.toString()).toBe(
      "# G\n\n## Tasks\n\n- [ ] Build ^t1\n  - summary: Build it\n  - code: `a.ts`\n  - updated from: two at 2026-10-26T13:00:00.000Z\n",
    );
    expect(() => plan.markOrigin("t9", { project: "x", at: undefined })).toThrow(/No Task, decision or note t9/);
  });
});

describe("telling the project's own Session", () => {
  const seen = () => seenFile(registry);

  it("lists the changes made from elsewhere once, then not again", () => {
    const owner = local(there, "s-there", 200);
    owner.addGoal("Ship it", [{ title: "Build" }]);
    expect(takeElsewhereLine(owner, seen())).toBeUndefined();
    const other = local(here).elsewhere(there, "kdeaichat");
    other.addGoal("Release 0.7.1", [{ title: "Tag", done: true }], { done: true });
    other.addNote("ship-it", "Found a bug");
    const line = takeElsewhereLine(owner, seen())!;
    expect(line).toMatch(/^Changed from elsewhere since you last looked \(by an AI chat working in another project\): /);
    expect(line).toContain('Goal release-0-7-1 "Release 0.7.1" (from kdeaichat)');
    expect(line).toContain('Task release-0-7-1/t1 "Tag" (from kdeaichat)');
    expect(line).toContain('Note ship-it/n1 "Found a bug" (from kdeaichat)');
    expect(lastSeen(there, seen())).toBeGreaterThan(0);
    expect(takeElsewhereLine(owner, seen())).toBeUndefined();
    const later = Date.now() + 5;
    while (Date.now() < later); // a change in a later millisecond than the ones already seen
    other.updateTask("t1", { summary: "Build it" }, "ship-it");
    expect(takeElsewhereLine(owner, seen())).toBe(
      'Changed from elsewhere since you last looked (by an AI chat working in another project): Task ship-it/t1 "Build" (from kdeaichat).',
    );
  });

  it("keeps the line short when much changed", () => {
    const other = local(here).elsewhere(there, "kdeaichat");
    other.addGoal("Big", Array.from({ length: 12 }, (_, i) => ({ title: `Step ${i + 1}` })));
    const line = elsewhereLine(changesSince(local(there, "s-there", 200), 0))!;
    expect(line).toContain("and 5 more");
  });

  it("puts the line in Claude Code's reminder once", () => {
    const owner = local(there, "s-there", 4242);
    owner.addGoal("Ship it", [{ title: "Build" }]);
    owner.claimGoal("ship-it");
    local(here).elsewhere(there, "kdeaichat").addNote("ship-it", "Released 0.7.1 from the other chat");
    const prompt = JSON.stringify({ cwd: there, hook_event_name: "UserPromptSubmit" });
    const run = () => runHook({ event: "prompt", input: prompt, env: { PROGRESSOR_REGISTRY: registry }, isAlive: () => true });
    const first = run().split("\n");
    expect(first[0]).toMatch(/^\[Progressor\] Goal: Ship it/);
    expect(first[1]).toBe(
      '[Progressor] Changed from elsewhere since you last looked (by an AI chat working in another project): Note ship-it/n1 "Released 0.7.1 from the other chat" (from kdeaichat).',
    );
    expect(run()).not.toContain("Changed from elsewhere");
  });
});

describe("the dashboard", () => {
  it("says which project a goal was last changed from", () => {
    local(there, "s-there", 200).addGoal("Ship it", [{ title: "Build" }]);
    local(here).elsewhere(there, "kdeaichat").setTaskState("t1", "done", "ship-it");
    const api = dashboardApi(new Project({ root: there, session: { id: "dashboard", pid: 1 }, clearStaleClaims: false }));
    const goal = api.roadmap().goals[0]!;
    expect(goal.fromElsewhere?.project).toBe("kdeaichat");
    const view = api.goal("ship-it")!;
    const task = view.graph.nodes[0]!;
    expect(task.kind === "task" && task.updatedFrom?.project).toBe("kdeaichat");
  });

  it("tags what was changed from elsewhere, with a hover that explains it", () => {
    const now = Date.parse("2026-10-26T12:10:00.000Z");
    expect(elsewhereTag(undefined)).toBeUndefined();
    expect(elsewhereTag({ project: "kdeaichat", at: "2026-10-26T12:00:00.000Z" }, now)).toEqual({
      label: "Updated from kdeaichat",
      hint: "This was changed by an AI chat working in another project, kdeaichat, 10 min ago. Your AI in this project is told about it.",
    });
    expect(elsewhereTag({ project: "kdeaichat" }, now)!.hint).toBe(
      "This was changed by an AI chat working in another project, kdeaichat. Your AI in this project is told about it.",
    );
  });

  it("adds the project to the status line while the latest change came from it", () => {
    const now = Date.parse("2026-10-26T12:10:00.000Z");
    const fromElsewhere = { project: "kdeaichat", at: "2026-10-26T12:00:00.000Z" };
    const at = Date.parse(fromElsewhere.at);
    expect(statusLine({ status: "done", updatedAt: at, running: undefined, fromElsewhere }, ["done", "done"], now)).toBe(
      "Finished 10 min ago · 2 steps · updated from kdeaichat",
    );
    expect(statusLine({ status: "paused", updatedAt: at + 500, running: undefined, fromElsewhere }, ["done", "pending"], now + 500)).toBe(
      "Paused · step 2 of 2 · last update 10 min ago · updated from kdeaichat",
    );
    // A change made in the project itself since then is the latest one.
    expect(lastChangeFromElsewhere({ updatedAt: at + 60_000, fromElsewhere })).toBe(false);
    expect(statusLine({ status: "paused", updatedAt: at + 60_000, running: undefined, fromElsewhere }, ["pending"], now)).not.toContain("kdeaichat");
  });
});

describe("the tools", () => {
  let client: Client;

  beforeEach(async () => {
    const server = createServer(local(here, "s-here", process.pid), { registryFile: registry });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(b), client.connect(a)]);
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError ?? false };
  }

  it("take project on the tools where it makes sense", async () => {
    const { tools } = await client.listTools();
    const withProject = tools.filter((t) => "project" in ((t.inputSchema as { properties?: object }).properties ?? {})).map((t) => t.name);
    expect(withProject.sort()).toEqual(
      [
        "add_decision", "add_goal", "add_note", "add_tasks", "complete_goal", "complete_task", "get_status",
        "move_goal", "set_task_state", "update_goal", "update_note", "update_task", "update_tasks",
      ].sort(),
    );
  });

  it("record a finished Goal in another project, and show that project's plan", async () => {
    const added = await call("add_goal", {
      project: "progressor-mcp",
      title: "Release 0.7.1",
      id: "v0-7-1",
      done: true,
      tasks: [{ title: "Tag v0.7.1", done: true }],
    });
    expect(added).toEqual({
      isError: false,
      text: "Recorded finished Goal v0-7-1 (progressor://v0-7-1) with 1 done Tasks.\nThat was in project progressor-mcp; it is marked there as updated from kdeaichat.",
    });
    expect(existsSync(join(here, ".progressor", "goals", "v0-7-1.md"))).toBe(false);
    const status = await call("get_status", { project: there });
    expect(status.text).toContain(`Project progressor-mcp (${there}): another project's plan, seen from kdeaichat.`);
    expect(status.text).toContain("- v0-7-1: Release 0.7.1 (done)");
    await call("add_goal", { project: "progressor-mcp", title: "Release 0.7.0", id: "v0-7-0", done: true });
    const moved = await call("move_goal", { project: "progressor-mcp", goal: "v0-7-1", after: "v0-7-0" });
    expect(moved.text).toBe(
      "Goals in order:\n- v0-7-0: Release 0.7.0 (done)\n- v0-7-1: Release 0.7.1 (done)\nThat was in project progressor-mcp; it is marked there as updated from kdeaichat.",
    );
  });

  it("refuse to claim a Goal in another project", async () => {
    const r = await call("add_goal", { project: "progressor-mcp", title: "Work", claim: true });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/cannot be claimed from here/);
  });

  it("say clearly when the project is not known", async () => {
    const r = await call("add_note", { project: "nowhere-at-all", goal: "x", text: "y" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/No project called nowhere-at-all/);
  });

  it("behave as before without project, and treat this project's own name as this project", async () => {
    await call("add_goal", { title: "Mine", tasks: [{ title: "Step" }], claim: true });
    const r = await call("set_task_state", { task: "t1", state: "with a helper", project: "kdeaichat" });
    expect(r.text).toMatch(/^Task t1 Step is now with a helper\.\nNow: /);
    expect(readFileSync(join(here, ".progressor", "goals", "mine.md"), "utf8")).not.toContain("updated from");
  });

  it("tell this project's Session about changes made from elsewhere in get_status, once", async () => {
    local(there).elsewhere(here, "progressor-mcp").addGoal("Theirs", [], { done: true });
    const first = await call("get_status");
    expect(first.text).toContain('Changed from elsewhere since you last looked (by an AI chat working in another project): Goal theirs "Theirs" (from progressor-mcp).');
    expect((await call("get_status")).text).not.toContain("Changed from elsewhere");
  });
});

describe("withLock", () => {
  let child: ChildProcess | undefined;
  afterEach(() => child?.kill());

  /** Another process holding the plan of `root` for `ms`, ready once it says so. */
  async function holder(root: string, ms: number): Promise<void> {
    const file = lockFile(root);
    child = spawn(process.execPath, [
      "-e",
      `const fs=require("fs");fs.writeFileSync(${JSON.stringify(file)}, process.pid+" x",{flag:"wx"});console.log("ready");setTimeout(()=>fs.rmSync(${JSON.stringify(file)}),${ms});setTimeout(()=>{},${ms + 5000});`,
    ]);
    await new Promise<void>((resolve, reject) => {
      child!.stdout!.on("data", () => resolve());
      child!.on("exit", (code) => reject(new Error(`holder exited ${code}`)));
    });
  }

  it("waits for another process that holds the plan, then runs", async () => {
    await holder(there, 300);
    const start = Date.now();
    expect(withLock(there, () => "ran")).toBe("ran");
    expect(Date.now() - start).toBeGreaterThanOrEqual(200);
    expect(existsSync(lockFile(there))).toBe(false);
  });

  it("says the plan is busy when the hold is not given back in time", async () => {
    await holder(there, 3000);
    expect(() => withLock(there, () => "ran", { timeoutMs: 100 })).toThrow(/is busy: another Progressor is changing it/);
  });

  it("takes over a hold whose process has ended, and lets this process nest", () => {
    writeFileSync(lockFile(there), "999999 gone");
    expect(withLock(there, () => withLock(there, () => "nested"), { isAlive: () => false })).toBe("nested");
    expect(existsSync(lockFile(there))).toBe(false);
  });
});
