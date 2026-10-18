import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
const alive = new Set<number>();
const NOW = new Date("2026-10-18T15:00:00.000Z");

function session(id: string, pid: number): Project {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive: (p) => alive.has(p), now: () => NOW });
}

const read = (path: string) => readFileSync(join(root, ".progressor", path), "utf8");
const write = (path: string, text: string) => writeFileSync(join(root, ".progressor", path), text);

beforeEach(() => {
  root = tempDir("progressor-");
  alive.clear();
});

describe("working through a Goal", () => {
  it("creates the Roadmap and Plan File, and reports current and next Task", () => {
    const agent = session("s-a", 100);
    const goal = agent.addGoal("Ship OAuth login", [
      { title: "Add the /login route" },
      { title: "Handle the OAuth callback" },
    ]);
    agent.claimGoal(goal.id);
    agent.startTask("t1");
    agent.completeTask("t1", ["src/routes/login.ts"]);
    agent.startTask("t2");

    expect(read("roadmap.md")).toBe(`# Roadmap

## Goals

- [/] [Ship OAuth login](goals/ship-oauth-login.md) ^ship-oauth-login
  - claimed by: s-a (pid 100) since 2026-10-18T15:00:00.000Z
`);
    expect(read("goals/ship-oauth-login.md")).toBe(`# Ship OAuth login

## Tasks

- [x] Add the /login route ^t1
  - code: \`src/routes/login.ts\`
- [/] Handle the OAuth callback ^t2
`);
    const status = agent.status();
    expect(status.goal?.id).toBe("ship-oauth-login");
    expect(status.currentTask?.id).toBe("t2");
    expect(status.nextTask).toBeUndefined();
    expect(status.done).toBe(1);
    expect(status.total).toBe(2);
  });

  it("appends Tasks to the claimed Goal", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "one" }]);
    agent.claimGoal("g");
    const added = agent.addTasks([{ title: "two", code: ["src/two.ts:3"] }]);

    expect(added.map((t) => t.ref)).toEqual(["progressor://g/t2"]);
    expect(read("goals/g.md")).toContain("- [ ] two ^t2\n  - code: `src/two.ts:3`\n");
  });

  it("records a Task's title, files and summary, and updates them as the work goes", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "Fix callback redirect loop", summary: "Stop the loop.", code: ["src/auth/callback.ts"] }]);
    agent.claimGoal("g");
    agent.updateTask("t1", { summary: "Callback re-sets the session cookie on every hit; only set it after token exchange." });
    agent.completeTask("t1", ["src/auth/session.ts:42"]);

    expect(read("goals/g.md")).toContain(
      "- [x] Fix callback redirect loop ^t1\n" +
        "  - summary: Callback re-sets the session cookie on every hit; only set it after token exchange.\n" +
        "  - code: `src/auth/callback.ts`\n" +
        "  - code: `src/auth/session.ts:42`\n",
    );
    agent.completeTask("t1", [], "Only set the cookie after token exchange.");
    expect(agent.status().goal && agent.getItem("progressor://g/t1").item).toMatchObject({
      summary: "Only set the cookie after token exchange.",
    });
    expect(() => agent.updateTask("t9", { title: "x" })).toThrow(/No Task t9/);
  });

  it("allows only one Task in progress", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "one" }, { title: "two" }]);
    agent.claimGoal("g");
    agent.startTask("t1");
    expect(() => agent.startTask("t2")).toThrow(/t1 is already in progress/);
  });

  it("refuses Task changes when this Session has not claimed a Goal", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "one" }]);
    expect(() => agent.startTask("t1")).toThrow(/claim a Goal first/);
  });

  it("drops a Task with a reason", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "one" }]);
    agent.claimGoal("g");
    agent.dropTask("t1", "no longer needed");
    expect(read("goals/g.md")).toContain("- [-] one ^t1\n  - reason: no longer needed\n");
  });

  it("picks up hand edits made between calls", () => {
    const agent = session("s-a", 100);
    agent.addGoal("G", [{ title: "one" }]);
    agent.claimGoal("g");
    writeFileSync(join(root, ".progressor/goals/g.md"), read("goals/g.md") + "- [ ] typed by hand\n");

    expect(agent.status().nextTask?.title).toBe("one");
    agent.completeTask("t1");
    expect(agent.status().nextTask).toMatchObject({ id: "t2", title: "typed by hand" });
    expect(read("goals/g.md")).toContain("- [ ] typed by hand ^t2\n");
  });
});

describe("Claims", () => {
  beforeEach(() => {
    session("s-setup", 1).addGoal("Login", [{ title: "one" }]);
    session("s-setup", 1).addGoal("Billing");
  });

  it("refuses a Goal another live Session holds, unless taken over", () => {
    session("s-a", 100).claimGoal("login");
    const other = session("s-b", 200);

    expect(() => other.claimGoal("login")).toThrow(/claimed by Session s-a/);
    other.claimGoal("login", { takeover: true });
    expect(other.status().goal?.claim?.session).toBe("s-b");
  });

  it("lets another Session take a Goal whose Session has gone away", () => {
    session("s-a", 100).claimGoal("login");
    alive.delete(100);

    session("s-b", 200).claimGoal("login");
    expect(read("roadmap.md")).toContain("  - claimed by: s-b (pid 200)");
  });

  it("pauses a Goal on release, and the Session can claim it again", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.releaseGoal();

    expect(agent.roadmap().goal("login")!.status).toBe("paused");
    expect(agent.status().goal).toBeUndefined();
    agent.claimGoal("login");
    expect(agent.roadmap().goal("login")!.status).toBe("active");
  });

  it("releases the previous Goal when a Session claims another", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.claimGoal("billing");

    expect(agent.roadmap().goals.map((g) => [g.id, g.status])).toEqual([
      ["login", "paused"],
      ["billing", "active"],
    ]);
  });

  it("marks a Goal done and releases it", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.completeGoal();

    expect(agent.roadmap().goal("login")!.status).toBe("done");
  });

  it("reopens a done Goal when it is claimed again, keeping its finished Tasks", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.completeTask("t1");
    agent.completeGoal();

    agent.claimGoal("login");
    expect(agent.roadmap().goal("login")!.status).toBe("active");
    const [added] = agent.addTasks([{ title: "two" }]);
    expect(agent.status().nextTask?.id).toBe(added!.id);
    expect(agent.plan("login").task("t1")!.status).toBe("done");
  });

  it("refuses to claim a dropped Goal", () => {
    const roadmap = read("roadmap.md").replace("- [ ] [Billing]", "- [-] [Billing]");
    write("roadmap.md", roadmap);
    expect(() => session("s-a", 100).claimGoal("billing")).toThrow(/dropped/);
  });
});

describe("Detours", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "Add route" }, { title: "Handle callback" }, { title: "Cookies" }]);
    agent.claimGoal("login");
    agent.completeTask("t1");
    agent.startTask("t2");
  });

  it("branches from the current Task with a Reason, and only one can be open", () => {
    const detour = agent.startDetour("Fix flaky refresh", "callback tests fail randomly");

    expect(detour).toMatchObject({ id: "d1", branchedFrom: "t2", status: "open" });
    expect(agent.status().openDetour?.id).toBe("d1");
    expect(read("goals/login.md")).toContain(`- [ ] Cookies ^t3

## Detour: Fix flaky refresh ^d1

- branched from: ^t2
- reason: callback tests fail randomly
- status: open
`);
    expect(() => agent.startDetour("Another", "why")).toThrow(/Detour d1 is still open/);
  });

  it("Merge back ends the Detour and leaves the planned Tasks alone", () => {
    agent.startDetour("Fix typo", "noticed it");
    const before = agent.plan("login").tasks;
    agent.endDetour("merge back");

    expect(agent.plan("login").detour("d1")!.status).toBe("merged back");
    expect(agent.plan("login").tasks).toEqual(before);
    expect(agent.status().openDetour).toBeUndefined();
  });

  it("Return goes back to the Task list and appends the Detour's intended work", () => {
    agent.startDetour("Session store", "callback needs somewhere to keep tokens");
    agent.endDetour("return", [{ title: "Add a session store" }]);

    const plan = agent.plan("login");
    expect(plan.detour("d1")!.status).toBe("returned");
    expect(plan.tasks.map((t) => [t.id, t.status, t.addedBy])).toEqual([
      ["t1", "done", undefined],
      ["t2", "in progress", undefined],
      ["t3", "pending", undefined],
      ["t4", "pending", "d1"],
    ]);
  });

  it("Recalibration drops the remaining Tasks and replaces them with a new list", () => {
    agent.startDetour("Rethink token storage", "cookies will not work with the mobile app");
    agent.endDetour("recalibrate", [{ title: "Store tokens server-side" }, { title: "Add logout" }]);

    expect(read("goals/login.md")).toContain(`- [x] Add route ^t1
- [-] Handle callback ^t2
  - dropped by: ^d1
- [-] Cookies ^t3
  - dropped by: ^d1
- [ ] Store tokens server-side ^t4
  - added by: ^d1
- [ ] Add logout ^t5
  - added by: ^d1
`);
    expect(agent.status().nextTask?.id).toBe("t4");
    expect(() => agent.endDetour("merge back")).toThrow(/No open Detour/);
  });

  it("Recalibration needs the new Task list", () => {
    agent.startDetour("Rethink", "why");
    expect(() => agent.endDetour("recalibrate")).toThrow(/new Task list/);
  });
});

describe("Ideas and Standing Instructions", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "Add route" }]);
  });

  it("parks an Idea and promotes it to a Task in the claimed Goal", () => {
    agent.recordIdea("Remember-me checkbox", "came up while building the form");
    agent.claimGoal("login");
    const task = agent.promoteIdea("i1", "task");

    expect(task.ref).toBe("progressor://login/t2");
    expect(agent.plan("login").task("t2")!.title).toBe("Remember-me checkbox");
    expect(agent.roadmap().idea("i1")!.promotedTo).toBe("progressor://login/t2");
    expect(() => agent.promoteIdea("i1", "goal")).toThrow(/already promoted/);
  });

  it("promotes an Idea to a new Goal", () => {
    agent.recordIdea("Dark mode");
    const goal = agent.promoteIdea("i1", "goal");

    expect(goal.ref).toBe("progressor://dark-mode");
    expect(agent.roadmap().goals.map((g) => [g.id, g.status])).toEqual([
      ["login", "planned"],
      ["dark-mode", "planned"],
    ]);
    expect(read("goals/dark-mode.md")).toBe("# Dark mode\n\n## Tasks\n");
  });

  it("keeps Standing Instructions in the status, with or without a Claim", () => {
    agent.addStandingInstruction("Ask me before recalibrating");
    expect(agent.status().standingInstructions.map((s) => s.text)).toEqual(["Ask me before recalibrating"]);
  });
});

describe("getting an item by ref", () => {
  it("finds Goals, Tasks, Detours, Ideas and Standing Instructions with their file and line", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "Add route", code: ["src/login.ts"] }]);
    agent.claimGoal("login");
    agent.startDetour("Fix typo", "noticed");
    agent.recordIdea("Dark mode");
    agent.addStandingInstruction("Be brief");

    expect(agent.getItem("progressor://login/t1")).toMatchObject({
      kind: "task",
      file: ".progressor/goals/login.md",
      line: 5,
      item: { title: "Add route", code: ["src/login.ts"] },
    });
    expect(agent.getItem("progressor://login/d1")).toMatchObject({ kind: "detour", line: 8 });
    expect(agent.getItem("progressor://login")).toMatchObject({ kind: "goal", file: ".progressor/roadmap.md", line: 5 });
    expect(agent.getItem("progressor://roadmap/i1")).toMatchObject({ kind: "idea", item: { title: "Dark mode" } });
    expect(agent.getItem("progressor://roadmap/s1")).toMatchObject({ kind: "standing instruction" });
    expect(() => agent.getItem("progressor://login/t9")).toThrow(/No item/);
    expect(() => agent.getItem("t1")).toThrow(/progressor:\/\//);
  });
});
