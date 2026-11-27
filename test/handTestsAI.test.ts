import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir, withoutDates } from "./tmp.js";

const NOW = new Date("2026-11-27T10:00:00.000Z");
let root: string;
let agent: Project;
let client: Client;

const planText = () => withoutDates(readFileSync(join(root, ".progressor/goals/attachments.md"), "utf8"));
const plan = () => parsePlanFile(planText(), "attachments");
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
};

beforeEach(async () => {
  root = tempDir("progressor-ai-hand-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => NOW });
  const goal = agent.addGoal("Attachments", [{ title: "Read attached files" }]);
  agent.claimGoal(goal.id);
  agent.addHandTest("Allow the prompt and check the reply", undefined, "t1");
  const server = createServer(agent);
  const [c, s] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(s), client.connect(c)]);
});

describe("the AI marking a hand test", () => {
  it("records who marked it and keeps the note for every result, already seen", () => {
    const t = agent.markHandTest("attachments", "h1", "works", "Opened it, the reply showed", "AI");
    expect(t).toMatchObject({ result: "works", note: "Opened it, the reply showed", by: "AI", seen: true });
    expect(planText()).toContain("  - by: AI");
    expect(parsePlanFile(planText(), "attachments").handTest("h1")).toMatchObject({ by: "AI", seen: true });
  });

  it("is replaced by a Developer mark, which clears who marked it", () => {
    agent.markHandTest("attachments", "h1", "works", "fine", "AI");
    const t = agent.markHandTest("attachments", "h1", "won't test");
    expect(t).toMatchObject({ result: "won't test", by: undefined, seen: false, note: undefined });
    expect(planText()).not.toContain("by: AI");
  });

  it("reads plan files that have no by line", () => {
    agent.markHandTest("attachments", "h1", "works");
    expect(plan().handTest("h1")!.by).toBeUndefined();
  });

  it("adds a step for 'doesn't work', like the Developer's mark", () => {
    const t = agent.markHandTest("attachments", "h1", "doesn't work", "froze", "AI");
    expect(t.taskAdded).toBe("t2");
    expect(plan().task("t2")).toMatchObject({ status: "pending", title: "Fix: Allow the prompt and check the reply" });
  });
});

describe("save_hand_test with a result", () => {
  it("marks a test on a goal nobody holds and finishes the goal waiting on tests", async () => {
    await call("update_tasks", { operations: [{ action: "complete", task: "t1" }] });
    await call("complete_goal");
    const r = await call("save_hand_test", { goal: "attachments", id: "h1", result: "works", note: "Tried it" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Marked hand test h1: works");
    expect(r.text).toContain("finished");
    expect(plan().handTest("h1")).toMatchObject({ result: "works", by: "AI" });
    const status = await call("get_status");
    expect(status.text).not.toContain("New marks");
  });

  it("reports the step added for a failure", async () => {
    const r = await call("save_hand_test", { id: "h1", result: "doesn't work", note: "froze" });
    expect(r.text).toContain("Step t2 was added");
  });

  it("attaches a picture as proof", async () => {
    const png = join(root, "shot.png");
    writeFileSync(png, Buffer.from("89504e470d0a1a0a", "hex"));
    const r = await call("save_hand_test", { id: "h1", result: "works", note: "ok", picture: png });
    expect(r.isError).toBe(false);
    const pics = JSON.parse(readFileSync(join(root, ".progressor/pictures/attachments/index.json"), "utf8"));
    expect(pics[0]).toMatchObject({ handTest: "h1" });
  });

  it("needs a result to mark, and refuses a bad one", async () => {
    expect((await call("save_hand_test", { result: "works" })).isError).toBe(true);
  });
});

describe("the Developer's note", () => {
  it("is kept for works and won't test too, and dropped when the mark is cleared", () => {
    expect(agent.markHandTest("attachments", "h1", "works", "looked right").note).toBe("looked right");
    expect(agent.markHandTest("attachments", "h1", "won't test", "no second computer").note).toBe("no second computer");
    expect(agent.markHandTest("attachments", "h1", "pending", "x").note).toBeUndefined();
  });
});
