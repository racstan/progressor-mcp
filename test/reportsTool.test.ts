// attach_report and get_item on a step's reports, through the MCP server.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let lead: Project;

async function connect(project: Project) {
  const server = createServer(project, { servers: () => [] });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };
}

beforeEach(() => {
  root = tempDir("progressor-report-tool-");
  lead = new Project({ root, session: { id: "s-lead", pid: process.pid } });
  lead.addGoal("Login", [{ title: "Route" }, { title: "Docs" }]);
  lead.claimGoal("login");
});

describe("attach_report", () => {
  it("keeps a report on a step and says where to read it", async () => {
    const call = await connect(lead);
    const r = await call("attach_report", { task: "t1", title: "Test run", text: "715 passed" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Attached report r1 to step t1: Test run.");
    expect(r.text).toContain("progressor://login/r1");
  });

  it("works from a chat that holds no goal when the goal is named, and says so when it is not", async () => {
    const helper = new Project({ root, session: { id: "s-help", pid: 4242 }, isAlive: () => true });
    const call = await connect(helper);
    const refused = await call("attach_report", { task: "t1", title: "x", text: "y" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/holds no goal/);
    const ok = await call("attach_report", { goal: "login", task: "t2", title: "Docs run", text: "done" });
    expect(ok.isError).toBe(false);
  });

  it("refuses an unknown step and an over-long report in words", async () => {
    const call = await connect(lead);
    expect((await call("attach_report", { task: "t9", title: "x", text: "y" })).text).toMatch(/No step t9/);
    expect((await call("attach_report", { task: "t1", title: "x", text: "a".repeat(201 * 1024) })).text).toMatch(/200 KB/);
  });

  it("takes a report back with remove, and only a report", async () => {
    const call = await connect(lead);
    await call("attach_report", { task: "t1", title: "x", text: "y" });
    expect((await call("attach_report", { remove: "r1" })).text).toMatch(/^Removed report r1./);
    expect((await call("attach_report", { remove: "roadmap" })).isError).toBe(true);
  });
});

describe("get_item and reports", () => {
  it("lists a step's reports, and gives one's full text by its ref", async () => {
    const call = await connect(lead);
    await call("attach_report", { task: "t1", title: "Test run", text: "## Results\n\n715 passed" });
    await call("attach_report", { task: "t1", title: "Second", text: "more" });
    const step = (await call("get_item", { ref: "progressor://login/t1" })).text;
    expect(step).toMatch(/Reports:\n- r1 Test run \(\d{4}-\d{2}-\d{2}.*, \d+ (B|KB)\)/);
    expect(step).toContain("- r2 Second");
    expect(step).toContain("progressor://login/r1");
    const one = await call("get_item", { ref: "progressor://login/r1" });
    expect(one.isError).toBe(false);
    expect(one.text).toContain("Report r1: Test run (step t1, written");
    expect(one.text).toContain("715 passed");
    expect((await call("get_item", { ref: "progressor://login/r9" })).isError).toBe(true);
  });

  it("shows no Reports line for a step without any, and keeps them once the step is done", async () => {
    const call = await connect(lead);
    expect((await call("get_item", { ref: "progressor://login/t2" })).text).not.toContain("Reports:");
    await call("attach_report", { task: "t1", title: "Run", text: "ok" });
    lead.completeTask("t1", [], undefined, "login");
    expect((await call("get_item", { ref: "progressor://login/t1" })).text).toContain("- r1 Run");
  });
});
