import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it } from "vitest";
import { applyChanges, launchFor, planInit } from "../src/init.js";
import { Project } from "../src/project.js";
import { setupPrompt } from "../src/prompts.js";
import { appRoots, createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let client: Client;
let root: string;

beforeEach(async () => {
  root = tempDir("progressor-");
  const project = new Project({ root, session: { id: "s-a", pid: process.pid } });
  const server = createServer(project);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError ?? false };
}

describe("the MCP server", () => {
  it("lists its tools and tells the Agent how to use them", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "add_decision",
        "add_goal",
        "add_note",
        "add_standing_instruction",
        "add_tasks",
        "claim_goal",
        "complete_goal",
        "complete_task",
        "drop_goal",
        "drop_task",
        "end_detour",
        "get_item",
        "get_rules",
        "get_status",
        "move_goal",
        "move_task",
        "release_goal",
        "set_task_state",
        "start_detour",
        "start_task",
        "update_context",
        "update_decision",
        "update_goal",
        "update_note",
        "update_standing_instruction",
        "update_task",
        "update_tasks",
      ].sort(),
    );
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toMatch(/get_status/);
    expect(instructions).toMatch(/start_detour/);
  });

  it("asks the Agent to claim a Goal when it has none", async () => {
    await call("add_goal", { title: "Login" });
    const { text } = await call("get_status");
    expect(text).toBe(
      [
        "No Goal is claimed by this Session. Claim one with claim_goal, or plan one and add it with add_goal (claim: true).",
        "Goals:",
        "- login: Login (planned)",
        `Project folder: ${root}`,
      ].join("\n"),
    );
  });

  it("summarises the current Goal, Task, open Detour, next Task and Standing Instructions", async () => {
    await call("add_goal", {
      title: "Login",
      tasks: [{ title: "Add route" }, { title: "Handle callback" }, { title: "Cookies" }],
    });
    await call("claim_goal", { goal: "login" });
    await call("complete_task", { task: "t1" });
    await call("start_task", { task: "t2" });
    await call("start_detour", { title: "Fix flaky refresh", reason: "callback tests fail randomly" });
    await call("add_standing_instruction", { text: "Ask me before recalibrating" });

    const { text } = await call("get_status");
    expect(text).toBe(
      [
        "Goal: Login (progressor://login), claimed by this Session",
        "Plan File: .progressor/goals/login.md",
        "Progress: 1 of 3 Tasks done",
        "Current Task: t2 Handle callback (.progressor/goals/login.md:6)",
        "Open Detour: d1 Fix flaky refresh, branched from t2. Reason: callback tests fail randomly",
        "Next Task: t3 Cookies",
        "Standing Instructions:",
        "- s1 Ask me before recalibrating",
        `Project folder: ${root}`,
      ].join("\n"),
    );
  });

  it("ends a Detour with a Recalibration through the tool", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Cookies" }] });
    await call("claim_goal", { goal: "login" });
    await call("start_detour", { title: "Rethink", reason: "mobile app" });
    const { text } = await call("end_detour", {
      ending: "recalibrate",
      tasks: [{ title: "Server-side tokens", code: ["src/tokens.ts"] }],
    });

    expect(text).toContain("Dropped: t1");
    expect(text).toContain("Added: t2 Server-side tokens");
  });

  it("returns an item with its file and line", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Add route", code: ["src/login.ts:12"] }] });
    const { text } = await call("get_item", { ref: "progressor://login/t1" });
    expect(text).toContain("Task t1: Add route");
    expect(text).toContain(".progressor/goals/login.md:5");
    expect(text).toContain("src/login.ts:12");
  });

  it("gives every Task a title, files and a summary of its change, and shows them back", async () => {
    await call("add_goal", {
      title: "Login",
      tasks: [
        { title: "Fix callback redirect loop", summary: "Stop re-setting the cookie.", code: ["src/auth/callback.ts"] },
        { title: "Add logout", summary: "Clear the session cookie and redirect home." },
      ],
    });
    await call("claim_goal", { goal: "login" });
    await call("start_task", { task: "t1" });
    const updated = await call("update_task", {
      task: "t1",
      summary: "Callback re-sets the session cookie on every hit; only set it after token exchange.",
      code: ["src/auth/callback.ts", "src/auth/session.ts:42"],
    });
    expect(updated.isError).toBe(false);

    const status = (await call("get_status")).text.split("\n");
    expect(status.slice(3, 7)).toEqual([
      "Current Task: t1 Fix callback redirect loop (.progressor/goals/login.md:5)",
      "  Summary: Callback re-sets the session cookie on every hit; only set it after token exchange.",
      "Next Task: t2 Add logout",
      "  Summary: Clear the session cookie and redirect home.",
    ]);
    const item = (await call("get_item", { ref: "progressor://login/t1" })).text;
    expect(item).toContain("Summary: Callback re-sets the session cookie on every hit; only set it after token exchange.");
    expect(item).toContain("Code: src/auth/callback.ts, src/auth/session.ts:42");

    await call("complete_task", { task: "t1", summary: "Only set the cookie after token exchange." });
    expect((await call("get_item", { ref: "progressor://login/t1" })).text).toContain(
      "Summary: Only set the cookie after token exchange.",
    );
    expect(client.getInstructions()).toMatch(/summary/);
  });

  it("reports domain errors as tool errors", async () => {
    const result = await call("start_task", { task: "t1" });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/claim a Goal first/);
  });

  it("tells the Agent where the Developer can open the dashboard", async () => {
    const root = tempDir("progressor-");
    const project = new Project({ root, session: { id: "s-a", pid: process.pid } });
    let refreshed = 0;
    const server = createServer(project, {
      dashboard: { url: "http://localhost:4747/", refresh: async () => void refreshed++ },
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const withDashboard = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), withDashboard.connect(clientSide)]);
    const result = (await withDashboard.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] };
    expect(result.content[0]!.text.split("\n").at(-1)).toBe("Dashboard: http://localhost:4747/");
    expect(refreshed).toBe(1);
  });
});

describe("shaping Goals through the tools", () => {
  it("adds a Goal with a short ID and an Outcome, and shows the Outcome in the status", async () => {
    expect((await call("add_goal", { title: "Share the screens", id: "web-ui", outcome: "Every screen works on the web" })).text).toContain(
      "Added Goal web-ui (progressor://web-ui)",
    );
    await call("claim_goal", { goal: "web-ui" });
    expect((await call("get_status")).text).toContain("Outcome: Every screen works on the web");
    expect((await call("get_item", { ref: "progressor://web-ui" })).text).toContain("Outcome: Every screen works on the web");
  });

  it("refuses a duplicate title with a way out", async () => {
    await call("add_goal", { title: "Try it" });
    const again = await call("add_goal", { title: "Try it" });
    expect(again.isError).toBe(true);
    expect(again.text).toMatch(/allow_duplicate/);
    expect((await call("add_goal", { title: "Try it", allow_duplicate: true })).text).toContain("try-it-2");
  });

  it("records finished work in one call", async () => {
    const r = await call("add_goal", { title: "Spike", tasks: [{ title: "A", done: true }, { title: "B", done: true }], done: true });
    expect(r.text).toBe("Recorded finished Goal spike (progressor://spike) with 2 done Tasks.");
  });

  it("renames, moves and drops Goals", async () => {
    await call("add_goal", { title: "One" });
    await call("add_goal", { title: "Two" });
    expect((await call("update_goal", { goal: "two", title: "Second", outcome: "It ships" })).text).toContain("Goal two: Second");
    expect((await call("move_goal", { goal: "two", before: "one" })).text).toBe("Goals in order:\n- two: Second (planned)\n- one: One (planned)");
    expect((await call("drop_goal", { goal: "one", reason: "Not needed" })).text).toBe("Dropped Goal one: Not needed");
  });
});

describe("slash commands", () => {
  it("offers its commands as prompts", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["dashboard", "next", "plan", "review", "setup", "status"]);
    expect(prompts.find((p) => p.name === "plan")!.arguments?.map((a) => [a.name, a.required])).toEqual([["goal", false]]);
  });

  const text = async (name: string, args: Record<string, string> = {}) =>
    (await client.getPrompt({ name, arguments: args })).messages.map((m) => (m.content as { text: string }).text).join("\n");

  it("status shows where things stand and asks for a short summary", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Callback" }] });
    await call("claim_goal", { goal: "login" });
    const t = await text("status");
    expect(t).toContain("Goal: Login (progressor://login), claimed by this Session");
    expect(t).toMatch(/summari[sz]e/i);
  });

  it("plan with no text asks what to plan, in the chat", async () => {
    const t = await text("plan");
    expect(t).toMatch(/ask me what/i);
    expect(t).toMatch(/links/i);
    expect(t).toContain("add_goal");
  });

  it("plan asks for a plan to approve before add_goal", async () => {
    const t = await text("plan", { goal: "Dark mode for the settings page" });
    expect(t).toContain("Dark mode for the settings page");
    expect(t).toMatch(/Outcome/);
    expect(t).toMatch(/wait for my OK/i);
    expect(t).toContain("add_goal");
  });

  it("next starts the claimed Goal's next Task", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route", done: true }, { title: "Callback" }] });
    await call("claim_goal", { goal: "login" });
    const t = await text("next");
    expect(t).toContain("start_task");
    expect(t).toContain("t2 Callback");
  });

  it("next carries on with the Task in progress", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }, { title: "Callback" }] });
    await call("claim_goal", { goal: "login" });
    await call("start_task", { task: "t1" });
    const t = await text("next");
    expect(t).toContain("t1 Route");
    expect(t).not.toContain("start_task");
  });

  it("next finishes an open Detour before anything else", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }] });
    await call("claim_goal", { goal: "login" });
    await call("start_task", { task: "t1" });
    await call("start_detour", { title: "Fix the build", reason: "It is red" });
    const t = await text("next");
    expect(t).toContain("Fix the build");
    expect(t).toContain("end_detour");
  });

  it("next completes a Goal whose Tasks are all done and says so", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route", done: true }] });
    await call("claim_goal", { goal: "login" });
    const t = await text("next");
    expect(t).toContain("complete_goal");
    expect(t).toMatch(/tell me/i);
    expect(t).not.toMatch(/ask me before/i);
  });

  it("next claims the one paused Goal", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }] });
    await call("claim_goal", { goal: "login" });
    await call("release_goal");
    const t = await text("next");
    expect(t).toContain("claim_goal");
    expect(t).toContain("login");
  });

  it("next asks which Goal when several could be picked up", async () => {
    await call("add_goal", { title: "Login" });
    await call("add_goal", { title: "Billing" });
    const t = await text("next");
    expect(t).toMatch(/ask me which/i);
    expect(t).toContain("login");
    expect(t).toContain("billing");
  });

  it("next suggests planning a Goal when the Roadmap is empty", async () => {
    expect(await text("next")).toContain("/progressor:plan");
  });

  it("dashboard says when this Session has no dashboard", async () => {
    expect(await text("dashboard")).toContain("progressor-mcp dashboard");
  });

  it("setup has the Agent run init itself and say what it changed", async () => {
    const t = await text("setup");
    expect(t).toContain("CLAUDE.md");
    expect(t).toContain("AGENTS.md");
    expect(t).toContain(".progressor/roadmap.md");
    expect(t).not.toContain(".mcp.json:");
    expect(t).toMatch(/init "[^"]+" --yes --no-server/);
    expect(t).toMatch(/run this command yourself/i);
    expect(t).not.toMatch(/wait for my OK|in a terminal/i);
  });

  it("setup says when the folder is already set up", () => {
    const root = tempDir("progressor-");
    const launch = launchFor({ viaNpx: false, platform: "linux" });
    applyChanges(planInit(root, launch, { server: false }));
    const t = setupPrompt(root, launch);
    expect(t).toMatch(/already set up/i);
    expect(t).not.toContain("--yes");
  });

  it("review lists the Goal's Tasks and says how to reopen it", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Callback", done: true, summary: "Sets the cookie" }], done: true });
    const t = await text("review", { goal: "login" });
    expect(t).toContain("[x] t1 Callback: Sets the cookie");
    expect(t).toContain("claim_goal");
    expect(t).toContain("add_tasks");
  });
});

describe("the dashboard command", () => {
  it("hands over this project's dashboard link", async () => {
    const project = new Project({ root: tempDir("progressor-"), session: { id: "s-b", pid: process.pid } });
    const url = "http://localhost:4747/?project=shop-1a2b3c";
    const server = createServer(project, { dashboard: { url, refresh: async () => {} } });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), c.connect(clientSide)]);
    const t = (await c.getPrompt({ name: "dashboard" })).messages.map((m) => (m.content as { text: string }).text).join("\n");
    expect(t).toContain(url);
    expect(t).toMatch(/browser/i);
  });
});

describe("the folder the app has open", () => {
  const connect = async (withRoots: boolean) => {
    const project = new Project({ root: tempDir("progressor-"), session: { id: "s-r", pid: process.pid } });
    const server = createServer(project);
    const c = new Client({ name: "test", version: "0" }, { capabilities: withRoots ? { roots: {} } : {} });
    if (withRoots)
      c.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: [{ uri: "file:///home/dev/shop", name: "shop" }] }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), c.connect(clientSide)]);
    return server;
  };

  it("lists the app's roots when it has them", async () => {
    expect(await appRoots(await connect(true), 1000)).toEqual(["file:///home/dev/shop"]);
  });

  it("gives nothing when the app does not report roots", async () => {
    expect(await appRoots(await connect(false), 1000)).toBeUndefined();
  });
});

describe("get_status", () => {
  it("names the project folder", async () => {
    expect((await call("get_status")).text).toMatch(/Project folder: .*progressor-/);
  });
});

describe("update_standing_instruction", () => {
  it("changes a rule, and removes it when the text is empty", async () => {
    await call("add_standing_instruction", { text: "Ask before pushing" });
    await call("add_standing_instruction", { text: "Write tests first" });
    expect((await call("update_standing_instruction", { id: "s1", text: "Ask before pushing or publishing" })).text).toBe(
      "Changed Standing Instruction s1: Ask before pushing or publishing",
    );
    expect((await call("update_standing_instruction", { id: "s2", text: "" })).text).toBe("Removed Standing Instruction s2.");
    const { text } = await call("get_status");
    expect(text).toContain("- s1 Ask before pushing or publishing");
    expect(text).not.toContain("Write tests first");
  });
});

describe("update_context", () => {
  it("replaces the Important context, which get_status then shows after the rules", async () => {
    await call("add_standing_instruction", { text: "Write tests first" });
    expect((await call("update_context", { text: "Progressor is an MCP server.\nReleases go out by pushing a tag." })).text).toMatch(
      /^Saved the Important context \(\d+ of 4000 characters\)\./,
    );
    const { text } = await call("get_status");
    expect(text).toContain(
      ["- s1 Write tests first", "Important context:", "Progressor is an MCP server.", "Releases go out by pushing a tag."].join("\n"),
    );
  });

  it("says when the text is too long", async () => {
    const r = await call("update_context", { text: "x".repeat(4001) });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/too long/);
  });

  it("is mentioned in the instructions", () => {
    expect(client.getInstructions() ?? "").toContain("update_context");
  });
});

describe("the Agent runs the loop itself", () => {
  it("is told to plan, finish and talk plainly without waiting on the Developer", () => {
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toContain("claim: true");
    expect(instructions).toContain("complete_goal");
    expect(instructions).toContain("update_standing_instruction");
    expect(instructions).toMatch(/everyday words/);
    expect(instructions).toMatch(/dashboard/i);
    expect(instructions).not.toMatch(/record_idea|Idea/);
  });

  it("adds and claims a Goal in one call", async () => {
    const { text } = await call("add_goal", { title: "Login", tasks: [{ title: "Route" }], claim: true });
    expect(text).toContain("claimed");
    expect((await call("get_status")).text).toContain("Goal: Login (progressor://login), claimed by this Session");
  });

  it("points at the one paused Goal to pick up", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }], claim: true });
    await call("release_goal");
    await call("add_goal", { title: "Billing" });
    expect((await call("get_status")).text).toMatch(/Goal login .*paused.*claim_goal/);
  });

  it("tells the Agent to let the Developer know a Goal is finished", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route", done: true }], claim: true });
    expect((await call("complete_goal")).text).toMatch(/Tell the Developer/);
  });

  it("ends results that don't show the status with a Now line", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }], claim: true });
    await call("start_task", { task: "t1" });
    const added = (await call("add_tasks", { tasks: [{ title: "Logout" }] })).text;
    expect(added.split("\n").at(-1)).toBe("Now: t1 Route · Next: t2 Logout");
    const detour = (await call("start_detour", { title: "Fix the build", reason: "It is red" })).text;
    expect(detour.split("\n").at(-1)).toBe('Now: side trip "Fix the build" (end it with end_detour) · then t1 Route');
  });
});

describe("several Goals in one Session", () => {
  beforeEach(async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }, { title: "Callback" }] });
    await call("add_goal", { title: "Voice", tasks: [{ title: "Try on phone" }, { title: "Ship" }] });
    await call("claim_goal", { goal: "login" });
    await call("complete_task", { task: "t1" });
    await call("start_task", { task: "t2" });
    await call("add_note", { goal: "voice", text: "The mic stays on" });
    await call("claim_goal", { goal: "voice" });
  });

  it("describes every Goal the Session holds, compactly", async () => {
    await call("set_task_state", { goal: "voice", task: "t1", state: "waiting on you" });
    await call("add_decision", { goal: "voice", text: "Old models get thinking on/off only" });
    await call("add_standing_instruction", { text: "Write tests first" });
    expect((await call("get_status")).text).toBe(
      [
        "This Session holds 2 Goals; pass goal (the Goal ID) to the tools that change one.",
        "Goal login: Login (progressor://login), 1 of 2 Tasks done",
        "  Current Task: t2 Callback (.progressor/goals/login.md:6)",
        "  Next Task: none; every Task is done or dropped",
        "Goal voice: Voice (progressor://voice), 0 of 2 Tasks done, waiting on the Developer",
        "  Current Task: none",
        "  Waiting on the Developer: t1 Try on phone",
        "  Next Task: t2 Ship",
        "  Decisions: c1 Old models get thinking on/off only",
        "  Notes: n1 The mic stays on (from progressor://login)",
        "Standing Instructions:",
        "- s1 Write tests first",
        `Project folder: ${root}`,
      ].join("\n"),
    );
  });

  it("asks which Goal a change is for, and ends other results with each Goal's Now", async () => {
    const r = await call("start_task", { task: "t2" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/several Goals \(login, voice\)/);
    const added = (await call("add_tasks", { goal: "voice", tasks: [{ title: "Docs" }] })).text;
    expect(added.split("\n").at(-1)).toBe("Now: login: t2 Callback · voice: next t1 Try on phone");
    expect((await call("release_goal", { goal: "login" })).text).toBe("Released Goal login; it is now paused.");
    expect((await call("get_status")).text).toContain("Goal: Voice (progressor://voice), claimed by this Session");
  });

  it("refuses a Goal the Session has not claimed", async () => {
    await call("add_goal", { title: "Billing" });
    const r = await call("add_decision", { goal: "billing", text: "x" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/not claimed by this Session/);
  });
});

describe("Task states, decisions and notes through the tools", () => {
  beforeEach(async () => {
    await call("add_goal", {
      title: "Voice",
      tasks: [{ title: "Record" }, { title: "Transcribe" }, { title: "Try on phone" }, { title: "Ship" }],
      claim: true,
    });
  });

  it("sets a Task's state and shows the ones that are with a helper, waiting or checked", async () => {
    const r = await call("set_task_state", { task: "t1", state: "with a helper" });
    expect(r.text.split("\n")[0]).toBe("Task t1 Record is now with a helper.");
    await call("set_task_state", { task: "t2", state: "checked" });
    await call("set_task_state", { task: "t3", state: "waiting on you" });
    const status = (await call("get_status")).text.split("\n");
    expect(status.slice(2, 8)).toEqual([
      "Progress: 0 of 4 Tasks done",
      "Current Task: none (start one with start_task)",
      "With a helper: t1 Record",
      "Waiting on the Developer: t3 Try on phone",
      "Checked, not yet released: t2 Transcribe",
      "Next Task: t4 Ship",
    ]);
    await call("set_task_state", { task: "t2", state: "released" });
    expect((await call("get_status")).text).toContain("Progress: 1 of 4 Tasks done");
    const done = await call("complete_goal");
    expect(done.isError).toBe(true);
    expect(done.text).toContain("t1 Record (with a helper)");
  });

  it("says what is left when only other hands hold the remaining Tasks", async () => {
    await call("complete_task", { task: "t1" });
    await call("complete_task", { task: "t2" });
    await call("set_task_state", { task: "t3", state: "with a helper" });
    const r = await call("set_task_state", { task: "t4", state: "waiting on you" });
    expect(r.text.split("\n").at(-1)).toBe("Now: no Task in progress · Waiting: t3 Try on phone (with a helper), t4 Ship (waiting on you)");
  });

  it("records decisions and notes, shows them in the status, and changes them", async () => {
    await call("add_goal", { title: "Cleanup" });
    expect((await call("add_decision", { text: "Old models get thinking on/off only" })).text.split("\n")[0]).toBe(
      "Saved decision c1 in Goal voice: Old models get thinking on/off only",
    );
    expect((await call("add_note", { goal: "cleanup", text: "Two loggers" })).text.split("\n")[0]).toBe("Saved note n1 in Goal cleanup: Two loggers");
    await call("add_note", { goal: "voice", text: "Mic stays on" });
    const status = (await call("get_status")).text;
    expect(status).toContain(["Next Task: t1 Record", "Decisions:", "- c1 Old models get thinking on/off only", "Notes:", "- n1 Mic stays on"].join("\n"));
    expect(status).not.toContain("Two loggers");

    expect((await call("update_decision", { id: "c1", text: "Old models: on/off only" })).text).toBe("Changed decision c1: Old models: on/off only");
    expect((await call("update_decision", { id: "c1", text: "" })).text).toBe("Removed decision c1.");
    expect((await call("update_note", { goal: "voice", id: "n1", resolved: true })).text).toBe("Resolved note n1: Mic stays on");
    expect((await call("update_note", { goal: "cleanup", id: "n1", text: "" })).text).toBe("Removed note n1.");
    expect((await call("get_status")).text).not.toMatch(/Decisions|Notes/);
    expect((await call("get_item", { ref: "progressor://voice/n1" })).text).toContain("Note n1: Mic stays on (resolved)");
  });

  it("tells the Agent when to use them", () => {
    const instructions = client.getInstructions() ?? "";
    for (const tool of ["set_task_state", "add_decision", "add_note", "goal"]) expect(instructions).toContain(tool);
  });
});

describe("hard rules and the rules block for helper agents", () => {
  it("saves a hard rule, lists hard rules first in the status, and changes the flag alone", async () => {
    await call("add_standing_instruction", { text: "Prefer small commits" });
    expect((await call("add_standing_instruction", { text: "Never commit secrets", hard: true })).text.split("\n")[0]).toBe(
      "Saved HARD RULE s2: Never commit secrets",
    );
    await call("add_goal", { title: "Login", claim: true });
    expect((await call("get_status")).text).toContain(
      ["Standing Instructions (a HARD RULE must never be broken):", "- HARD RULE s2: Never commit secrets", "- s1 Prefer small commits"].join("\n"),
    );
    expect((await call("update_standing_instruction", { id: "s1", hard: true })).text).toBe("Changed HARD RULE s1: Prefer small commits");
    expect((await call("update_standing_instruction", { id: "s2", hard: false })).text).toBe("Changed Standing Instruction s2: Never commit secrets");
    expect((await call("update_standing_instruction", { id: "s2" })).isError).toBe(true);
  });

  it("gives a ready-to-paste block for a helper's brief, hard rules first", async () => {
    expect((await call("get_rules")).text).toMatch(/^No Standing Instructions/);
    await call("add_standing_instruction", { text: "Ask me before recalibrating" });
    await call("add_standing_instruction", { text: "Never commit secrets", hard: true });
    expect((await call("get_rules")).text).toBe(
      [
        "Project rules from the Developer. Follow all of them in this work.",
        "HARD RULES: never break these. If the work seems to need breaking one, stop and report back instead.",
        "- Never commit secrets",
        "Other rules:",
        "- Ask me before recalibrating",
        "Do not edit anything in .progressor/; the Agent that briefed you keeps the plan there.",
      ].join("\n"),
    );
  });

  it("leaves out the heading of a kind of rule there is none of", async () => {
    await call("add_standing_instruction", { text: "Ask me before recalibrating" });
    const soft = (await call("get_rules")).text;
    expect(soft).not.toContain("HARD RULES");
    expect(soft).not.toContain("Other rules:");
    expect(soft).toContain("- Ask me before recalibrating");
  });

  it("is in the instructions, for briefing helpers", () => {
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toMatch(/get_rules/);
    expect(instructions).toMatch(/brief a helper/);
    expect(instructions).toMatch(/hard: true/);
  });
});

describe("update_tasks", () => {
  beforeEach(async () => {
    await call("add_goal", { title: "Voice", tasks: [{ title: "Record" }, { title: "Transcribe" }, { title: "Ship" }], claim: true });
    await call("start_task", { task: "t1" });
  });

  it("completes and starts Tasks in one call and answers with one compact status", async () => {
    const r = await call("update_tasks", {
      operations: [
        { action: "complete", task: "t1", code: ["src/record.ts"] },
        { action: "start", task: "t2" },
        { action: "state", task: "t3", state: "with a helper" },
      ],
    });
    expect(r.isError).toBe(false);
    expect(r.text).toBe(
      ["Updated: t1 Record is done; t2 Transcribe is in progress; t3 Ship is with a helper.", "Now: t2 Transcribe · Next: complete_goal"].join("\n"),
    );
  });

  it("changes nothing when an operation fails, and says which", async () => {
    const r = await call("update_tasks", { operations: [{ action: "complete", task: "t1" }, { action: "drop", task: "t2" }] });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Operation 2 \(drop t2\).*reason.*Nothing was changed/);
    expect((await call("get_status")).text).toContain("Current Task: t1 Record");
  });

  it("is in the instructions", () => {
    expect(client.getInstructions() ?? "").toContain("update_tasks");
  });
});

describe("move_task", () => {
  beforeEach(async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }, { title: "Mic check" }], claim: true });
    await call("add_goal", { title: "Voice", tasks: [{ title: "Record" }] });
  });

  it("moves a Task to another Goal and says where it went", async () => {
    const r = await call("move_task", { task: "t2", to_goal: "voice" });
    expect(r.isError).toBe(false);
    expect(r.text.split("\n")[0]).toBe(
      "Moved t2 Mic check from login to voice as progressor://voice/t2. The old t2 stays in login, dropped with the reason it moved.",
    );
    expect((await call("get_item", { ref: "progressor://voice/t2" })).text).toContain("Moved from: progressor://login/t2");
    expect((await call("get_item", { ref: "progressor://login/t2" })).text).toMatch(/Reason: Moved to the goal "[^"]+" \(progressor:\/\/voice\/t2\)/);
  });

  it("puts the Task before another and reports a refusal", async () => {
    await call("move_task", { task: "t2", to_goal: "voice", before: "t1" });
    await call("claim_goal", { goal: "voice" });
    expect((await call("get_item", { ref: "progressor://voice/t2" })).text).toContain("Mic check");
    const r = await call("move_task", { goal: "voice", task: "t1", to_goal: "voice" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/already in Goal voice/);
  });

  it("is in the instructions", () => {
    expect(client.getInstructions() ?? "").toContain("move_task");
  });
});
