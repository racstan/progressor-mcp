import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";

let client: Client;

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), "progressor-"));
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
        "add_goal",
        "add_standing_instruction",
        "add_tasks",
        "claim_goal",
        "complete_goal",
        "complete_task",
        "drop_task",
        "end_detour",
        "get_item",
        "get_status",
        "promote_idea",
        "record_idea",
        "release_goal",
        "start_detour",
        "start_task",
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
        "No Goal is claimed by this Session. Claim one with claim_goal, or add one with add_goal.",
        "Goals:",
        "- login: Login (planned)",
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

  it("reports domain errors as tool errors", async () => {
    const result = await call("start_task", { task: "t1" });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/claim a Goal first/);
  });

  it("tells the Agent where the Developer can open the dashboard", async () => {
    const root = mkdtempSync(join(tmpdir(), "progressor-"));
    const project = new Project({ root, session: { id: "s-a", pid: process.pid } });
    let refreshed = 0;
    const server = createServer(project, {
      dashboard: { url: "http://localhost:4747/", refresh: async () => void refreshed++ },
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const withDashboard = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), withDashboard.connect(clientSide)]);
    const result = (await withDashboard.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] };
    expect(result.content[0]!.text.split("\n").at(-1)).toBe(
      "Dashboard: http://localhost:4747/ (tell the Developer they can follow progress there)",
    );
    expect(refreshed).toBe(1);
  });
});
