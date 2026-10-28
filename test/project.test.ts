import { readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CONTEXT_LENGTH, Project } from "../src/project.js";
import { tempDir, withoutDates } from "./tmp.js";

let root: string;
const alive = new Set<number>();
const NOW = new Date("2026-10-18T15:00:00.000Z");

function session(id: string, pid: number): Project {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive: (p) => alive.has(p), now: () => NOW });
}

const read = (path: string) => withoutDates(readFileSync(join(root, ".progressor", path), "utf8"));
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
  - timing since: 2026-10-18T15:00:00.000Z
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

  it("keeps the Goals a Session already holds when it claims another", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.claimGoal("billing");

    expect(agent.roadmap().goals.map((g) => [g.id, g.status])).toEqual([
      ["login", "active"],
      ["billing", "active"],
    ]);
    expect(agent.claimedGoals().map((g) => g.id)).toEqual(["login", "billing"]);
  });

  it("marks a Goal done and releases it", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.completeTask("t1");
    agent.completeGoal();

    expect(agent.roadmap().goal("login")!.status).toBe("done");
  });

  it("refuses to mark a Goal done while a Task is not finished, and names it", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    expect(() => agent.completeGoal()).toThrow(/t1 one/);
    agent.startTask("t1");
    expect(() => agent.completeGoal()).toThrow(/t1 one/);
    expect(agent.roadmap().goal("login")!.status).toBe("active");
  });

  it("refuses to mark a Goal done while a Detour is open", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("login");
    agent.startTask("t1");
    agent.startDetour("Fix the build", "It is red");
    agent.completeTask("t1");
    expect(() => agent.completeGoal()).toThrow(/Fix the build/);
  });

  it("marks a Goal done when every Task is done or dropped", () => {
    const agent = session("s-a", 100);
    agent.claimGoal("billing");
    agent.addTasks([{ title: "a" }, { title: "b" }]);
    agent.completeTask("t1");
    agent.dropTask("t2", "Not needed");
    agent.completeGoal();
    expect(agent.roadmap().goal("billing")!.status).toBe("done");
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

describe("Claims left by Sessions that have ended", () => {
  beforeEach(() => {
    session("s-setup", 1).addGoal("Login", [{ title: "one" }]);
    session("s-setup", 1).addGoal("Billing");
  });

  it("clears a Claim whose process has died when another Session gets its status, leaving the Goal paused", () => {
    session("s-a", 100).claimGoal("login");
    alive.delete(100);

    session("s-b", 200).sessionStatus();
    expect(read("roadmap.md")).not.toContain("claimed by: s-a");
    expect(session("s-b", 200).roadmap().goal("login")!.status).toBe("paused");
  });

  it("leaves Claims of Sessions that are still running alone, and every other Goal too", () => {
    session("s-a", 100).claimGoal("login");
    session("s-c", 300).claimGoal("billing");
    alive.delete(300);

    session("s-b", 200).sessionStatus();
    expect(read("roadmap.md")).toContain("claimed by: s-a (pid 100)");
    expect(read("roadmap.md")).not.toContain("claimed by: s-c");
  });

  it("clears every dead Claim when a Session claims a Goal, not only the one it takes", () => {
    const a = session("s-a", 100);
    a.claimGoal("login");
    a.claimGoal("billing");
    alive.delete(100);

    session("s-b", 200).claimGoal("login");
    expect(read("roadmap.md")).toContain("claimed by: s-b (pid 200)");
    expect(read("roadmap.md")).not.toContain("claimed by: s-a");
    expect(session("s-b", 200).roadmap().goal("billing")!.status).toBe("paused");
  });

  it("clears dead Claims in the overview, which then shows their Goals as paused", () => {
    session("s-a", 100).claimGoal("login");
    alive.delete(100);

    const overview = session("hook", 500).overview();
    expect(overview.active).toEqual([]);
    expect(overview.paused.map((s) => s.goal?.id)).toEqual(["login"]);
    expect(read("roadmap.md")).not.toContain("claimed by:");
  });

  it("does not rewrite the Roadmap when no Claim is stale", () => {
    session("s-a", 100).claimGoal("login");
    const before = read("roadmap.md");
    write("roadmap.md", `${before}\n`);
    session("s-b", 200).sessionStatus();
    expect(read("roadmap.md")).toBe(`${before}\n`);
  });

  it("treats a Claim with this process's pid but another Session's ID as stale: the pid was reused", () => {
    session("s-old", 200).claimGoal("login");
    // the Session that held it ended without releasing, and its pid now belongs to this Session
    session("s-b", 200).sessionStatus();
    expect(read("roadmap.md")).not.toContain("claimed by: s-old");
  });

  it("treats a Claim as stale when its pid now belongs to another Progressor Session", () => {
    session("s-old", 300).claimGoal("login");
    const b = new Project({
      root,
      session: { id: "s-b", pid: 200 },
      isAlive: () => true,
      sessionOf: (pid) => (pid === 300 ? "s-new" : undefined),
      now: () => NOW,
    });
    b.sessionStatus();
    expect(read("roadmap.md")).not.toContain("claimed by: s-old");
  });

  it("keeps a Claim whose pid is running the same Session, or a process Progressor knows nothing about", () => {
    session("s-a", 300).claimGoal("login");
    session("s-c", 400).claimGoal("billing");
    const b = new Project({
      root,
      session: { id: "s-b", pid: 200 },
      isAlive: () => true,
      sessionOf: (pid) => (pid === 300 ? "s-a" : undefined),
      now: () => NOW,
    });
    b.sessionStatus();
    expect(read("roadmap.md")).toContain("claimed by: s-a (pid 300)");
    expect(read("roadmap.md")).toContain("claimed by: s-c (pid 400)");
  });

  it("keeps a Claim with no pid, since nothing says its Session has ended", () => {
    session("s-a", 100).claimGoal("login");
    write("roadmap.md", read("roadmap.md").replace("s-a (pid 100)", "s-a"));
    alive.clear();
    session("s-b", 200).sessionStatus();
    expect(read("roadmap.md")).toContain("claimed by: s-a since");
  });

  it("still answers when the Roadmap cannot be written", () => {
    session("s-a", 100).claimGoal("login");
    alive.delete(100);
    const b = new Project({ root, session: { id: "s-b", pid: 200 }, isAlive: (p) => alive.has(p), now: () => NOW });
    const save = (b as any).saveRoadmap;
    (b as any).saveRoadmap = () => {
      throw new Error("read-only");
    };
    expect(b.overview().paused.map((s) => s.goal?.id)).toEqual(["login"]);
    (b as any).saveRoadmap = save;
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

describe("Important context", () => {
  it("is empty until the Agent writes it, then kept in .progressor/context.md", () => {
    const agent = session("s-a", 100);
    expect(agent.context()).toBe("");
    agent.setContext("Progressor is an MCP server.\n\nReleases go out by pushing a tag.");
    expect(read("context.md")).toBe("# Important context\n\nProgressor is an MCP server.\n\nReleases go out by pushing a tag.\n");
    expect(session("s-b", 200).context()).toBe("Progressor is an MCP server.\n\nReleases go out by pushing a tag.");
  });

  it("is part of the status and the overview", () => {
    const agent = session("s-a", 100);
    agent.setContext("Dashboard on port 4747.");
    expect(agent.status().context).toBe("Dashboard on port 4747.");
    expect(agent.overview().context).toBe("Dashboard on port 4747.");
  });

  it("can be emptied, and refuses text over the size limit", () => {
    const agent = session("s-a", 100);
    agent.setContext("Something");
    agent.setContext("  ");
    expect(agent.context()).toBe("");
    expect(() => agent.setContext("x".repeat(MAX_CONTEXT_LENGTH + 1))).toThrow(/too long.*4000/);
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
    expect(agent.getItem("progressor://login/d1")).toMatchObject({ kind: "detour", line: 9 });
    expect(agent.getItem("progressor://login")).toMatchObject({ kind: "goal", file: ".progressor/roadmap.md", line: 5 });
    expect(agent.getItem("progressor://roadmap/i1")).toMatchObject({ kind: "idea", item: { title: "Dark mode" } });
    expect(agent.getItem("progressor://roadmap/s1")).toMatchObject({ kind: "standing instruction" });
    expect(() => agent.getItem("progressor://login/t9")).toThrow(/No item/);
    expect(() => agent.getItem("t1")).toThrow(/progressor:\/\//);
  });
});

describe("shaping Goals", () => {
  const goalIds = (p: Project) => p.roadmap().goals.map((g) => g.id);

  it("takes a short ID and an Outcome when a Goal is added", () => {
    const agent = session("s-a", 100);
    const goal = agent.addGoal("Share the screens with Compose Multiplatform", [], {
      id: "web-ui",
      outcome: "The web build shows every screen the Android app has",
    });

    expect(goal.ref).toBe("progressor://web-ui");
    expect(goal.outcome).toBe("The web build shows every screen the Android app has");
    expect(read("roadmap.md")).toContain(
      "- [ ] [Share the screens with Compose Multiplatform](goals/web-ui.md) ^web-ui\n  - outcome: The web build shows every screen the Android app has\n",
    );
    expect(() => agent.addGoal("Other", [], { id: "web-ui" })).toThrow(/already used/);
    expect(() => agent.addGoal("Other", [], { id: "Web UI!" })).toThrow(/lowercase letters, digits and dashes/);
    expect(() => agent.addGoal("Other", [], { id: "roadmap" })).toThrow(/reserved/);
  });

  it("refuses a second Goal with the same title unless asked for one", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Try it");

    expect(() => agent.addGoal("  try IT ")).toThrow(/already a Goal "Try it" \(try-it, planned\).*allow_duplicate/);
    expect(agent.addGoal("Try it", [], { allowDuplicate: true }).id).toBe("try-it-2");
  });

  it("lets a dropped Goal's title be used again", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Try it");
    agent.dropGoal("try-it", "Wrong approach");

    expect(agent.addGoal("Try it").id).toBe("try-it-2");
  });

  it("renames a Goal and changes or clears its Outcome, keeping its ID", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Web", [{ title: "One" }], { outcome: "Old" });

    agent.updateGoal("web", { title: "Web UI", outcome: "Every screen works in the browser" });
    expect(agent.roadmap().goal("web")).toMatchObject({ title: "Web UI", outcome: "Every screen works in the browser" });
    expect(read("goals/web.md").split("\n")[0]).toBe("# Web UI");

    agent.updateGoal("web", { outcome: "" });
    expect(agent.roadmap().goal("web")!.outcome).toBeUndefined();
    expect(() => agent.updateGoal("nope", { title: "x" })).toThrow(/No Goal nope/);
  });

  it("moves a Goal before or after another, with its details", () => {
    const agent = session("s-a", 100);
    for (const t of ["Phase one", "Phase two", "Phase three"]) agent.addGoal(t);
    agent.updateGoal("phase-three", { outcome: "Ships" });

    agent.moveGoal("phase-three", { before: "phase-one" });
    expect(goalIds(agent)).toEqual(["phase-three", "phase-one", "phase-two"]);
    expect(agent.roadmap().goal("phase-three")!.outcome).toBe("Ships");

    agent.moveGoal("phase-three", { after: "phase-two" });
    expect(goalIds(agent)).toEqual(["phase-one", "phase-two", "phase-three"]);
    expect(() => agent.moveGoal("phase-one", {})).toThrow(/before or after/);
    expect(() => agent.moveGoal("phase-one", { before: "phase-one" })).toThrow(/itself/);
  });

  it("drops a Goal with a reason and releases this Session's Claim on it", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Spike");
    agent.claimGoal("spike");

    agent.dropGoal("spike", "The library cannot do it");
    const goal = agent.roadmap().goal("spike")!;
    expect(goal).toMatchObject({ status: "dropped", reason: "The library cannot do it", claim: undefined });
    expect(agent.status().goal).toBeUndefined();
    expect(() => agent.claimGoal("spike")).toThrow(/dropped/);
  });

  it("does not drop a Goal another running Session holds, or one that is done", () => {
    session("s-a", 100).addGoal("Login", [{ title: "One" }]);
    session("s-a", 100).claimGoal("login");
    expect(() => session("s-b", 200).dropGoal("login", "x")).toThrow(/claimed by Session s-a/);

    const agent = session("s-a", 100);
    agent.completeTask("t1");
    agent.completeGoal();
    expect(() => agent.dropGoal("login", "x")).toThrow(/done/);
  });
});

describe("recording finished work", () => {
  it("adds a finished Goal and its finished Tasks in one call", () => {
    const agent = session("s-a", 100);
    const goal = agent.addGoal("Spike", [{ title: "Try A", done: true }, { title: "Try B", done: true, summary: "B works" }], {
      done: true,
    });

    expect(goal.status).toBe("done");
    expect(read("goals/spike.md")).toContain("- [x] Try A ^t1\n- [x] Try B ^t2\n  - summary: B works\n");
    expect(agent.status().goal).toBeUndefined();
  });

  it("refuses to mark a Goal done while a Task is not, and writes nothing", () => {
    const agent = session("s-a", 100);
    expect(() => agent.addGoal("Spike", [{ title: "Try A", done: true }, { title: "Try B" }], { done: true })).toThrow(
      /Try B.*not done/,
    );
    expect(agent.roadmap().goals).toEqual([]);
  });

  it("adds finished Tasks to the claimed Goal", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "One" }]);
    agent.claimGoal("login");
    agent.addTasks([{ title: "Already fixed", done: true }]);

    expect(agent.plan("login").task("t2")!.status).toBe("done");
    expect(agent.status().nextTask?.id).toBe("t1");
  });
});

describe("the project folder", () => {
  it("refuses to start a progress record in a folder that is the wrong place, and says why", () => {
    const agent = new Project({ root, session: { id: "s-a", pid: 100 }, unsafe: () => "it is your home folder" });
    expect(() => agent.addGoal("Login")).toThrow(/home folder.*PROGRESSOR_ROOT/s);
    expect(agent.roadmap().goals).toEqual([]);
  });

  it("keeps using a progress record that is already there", () => {
    session("s-a", 100).addGoal("Login");
    const agent = new Project({ root, session: { id: "s-a", pid: 100 }, unsafe: () => "it is your home folder" });
    agent.addGoal("Billing");
    expect(agent.roadmap().goals.map((g) => g.id)).toEqual(["login", "billing"]);
  });

  it("moves to the folder the app reports", () => {
    const other = tempDir("progressor-other-");
    const agent = session("s-a", 100);
    agent.moveTo(other);
    agent.addGoal("Login");
    expect(agent.root).toBe(other);
    expect(readFileSync(join(other, ".progressor", "roadmap.md"), "utf8")).toContain("Login");
  });
});

describe("a Session holding several Goals", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "Route" }]);
    agent.addGoal("Voice", [{ title: "Record" }]);
    agent.addGoal("Billing", [{ title: "Checkout" }]);
    agent.claimGoal("login");
  });

  it("works on its one Goal without being told which", () => {
    agent.startTask("t1");
    expect(agent.plan("login").task("t1")!.status).toBe("in progress");
  });

  it("asks which Goal once it holds several, and works on the one named", () => {
    agent.claimGoal("voice");
    expect(() => agent.startTask("t1")).toThrow(/holds several Goals \(login, voice\).*goal/);
    expect(() => agent.addTasks([{ title: "x" }])).toThrow(/several Goals/);
    agent.startTask("t1", "voice");
    agent.startTask("t1", "login");
    agent.addTasks([{ title: "Stop" }], "voice");
    agent.startDetour("Fix mic", "It stays on", "voice");
    expect(agent.plan("voice").openDetour?.branchedFrom).toBe("t1");
    expect(agent.plan("login").openDetour).toBeUndefined();
    agent.endDetour("merge back", [], "voice");
    agent.completeTask("t1", [], undefined, "login");
    agent.completeGoal("login");
    expect(agent.claimedGoals().map((g) => g.id)).toEqual(["voice"]);
    agent.updateTask("t2", { title: "Stop recording" });
    expect(agent.plan("voice").task("t2")!.title).toBe("Stop recording");
  });

  it("refuses a Goal it has not claimed", () => {
    expect(() => agent.startTask("t1", "billing")).toThrow(/Goal billing is not claimed by this Session.*claim_goal/);
    expect(() => agent.startTask("t1", "nope")).toThrow(/No Goal nope/);
  });

  it("releases one Goal by name, and every Goal when the Session ends", () => {
    agent.claimGoal("voice");
    expect(() => agent.releaseGoal()).toThrow(/several Goals/);
    expect(agent.releaseGoal("voice")!.status).toBe("paused");
    agent.claimGoal("voice");
    agent.releaseAll();
    expect(agent.claimedGoals()).toEqual([]);
    expect(agent.roadmap().goals.map((g) => g.status)).toEqual(["paused", "paused", "planned"]);
  });

  it("gives the status of every Goal it holds, in Roadmap order", () => {
    agent.claimGoal("billing");
    agent.claimGoal("voice");
    const s = agent.sessionStatus();
    expect(s.held.map((h) => h.goal?.id)).toEqual(["login", "voice", "billing"]);
    expect(s.held[0]!.nextTask?.id).toBe("t1");
    expect(s.goals).toHaveLength(3);
  });
});

describe("Task states for helpers and the Developer", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Voice", [{ title: "Record" }, { title: "Transcribe" }, { title: "Try on phone" }, { title: "Ship" }]);
    agent.claimGoal("voice");
  });

  it("lets several Tasks be with a helper while the Agent works on one of its own", () => {
    agent.setTaskState("t1", "with a helper");
    agent.setTaskState("t2", "with a helper");
    agent.startTask("t3");
    expect(() => agent.startTask("t4")).toThrow(/t3 is already in progress/);
    const s = agent.status();
    expect(s.currentTask?.id).toBe("t3");
    expect(s.withHelper.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(s.nextTask?.id).toBe("t4");
  });

  it("puts in progress through start_task's rule, and refuses to change a dropped Task", () => {
    agent.startTask("t1");
    expect(() => agent.setTaskState("t2", "in progress")).toThrow(/t1 is already in progress/);
    agent.dropTask("t4", "Not needed");
    expect(() => agent.setTaskState("t4", "released")).toThrow(/dropped/);
  });

  it("says the Goal is waiting on the Developer while any Task is", () => {
    expect(agent.status().waitingOnYou).toEqual([]);
    agent.setTaskState("t3", "waiting on you");
    expect(agent.status().waitingOnYou.map((t) => t.id)).toEqual(["t3"]);
    expect(agent.overview().active[0]!.waitingOnYou.map((t) => t.id)).toEqual(["t3"]);
  });

  it("counts released as done, and only lets the Goal finish once nothing is with a helper, waiting or merely checked", () => {
    agent.setTaskState("t1", "released");
    agent.setTaskState("t2", "checked");
    agent.setTaskState("t3", "waiting on you");
    agent.setTaskState("t4", "with a helper");
    expect(agent.status()).toMatchObject({ done: 1, total: 4 });
    expect(agent.status().checked.map((t) => t.id)).toEqual(["t2"]);
    expect(() => agent.completeGoal()).toThrow(/t2 Transcribe \(checked\), t3 Try on phone \(waiting on you\), t4 Ship \(with a helper\)/);
    agent.setTaskState("t2", "released");
    agent.completeTask("t3");
    agent.dropTask("t4", "Later");
    agent.completeGoal();
    expect(agent.roadmap().goal("voice")!.status).toBe("done");
  });

  it("keeps a released Task released when it is completed again", () => {
    agent.setTaskState("t1", "released");
    agent.completeTask("t1", ["src/record.ts"]);
    expect(agent.plan("voice").task("t1")).toMatchObject({ status: "released", code: ["src/record.ts"] });
  });
});

describe("decisions and notes", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Cleanup", [{ title: "Tidy" }]);
    agent.addGoal("Voice", [{ title: "Record" }]);
    agent.addGoal("Old", []);
    agent.dropGoal("old", "Not wanted");
  });

  it("records a decision in a claimed Goal, and changes or removes it", () => {
    expect(() => agent.addDecision("x")).toThrow(/claim a Goal first/);
    agent.claimGoal("cleanup");
    expect(agent.addDecision("Old models get thinking on/off only")).toMatchObject({ id: "c1", ref: "progressor://cleanup/c1" });
    agent.addDecision("Keep the old settings file");
    expect(agent.updateDecision("c1", "Old models: thinking on/off only")!.text).toBe("Old models: thinking on/off only");
    expect(agent.updateDecision("c2", "")).toBeUndefined();
    expect(agent.status().decisions.map((d) => d.text)).toEqual(["Old models: thinking on/off only"]);
    expect(read("goals/cleanup.md")).toContain("## Decisions\n\n- Old models: thinking on/off only ^c1\n");
  });

  it("adds a note to any Goal that is not dropped, saying which Goal it was spotted from", () => {
    agent.claimGoal("cleanup");
    const note = agent.addNote("voice", "The mic stays on after cancelling");
    expect(note).toMatchObject({ id: "n1", ref: "progressor://voice/n1", resolved: false, from: "progressor://cleanup" });
    expect(agent.addNote("cleanup", "Two copies of the logger").from).toBeUndefined();
    expect(() => agent.addNote("old", "x")).toThrow(/dropped/);
    expect(() => agent.addNote("nope", "x")).toThrow(/No Goal nope/);
  });

  it("resolves, rewords and removes notes, and the status shows only the open ones", () => {
    agent.claimGoal("voice");
    agent.addNote("voice", "The mic stays on");
    agent.addNote("voice", "Echo on Android");
    agent.addNote("voice", "Typo");
    agent.updateNote("voice", "n1", { resolved: true });
    agent.updateNote("voice", "n2", { text: "Echo on Android 14" });
    expect(agent.updateNote("voice", "n3", { text: "" })).toBeUndefined();
    expect(agent.status().notes.map((n) => [n.id, n.text])).toEqual([["n2", "Echo on Android 14"]]);
    expect(agent.plan("voice").notes.map((n) => [n.id, n.resolved])).toEqual([
      ["n1", true],
      ["n2", false],
    ]);
  });

  it("finds decisions and notes by ref", () => {
    agent.claimGoal("cleanup");
    agent.addDecision("Keep it simple");
    agent.addNote("voice", "Mic stays on");
    expect(agent.getItem("progressor://cleanup/c1")).toMatchObject({ kind: "decision", file: ".progressor/goals/cleanup.md", item: { text: "Keep it simple" } });
    expect(agent.getItem("progressor://voice/n1")).toMatchObject({ kind: "note", item: { text: "Mic stays on", resolved: false } });
  });
});

describe("updating several Tasks in one call", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Voice", [{ title: "Record" }, { title: "Transcribe" }, { title: "Try on phone" }, { title: "Ship" }]);
    agent.claimGoal("voice");
    agent.startTask("t1");
  });

  it("completes Tasks and starts the next one, in order", () => {
    const done = agent.updateTasks([
      { action: "complete", task: "t1", code: ["src/record.ts"], summary: "Records from the mic." },
      { action: "start", task: "t2" },
    ]);
    expect(done.map((d) => [d.goal, d.task.id, d.task.status])).toEqual([
      ["voice", "t1", "done"],
      ["voice", "t2", "in progress"],
    ]);
    const plan = agent.plan("voice");
    expect(plan.task("t1")).toMatchObject({ status: "done", code: ["src/record.ts"], summary: "Records from the mic." });
    expect(plan.currentTask?.id).toBe("t2");
  });

  it("sets states and drops Tasks too, and the one-in-progress rule sees earlier changes", () => {
    expect(() => agent.updateTasks([{ action: "start", task: "t2" }])).toThrow(/t1 is already in progress/);
    agent.updateTasks([
      { action: "state", task: "t1", state: "with a helper" },
      { action: "start", task: "t2" },
      { action: "state", task: "t3", state: "waiting on you" },
      { action: "drop", task: "t4", reason: "Not needed" },
    ]);
    const plan = agent.plan("voice");
    expect(plan.tasks.map((t) => t.status)).toEqual(["with a helper", "in progress", "waiting on you", "dropped"]);
    expect(plan.task("t4")!.reason).toBe("Not needed");
  });

  it("changes nothing when one operation fails, and names it", () => {
    const before = read("goals/voice.md");
    expect(() =>
      agent.updateTasks([
        { action: "complete", task: "t1" },
        { action: "start", task: "t2" },
        { action: "complete", task: "t9" },
      ]),
    ).toThrow(/Operation 3 \(complete t9\): No Task t9.*Nothing was changed/);
    expect(read("goals/voice.md")).toBe(before);
  });

  it("asks for what each action needs", () => {
    expect(() => agent.updateTasks([{ action: "state", task: "t1" }])).toThrow(/Operation 1.*state/);
    expect(() => agent.updateTasks([{ action: "drop", task: "t1" }])).toThrow(/Operation 1.*reason/);
    expect(() => agent.updateTasks([])).toThrow(/at least one/);
  });

  it("works across the Goals the Session holds, all or nothing", () => {
    agent.addGoal("Login", [{ title: "Route" }, { title: "Callback" }]);
    agent.claimGoal("login");
    expect(() => agent.updateTasks([{ action: "complete", task: "t1" }])).toThrow(/several Goals/);
    agent.updateTasks([
      { action: "complete", task: "t1" },
      { action: "start", task: "t1", goal: "login" },
    ], "voice");
    expect(agent.plan("voice").task("t1")!.status).toBe("done");
    expect(agent.plan("login").task("t1")!.status).toBe("in progress");

    const login = read("goals/login.md");
    expect(() =>
      agent.updateTasks([
        { action: "complete", task: "t1", goal: "login" },
        { action: "complete", task: "t2", goal: "voice" },
        { action: "start", task: "t1", goal: "billing" },
      ]),
    ).toThrow(/Operation 3/);
    expect(read("goals/login.md")).toBe(login);
    expect(agent.plan("voice").task("t2")!.status).toBe("pending");
  });
});

describe("moving a Task to another Goal", () => {
  let agent: Project;
  beforeEach(() => {
    agent = session("s-a", 100);
    agent.addGoal("Login", [
      { title: "Route", summary: "Serve the page.", code: ["src/login.ts"] },
      { title: "Callback" },
      { title: "Mic check" },
    ]);
    agent.addGoal("Voice", [{ title: "Record" }, { title: "Stop" }]);
    agent.claimGoal("login");
  });

  it("gives the Task a new ID at the end of the other Goal, and leaves a dropped trace pointing there", () => {
    agent.setTaskState("t3", "with a helper");
    const moved = agent.moveTask("t3", "voice");
    expect(moved.ref).toBe("progressor://voice/t3");
    expect(agent.plan("voice").tasks.map((t) => [t.id, t.title, t.status])).toEqual([
      ["t1", "Record", "pending"],
      ["t2", "Stop", "pending"],
      ["t3", "Mic check", "with a helper"],
    ]);
    expect(agent.plan("voice").task("t3")!.movedFrom).toBe("progressor://login/t3");
    expect(agent.plan("login").task("t3")).toMatchObject({ status: "dropped", reason: 'Moved to the goal "Voice" (progressor://voice/t3)' });
    expect(agent.status().total).toBe(2);
  });

  it("keeps the title, summary and files, and the status of a finished Task", () => {
    agent.completeTask("t1", ["src/other.ts"], "Serves the login page.");
    const moved = agent.moveTask("t1", "voice");
    expect(moved).toMatchObject({ id: "t3", title: "Route", status: "done", summary: "Serves the login page.", code: ["src/login.ts", "src/other.ts"] });
    expect(read("goals/voice.md")).toContain("- [x] Route ^t3\n  - summary: Serves the login page.\n  - code: `src/login.ts`\n  - code: `src/other.ts`\n  - moved from: progressor://login/t1\n");
  });

  it("puts the Task before or after a Task of the other Goal", () => {
    agent.moveTask("t2", "voice", { before: "t1" });
    agent.moveTask("t3", "voice", { after: "t1" });
    expect(agent.plan("voice").tasks.map((t) => t.title)).toEqual(["Callback", "Record", "Mic check", "Stop"]);
    expect(() => agent.moveTask("t1", "voice", { before: "t9" })).toThrow(/No Task t9 in Goal voice/);
    expect(() => agent.moveTask("t1", "voice", { before: "t1", after: "t2" })).toThrow(/before or after, not both/);
  });

  it("moves the Task in progress when the other Goal has none of its own, keeping the Agent's place", () => {
    agent.startTask("t2");
    expect(agent.moveTask("t2", "voice").status).toBe("in progress");
    expect(agent.plan("login").currentTask).toBeUndefined();
  });

  it("refuses a second Task in progress in the other Goal, and writes nothing", () => {
    agent.claimGoal("voice");
    agent.startTask("t1", "voice");
    agent.startTask("t2", "login");
    const login = read("goals/login.md");
    expect(() => agent.moveTask("t2", "voice", {}, "login")).toThrow(/t1 is already in progress in Goal voice/);
    expect(read("goals/login.md")).toBe(login);
  });

  it("refuses a dropped Task, the same Goal, an unknown Goal, and a Goal that is dropped, done or running elsewhere", () => {
    agent.dropTask("t2", "No");
    expect(() => agent.moveTask("t2", "voice")).toThrow(/dropped/);
    expect(() => agent.moveTask("t1", "login")).toThrow(/already in Goal login/);
    expect(() => agent.moveTask("t1", "nope")).toThrow(/No Goal nope/);
    agent.addGoal("Old", []);
    agent.dropGoal("old", "No");
    expect(() => agent.moveTask("t1", "old")).toThrow(/dropped/);
    agent.addGoal("Finished", [{ title: "x", done: true }], { done: true });
    expect(() => agent.moveTask("t1", "finished")).toThrow(/done.*claim_goal/);
    const other = session("s-b", 200);
    other.claimGoal("voice");
    expect(() => agent.moveTask("t1", "voice")).toThrow(/claimed by Session s-b/);
  });

  it("needs a Goal named when the Session holds several, and a claimed source Goal", () => {
    agent.claimGoal("voice");
    expect(() => agent.moveTask("t1", "voice")).toThrow(/several Goals/);
    agent.moveTask("t1", "voice", {}, "login");
    agent.addGoal("Billing", [{ title: "Pay" }]);
    expect(() => agent.moveTask("t1", "login", {}, "billing")).toThrow(/not claimed by this Session/);
  });

  it("leaves a Detour that branched from the Task as it was, pointing at the trace", () => {
    agent.startTask("t2");
    agent.startDetour("Fix cookie", "Blocks the callback");
    agent.moveTask("t2", "voice");
    expect(agent.plan("login").openDetour).toMatchObject({ id: "d1", branchedFrom: "t2" });
    expect(agent.getItem("progressor://login/t2")).toMatchObject({ kind: "task", item: { status: "dropped" } });
  });
});

describe("hard rules", () => {
  it("are saved with a flag, changed without rewording, and kept in the status and overview", () => {
    const agent = session("s-a", 100);
    agent.addStandingInstruction("Prefer small commits");
    const hard = agent.addStandingInstruction("Never commit secrets", true);
    expect(hard).toMatchObject({ id: "s2", hard: true });
    expect(agent.status().standingInstructions.map((s) => s.hard)).toEqual([false, true]);
    expect(agent.updateStandingInstruction("s1", { hard: true })).toMatchObject({ text: "Prefer small commits", hard: true });
    expect(agent.updateStandingInstruction("s2", { text: "Never commit API keys" })).toMatchObject({ hard: true });
    expect(agent.updateStandingInstruction("s2", { hard: false })).toMatchObject({ text: "Never commit API keys", hard: false });
    expect(agent.updateStandingInstruction("s1", { text: "" })).toBeUndefined();
    expect(agent.roadmap().standingInstructions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("need a change to be made", () => {
    const agent = session("s-a", 100);
    agent.addStandingInstruction("Be brief");
    expect(() => agent.updateStandingInstruction("s1", {})).toThrow(/text or hard/);
  });
});

describe("when the plan last changed", () => {
  it("is the Plan File's time, else the Roadmap's, in the status", () => {
    const agent = session("s-a", 100);
    agent.addGoal("Login", [{ title: "Route" }]);
    agent.claimGoal("login");
    utimesSync(join(root, ".progressor", "goals", "login.md"), new Date("2026-10-18T14:00:00Z"), new Date("2026-10-18T14:00:00Z"));
    expect(agent.status().updatedAt).toBe(new Date("2026-10-18T14:00:00Z").getTime());
    rmSync(join(root, ".progressor", "goals", "login.md"));
    expect(agent.status().updatedAt).toBeGreaterThan(new Date("2026-10-18T14:00:00Z").getTime());
  });
});
