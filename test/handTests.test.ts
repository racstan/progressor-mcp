import { readFileSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

const NOW = new Date("2026-10-28T10:00:00.000Z");
let root: string;
let agent: Project;

beforeEach(() => {
  root = tempDir("progressor-hand-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => NOW });
  const goal = agent.addGoal("Attachments", [{ title: "Read attached files" }, { title: "Show the reply" }]);
  agent.claimGoal(goal.id);
});

const planText = () => readFileSync(join(root, ".progressor/goals/attachments.md"), "utf8");
const plan = () => parsePlanFile(planText(), "attachments");

describe("hand tests in the plan file", () => {
  it("stores an item as a checklist line in its own section, after the Tasks", () => {
    agent.addHandTest("OpenCode may ask to read the file: allow it and check the reply", undefined, "t1");
    agent.addHandTest("Dictation works");
    expect(planText()).toBe(
      [
        "# Attachments",
        "",
        "## Tasks",
        "",
        "- [ ] Read attached files ^t1",
        "- [ ] Show the reply ^t2",
        "",
        "## Hand tests",
        "",
        "- [ ] OpenCode may ask to read the file: allow it and check the reply ^h1",
        "  - task: ^t1",
        "- [ ] Dictation works ^h2",
        "",
      ].join("\n"),
    );
  });

  it("refuses a Task that is not in the Goal", () => {
    expect(() => agent.addHandTest("x", undefined, "t9")).toThrow(/No Task t9/);
  });

  it("reads a hand-typed section and keeps it as it was", () => {
    const source = "# G\n\n## Tasks\n\n- [ ] A ^t1\n\n## Hand tests\n\n* [X] Typed by hand\n- [-] Skip this ^h4\n- [ ] Open one\n";
    const p = parsePlanFile(source, "g");
    expect(p.handTests.map((h) => [h.id, h.result, h.text])).toEqual([
      [undefined, "works", "Typed by hand"],
      ["h4", "won't test", "Skip this"],
      [undefined, "pending", "Open one"],
    ]);
    expect(p.toString()).toBe(source);
    p.assignMissingIds();
    expect(p.handTests.map((h) => h.id)).toEqual(["h5", "h4", "h6"]);
  });

  it("lets the Agent reword, relink and remove its own items, and keeps the Developer's mark", () => {
    agent.addHandTest("Try it", undefined, "t1");
    agent.markHandTest("attachments", "h1", "works");
    agent.updateHandTest("h1", { text: "Try it twice", task: "t2" });
    expect(plan().handTest("h1")).toMatchObject({ text: "Try it twice", task: "t2", result: "works" });
    agent.updateHandTest("h1", { task: "" });
    expect(plan().handTest("h1")!.task).toBeUndefined();
    expect(agent.updateHandTest("h1", { text: " " })).toBeUndefined();
    expect(plan().handTests).toEqual([]);
  });
});

describe("marking", () => {
  beforeEach(() => {
    agent.addHandTest("Allow the permission prompt and check the reply", undefined, "t1");
  });

  it("records works, won't test and an undo, with the time", () => {
    const works = agent.markHandTest("attachments", "h1", "works");
    expect(works).toMatchObject({ result: "works", markedAt: NOW.toISOString(), seen: false });
    expect(planText()).toContain("- [x] Allow the permission prompt and check the reply ^h1");
    expect(agent.markHandTest("attachments", "h1", "won't test").result).toBe("won't test");
    expect(planText()).toContain("- [-] Allow");
    const cleared = agent.markHandTest("attachments", "h1", "pending");
    expect(cleared).toMatchObject({ result: "pending", markedAt: undefined });
    expect(planText()).toContain("- [ ] Allow");
    expect(planText()).not.toContain("marked:");
  });

  it("adds a pending Task for a failure, titled from the item and carrying the note, linked both ways", () => {
    const failed = agent.markHandTest("attachments", "h1", "doesn't work", "  It asked twice\nand then froze ");
    expect(failed).toMatchObject({ result: "doesn't work", note: "It asked twice and then froze", taskAdded: "t3" });
    const task = plan().task("t3")!;
    expect(task).toMatchObject({ status: "pending", title: "Fix: Allow the permission prompt and check the reply", fromHandTest: "h1" });
    expect(task.summary).toContain("It asked twice and then froze");
    expect(planText()).toContain("  - from hand test: ^h1");
    expect(planText()).toContain("  - task added: ^t3");
  });

  it("does not add a second Task for the same failure, but updates the note", () => {
    agent.markHandTest("attachments", "h1", "doesn't work", "first");
    agent.markHandTest("attachments", "h1", "doesn't work", "second");
    expect(plan().tasks.filter((t) => t.fromHandTest === "h1")).toHaveLength(1);
    expect(plan().task("t3")!.summary).toContain("second");
  });

  it("drops the added Task when the mark is undone or changed, if nobody has started it", () => {
    agent.markHandTest("attachments", "h1", "doesn't work", "broken");
    agent.markHandTest("attachments", "h1", "works");
    expect(plan().task("t3")).toMatchObject({ status: "dropped" });
    expect(plan().handTest("h1")!.taskAdded).toBeUndefined();
    agent.markHandTest("attachments", "h1", "doesn't work", "broken again");
    expect(plan().tasks.filter((t) => t.fromHandTest === "h1").map((t) => [t.id, t.status])).toEqual([["t3", "dropped"], ["t4", "pending"]]);
  });

  it("leaves a Task the Agent has started alone when the mark is undone", () => {
    agent.markHandTest("attachments", "h1", "doesn't work", "broken");
    agent.startTask("t3");
    agent.markHandTest("attachments", "h1", "pending");
    expect(plan().task("t3")!.status).toBe("in progress");
  });

  it("works on a Goal nobody has claimed, and reopens a finished one when a test fails", () => {
    agent.completeTask("t1");
    agent.completeTask("t2");
    agent.markHandTest("attachments", "h1", "works");
    agent.completeGoal();
    expect(agent.roadmap().goal("attachments")!.status).toBe("done");
    agent.markHandTest("attachments", "h1", "doesn't work", "no");
    expect(agent.roadmap().goal("attachments")!.status).toBe("paused");
  });

  it("refuses unknown Goals, unknown items and dropped Goals", () => {
    expect(() => agent.markHandTest("nope", "h1", "works")).toThrow(/No Goal nope/);
    expect(() => agent.markHandTest("attachments", "h9", "works")).toThrow(/No hand test h9/);
    agent.dropGoal("attachments", "not needed");
    expect(() => agent.markHandTest("attachments", "h1", "works")).toThrow(/dropped/);
  });

  it("keeps a long note to 500 characters", () => {
    expect(agent.markHandTest("attachments", "h1", "doesn't work", "x".repeat(900)).note).toHaveLength(500);
  });
});

describe("completing a Goal", () => {
  beforeEach(() => {
    agent.completeTask("t1");
    agent.completeTask("t2");
    agent.addHandTest("Look at the reply");
  });

  it("is refused while a hand test is unmarked, and says which", () => {
    expect(() => agent.completeGoal()).toThrow(/h1 Look at the reply/);
  });

  it("goes ahead when the Agent says to finish anyway", () => {
    expect(agent.completeGoal(undefined, { unmarkedHandTests: true }).status).toBe("done");
  });

  it("goes ahead once every test is marked, whatever the mark was", () => {
    agent.markHandTest("attachments", "h1", "won't test");
    expect(agent.completeGoal().status).toBe("done");
  });
});

describe("the Agent's tools", () => {
  let client: Client;
  beforeEach(async () => {
    const server = createServer(agent);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };

  it("adds, rewords and removes items", async () => {
    expect((await call("add_hand_test", { text: "Try the mic", task: "t2" })).text).toContain("Saved hand test h1: Try the mic");
    expect((await call("update_hand_test", { id: "h1", text: "Try the mic twice" })).text).toContain("Changed hand test h1: Try the mic twice");
    expect((await call("update_hand_test", { id: "h1", text: "" })).text).toContain("Removed hand test h1.");
    expect((await call("update_hand_test", { id: "h1", text: "x" })).isError).toBe(true);
  });

  it("shows open items, then each new mark exactly once", async () => {
    await call("add_hand_test", { text: "Try the mic" });
    await call("add_hand_test", { text: "Allow the file prompt" });
    await call("add_hand_test", { text: "Skim the settings page" });
    let { text } = await call("get_status");
    expect(text).toContain("Hand tests (for the Developer to try; they mark them on the dashboard): 3 not tried yet.");
    expect(text).toContain("- h2 Allow the file prompt");
    expect(text).not.toContain("New marks");

    agent.markHandTest("attachments", "h1", "works");
    agent.markHandTest("attachments", "h2", "doesn't work", "it never asked");
    ({ text } = await call("get_status"));
    expect(text).toContain("1 not tried yet, 1 work, 1 don't work");
    expect(text).toContain("New marks from the Developer since the last status:");
    expect(text).toContain("- h2 DOESN'T WORK: Allow the file prompt Their note: it never asked (step t3 was added to fix it)");
    expect(text).toContain("- h1 works: Try the mic");

    ({ text } = await call("get_status"));
    expect(text).not.toContain("New marks");
    expect(text).toContain("1 not tried yet, 1 work, 1 don't work");

    agent.markHandTest("attachments", "h3", "won't test");
    ({ text } = await call("get_status"));
    expect(text).toMatch(/New marks[^]*h3 the Developer won't test it: Skim the settings page/);
  });

  it("refuses complete_goal while items are unmarked, and the override finishes it", async () => {
    await call("complete_task", { task: "t1" });
    await call("complete_task", { task: "t2" });
    await call("add_hand_test", { text: "Look at the reply" });
    const refused = await call("complete_goal");
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("unmarked_hand_tests_ok");
    expect((await call("complete_goal", { unmarked_hand_tests_ok: true })).isError).toBe(false);
  });

  it("looks a hand test up by its ref", async () => {
    await call("add_hand_test", { text: "Look at the reply", task: "t1" });
    agent.markHandTest("attachments", "h1", "doesn't work", "blank");
    const { text } = await call("get_item", { ref: "progressor://attachments/h1" });
    expect(text).toContain("Hand test h1: Look at the reply (DOESN'T WORK)");
    expect(text).toContain("Developer's note: blank");
    expect(text).toContain("About Task: t1");
  });
});

describe("the dashboard endpoint", () => {
  let d: Dashboard;
  let id: string;
  const mark = (body: unknown, headers: Record<string, string> = {}, path = `/api/projects/${id}/goals/attachments/hand-tests/h1`) =>
    fetch(new URL(path, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "mark", "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(async () => {
    agent.addHandTest("Look at the reply");
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    id = projectEntry(root).id;
  });
  afterEach(async () => {
    await d.close();
  });

  it("shows the items on the Goal's page", async () => {
    const res = await fetch(new URL(`/api/projects/${id}/goals/attachments`, d.url));
    expect(((await res.json()) as any).handTests).toMatchObject([{ id: "h1", result: "pending" }]);
  });

  it("writes a mark into the plan, and a failure adds its Task", async () => {
    expect((await mark({ mark: "works" })).status).toBe(200);
    expect(plan().handTest("h1")!.result).toBe("works");
    const res = await mark({ mark: "doesn't work", note: "blank page" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "doesn't work", note: "blank page", taskAdded: "t3" });
    expect(plan().task("t3")!.summary).toContain("blank page");
    expect((await mark({ mark: "clear" })).status).toBe(200);
    expect(plan().handTest("h1")!.result).toBe("pending");
    expect(plan().task("t3")!.status).toBe("dropped");
  });

  it("refuses another web page, a missing header, the wrong header, and a form post", async () => {
    expect((await mark({ mark: "works" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await mark({ mark: "works" }, { "x-progressor": "stop" })).status).toBe(403);
    expect((await mark({ mark: "works" }, { "x-progressor": "" })).status).toBe(403);
    expect((await mark({ mark: "works" }, { "content-type": "text/plain" })).status).toBe(415);
    expect(plan().handTest("h1")!.result).toBe("pending");
  });

  it("refuses bad marks, bad bodies and too big ones", async () => {
    expect((await mark({ mark: "maybe" })).status).toBe(400);
    expect((await mark({})).status).toBe(400);
    expect((await mark({ mark: "works", note: 5 })).status).toBe(400);
    expect((await mark("{not json")).status).toBe(400);
    expect((await mark({ mark: "works", note: "x".repeat(10000) })).status).toBe(413);
    expect(plan().handTest("h1")!.result).toBe("pending");
  });

  it("answers 404 for an unknown project, Goal or item, and refuses other verbs", async () => {
    expect((await mark({ mark: "works" }, {}, `/api/projects/nope/goals/attachments/hand-tests/h1`)).status).toBe(404);
    expect((await mark({ mark: "works" }, {}, `/api/projects/${id}/goals/zzz/hand-tests/h1`)).status).toBe(404);
    expect((await mark({ mark: "works" }, {}, `/api/projects/${id}/goals/attachments/hand-tests/h9`)).status).toBe(404);
    expect((await fetch(new URL(`/api/projects/${id}/goals/attachments/hand-tests/h1`, d.url), { method: "PUT" })).status).toBe(405);
  });

  it("answers only requests addressed to localhost", async () => {
    const port = new URL(d.url).port;
    const body = JSON.stringify({ mark: "works" });
    const status = await new Promise<number>((done) => {
      const req = request(
        {
          host: "127.0.0.1",
          port,
          method: "POST",
          path: `/api/projects/${id}/goals/attachments/hand-tests/h1`,
          headers: { host: `evil.example:${port}`, origin: `http://evil.example:${port}`, "x-progressor": "mark", "content-type": "application/json" },
        },
        (res) => done(res.statusCode ?? 0),
      );
      req.end(body);
    });
    expect(status).toBe(403);
    expect(plan().handTest("h1")!.result).toBe("pending");
  });
});
