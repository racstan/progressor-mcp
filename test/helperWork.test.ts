import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { buildGoalGraph, type TaskNode } from "../src/dashboard/graph.js";
import { gitBranches } from "../src/helperWork.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { helperLine, evidenceLine } from "../src/ui/words.js";
import { tempDir } from "./tmp.js";

let root: string;
let clock: Date;
const at = (iso: string) => {
  clock = new Date(iso);
};
const agent = () => new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => clock });
const read = (path: string) => readFileSync(join(root, ".progressor", path), "utf8");
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stdio: "pipe" }).toString();

beforeEach(() => {
  root = tempDir("progressor-helper-");
  at("2026-10-26T10:00:00.000Z");
});

function plan(goal = "Login") {
  const p = agent();
  p.addGoal(goal, [{ title: "Route" }, { title: "Callback" }]);
  p.claimGoal("login");
  return p;
}

describe("helper info and evidence in the plan file", () => {
  const md = `# Login\n\n## Tasks\n\n- [/] Route ^t1\n  - state: with a helper\n  - helper: Sonnet\n  - helper branch: feat/route\n  - helper folder: /tmp/wt-route\n- [/] Callback ^t2\n  - state: checked\n  - evidence: 715 passed, live send OK\n  - checked since: 2026-10-26T09:00:00.000Z\n`;

  it("reads the lines and gives back the same bytes", () => {
    const p = parsePlanFile(md, "login");
    const [a, b] = p.tasks;
    expect(a!.helper).toEqual({ label: "Sonnet", branch: "feat/route", folder: "/tmp/wt-route" });
    expect(b!.evidence).toBe("715 passed, live send OK");
    expect(b!.checkedSince).toBe("2026-10-26T09:00:00.000Z");
    expect(b!.helper).toBeUndefined();
    expect(p.toString()).toBe(md);
  });

  it("writes them in a fixed place and keeps helper info after a release, evidence through done", () => {
    const p = parsePlanFile(`# Login\n\n## Tasks\n\n- [ ] Route ^t1\n  - estimate: 1h\n`, "login");
    p.now = () => new Date("2026-10-26T10:00:00.000Z");
    p.setTaskStatus("t1", "with a helper", { helper: { branch: "feat/route", folder: "/w", label: "Haiku" } });
    expect(p.toString()).toContain("  - state: with a helper\n  - helper: Haiku\n  - helper branch: feat/route\n  - helper folder: /w\n  - estimate: 1h");
    p.setTaskStatus("t1", "checked", { evidence: "all green" });
    expect(p.task("t1")).toMatchObject({ evidence: "all green", checkedSince: "2026-10-26T10:00:00.000Z", helper: { branch: "feat/route" } });
    p.setTaskStatus("t1", "released");
    expect(p.task("t1")).toMatchObject({ evidence: "all green", helper: { branch: "feat/route" } });
    expect(p.task("t1")!.checkedSince).toBeUndefined();
    p.setTaskStatus("t1", "with a helper"); // back to the helper: the old check no longer counts
    expect(p.task("t1")!.evidence).toBeUndefined();
    expect(p.task("t1")!.helper!.branch).toBe("feat/route");
  });

  it("keeps the line breaks out of the values", () => {
    const p = parsePlanFile(`# L\n\n## Tasks\n\n- [ ] A ^t1\n`, "l");
    p.setTaskStatus("t1", "checked", { evidence: "one\ntwo  three" });
    expect(p.task("t1")!.evidence).toBe("one two three");
  });
});

describe("through the Project", () => {
  it("records helper info only with 'with a helper', and evidence only with 'checked'", () => {
    const p = plan();
    expect(() => p.setTaskState("t1", "checked", undefined, { helper: { branch: "x" } })).toThrow(/with a helper/);
    expect(() => p.setTaskState("t1", "with a helper", undefined, { evidence: "ok" })).toThrow(/checked/);
    p.setTaskState("t1", "with a helper", undefined, { helper: { branch: "feat/route", folder: "/w", label: "Sonnet" } });
    p.updateTasks([{ action: "state", task: "t1", state: "checked", evidence: "715 passed" }]);
    expect(p.plan("login").task("t1")).toMatchObject({ status: "checked", evidence: "715 passed", helper: { branch: "feat/route" } });
    expect(() => p.updateTasks([{ action: "state", task: "t2", state: "released", evidence: "x" }])).toThrow(/checked/);
  });

  it("leaves a plan without any of it unchanged", () => {
    const p = plan();
    p.setTaskState("t1", "with a helper");
    expect(read("goals/login.md")).toContain("- [/] Route ^t1\n  - state: with a helper\n  - timing since");
    expect(read("goals/login.md")).not.toContain("helper:");
  });
});

describe("the orphan check", () => {
  function repo() {
    git("init", "-q", "-b", "main");
    writeFileSync(join(root, "a.txt"), "a");
    git("add", "a.txt");
    git("commit", "-q", "-m", "first");
  }
  function branchWithWork(name: string) {
    git("checkout", "-q", "-b", name);
    writeFileSync(join(root, `${name.replace("/", "-")}.txt`), "x");
    git("add", ".");
    git("commit", "-q", "-m", name);
    git("checkout", "-q", "main");
  }

  it("lists the branches and the ones merged into HEAD", () => {
    repo();
    branchWithWork("feat/a");
    git("branch", "feat/merged");
    const g = gitBranches(root)!;
    expect([...g.exists].sort()).toEqual(["feat/a", "feat/merged", "main"]);
    expect([...g.merged].sort()).toEqual(["feat/merged", "main"]);
  });

  it("says nothing without git or outside a repository", () => {
    expect(gitBranches(root)).toBeUndefined();
    const saved = process.env.PATH;
    try {
      process.env.PATH = "";
      expect(gitBranches(root)).toBeUndefined();
    } finally {
      process.env.PATH = saved;
    }
  });

  it("warns about finished Tasks whose helper branch still has unmerged work, and only those", () => {
    repo();
    branchWithWork("feat/route");
    branchWithWork("feat/cb");
    git("branch", "feat/old");
    const p = plan();
    p.addTasks([{ title: "Logout" }, { title: "Old" }]);
    p.setTaskState("t1", "with a helper", undefined, { helper: { branch: "feat/route", folder: "/w/route", label: "Sonnet" } });
    p.setTaskState("t2", "with a helper", undefined, { helper: { branch: "feat/cb", folder: "/w/cb" } });
    p.setTaskState("t3", "with a helper", undefined, { helper: { branch: "feat/gone" } });
    p.setTaskState("t4", "with a helper", undefined, { helper: { branch: "feat/old" } });
    expect(p.helperWarnings()).toEqual([]); // still with a helper: not orphaned
    p.setTaskState("t1", "released");
    p.completeTask("t3");
    p.completeTask("t4");
    p.dropTask("t2", "not needed");
    const w = p.helperWarnings();
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("Task t1 Route in goal login is released, but its helper branch feat/route still has work that is not merged");
    expect(w[0]).toContain("folder /w/route");
    expect(w[1]).toContain("Task t2 Callback in goal login is dropped, but its helper branch feat/cb");
  });

  it("warns about a Task checked for more than a day", () => {
    const p = plan();
    p.setTaskState("t1", "checked");
    at("2026-10-26T20:00:00.000Z");
    expect(p.helperWarnings()).toEqual([]);
    at("2026-10-27T11:00:00.000Z");
    expect(p.helperWarnings()[0]).toContain("Task t1 Route in goal login has been checked for 25 h");
  });

  it("never fails when git is missing", () => {
    const p = plan();
    p.setTaskState("t1", "with a helper", undefined, { helper: { branch: "feat/x" } });
    p.completeTask("t1");
    expect(p.helperWarnings()).toEqual([]);
  });
});

describe("through the tools", () => {
  let client: Client;
  beforeEach(async () => {
    const server = createServer(agent());
    const [c, s] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(s), client.connect(c)]);
  });
  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  }

  it("takes helper info and evidence, and shows them in get_status and get_item", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }, { title: "Callback" }] });
    await call("set_task_state", { task: "t1", state: "with a helper", helper_branch: "feat/route", helper_folder: "/w/route", helper_label: "Sonnet" });
    await call("update_tasks", { operations: [{ action: "state", task: "t2", state: "with a helper", helper_branch: "feat/cb" }] });
    let status = (await call("get_status")).text;
    expect(status).toContain("With a helper: t1 Route (Sonnet, branch feat/route, folder /w/route); t2 Callback (branch feat/cb)");
    await call("set_task_state", { task: "t1", state: "checked", evidence: "715 passed, live send OK" });
    status = (await call("get_status")).text;
    expect(status).toContain("Checked, not yet released: t1 Route (evidence: 715 passed, live send OK; Sonnet, branch feat/route, folder /w/route)");
    const item = (await call("get_item", { ref: "progressor://login/t1" })).text;
    expect(item).toContain("Evidence: 715 passed, live send OK");
    expect(item).toContain("Helper: Sonnet, branch feat/route, folder /w/route");
    expect(read("goals/login.md")).toContain("  - helper branch: feat/route");
  });

  it("refuses helper info with another state, with a message that says what to do", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    const r = await call("set_task_state", { task: "t1", state: "checked", helper_branch: "x" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/with a helper/);
  });

  it("shows the orphan warnings in get_status", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    await call("set_task_state", { task: "t1", state: "checked" });
    at("2026-10-28T10:00:00.000Z");
    expect((await call("get_status")).text).toContain("Warning: Task t1 Route in goal login has been checked for 48 h");
  });
});

describe("on the dashboard", () => {
  it("carries the helper info and evidence on the step", () => {
    const p = parsePlanFile(
      `# L\n\n## Tasks\n\n- [/] A ^t1\n  - state: checked\n  - helper branch: feat/a\n  - evidence: 12 passed\n`,
      "l",
    );
    const node = buildGoalGraph(p).nodes[0] as TaskNode;
    expect(node.helper).toEqual({ branch: "feat/a" });
    expect(node.evidence).toBe("12 passed");
  });

  it("words them in plain English", () => {
    expect(helperLine({ label: "Sonnet", branch: "feat/a", folder: "/w/a" })).toBe("Helper: Sonnet · branch feat/a · folder /w/a");
    expect(helperLine({ branch: "feat/a" })).toBe("Helper: branch feat/a");
    expect(helperLine(undefined)).toBeUndefined();
    expect(evidenceLine("12 passed")).toBe("Checked: 12 passed");
    expect(evidenceLine(undefined)).toBeUndefined();
  });
});
