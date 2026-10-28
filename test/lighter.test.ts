import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { INSTRUCTIONS, createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let client: Client;

beforeEach(async () => {
  const project = new Project({ root: tempDir("progressor-"), session: { id: "s-a", pid: process.pid } });
  const server = createServer(project);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError ?? false };
}

describe("short answers for the step tools", () => {
  beforeEach(async () => {
    await call("add_standing_instruction", { text: "Always write tests first." });
    await call("update_context", { text: "A long background page about the project." });
    await call("add_goal", { title: "Login", tasks: [{ title: "Route", estimate: "30m" }, { title: "Logout" }], claim: true });
  });

  it("start_task confirms, then says where the work stands, without the whole status", async () => {
    const { text } = await call("start_task", { task: "t1" });
    expect(text).toBe("Started t1 Route.\nNow: t1 Route · Next: t2 Logout");
    expect(text).not.toContain("Standing Instructions");
    expect(text).not.toContain("Important context");
  });

  it("complete_task confirms, and ends with the Now line", async () => {
    await call("start_task", { task: "t1" });
    const { text } = await call("complete_task", { task: "t1", code: ["a.ts"] });
    expect(text.split("\n")[0]).toBe("Done: t1 Route.");
    expect(text.split("\n").at(-1)).toBe("Now: no Task in progress · Next: start_task t2 Logout");
    expect(text).not.toContain("Standing Instructions");
  });

  it("drop_task and end_detour answer briefly too", async () => {
    const dropped = (await call("drop_task", { task: "t2", reason: "not needed" })).text;
    expect(dropped).not.toContain("Standing Instructions");
    expect(dropped.split("\n").at(-1)).toMatch(/^Now: /);
    await call("start_detour", { title: "Fix build", reason: "red" });
    const ended = (await call("end_detour", { ending: "merge back" })).text;
    expect(ended).not.toContain("Standing Instructions");
    expect(ended.split("\n").at(-1)).toMatch(/^Now: /);
  });

  it("claim_goal and get_status still give the whole picture", async () => {
    expect((await call("get_status")).text).toContain("Standing Instructions");
    await call("release_goal");
    expect((await call("claim_goal", { goal: "login" })).text).toContain("Important context");
  });
});

describe("get_status with no Goal claimed", () => {
  it("lists open Goals, and only counts the finished and dropped ones", async () => {
    await call("add_goal", { title: "Old one", tasks: [{ title: "x", done: true }], done: true });
    await call("add_goal", { title: "Old two", tasks: [{ title: "x", done: true }], done: true });
    await call("add_goal", { title: "Gone" });
    await call("drop_goal", { goal: "gone", reason: "no" });
    await call("add_goal", { title: "Planned one", tasks: [{ title: "y" }] });
    const { text } = await call("get_status");
    expect(text).toContain("- planned-one: Planned one (planned)");
    expect(text).not.toContain("Old one");
    expect(text).not.toContain("Gone");
    expect(text).toContain("Finished: 2 goals (not listed; get_item progressor://<goal> to look one up).");
    expect(text).toMatch(/Cancelled: 1 goal\b/);
  });

  it("says nothing about finished Goals when there are none", async () => {
    await call("add_goal", { title: "Planned one" });
    expect((await call("get_status")).text).not.toContain("Finished:");
  });
});

describe("the instructions", () => {
  it("are short but keep every rule", () => {
    expect(INSTRUCTIONS.length).toBeLessThanOrEqual(3600);
    for (const word of [
      "get_status", "add_goal", "start_task", "complete_task", "set_task_state", "update_tasks", "claim_goal", "start_detour", "end_detour",
      "complete_goal", "add_standing_instruction", "hard: true", "update_context", "add_decision", "add_note", "add_hand_test",
      "ask_developer", "reply_to_developer", "New from the Developer", "get_rules", "claim_resource", "project", "dashboard", "everyday words",
    ])
      expect(INSTRUCTIONS).toContain(word);
  });
});
