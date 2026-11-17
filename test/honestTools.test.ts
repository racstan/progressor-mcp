// A tool never reports success for a change it didn't make.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let client: Client;
const agent = () => new Project({ root, session: { id: "s", pid: process.pid }, isAlive: (p) => p === process.pid });

beforeEach(async () => {
  root = tempDir("progressor-honest-");
  const server = createServer(agent(), { registryFile: `${tempDir("progressor-reg-")}/projects.json` });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError ?? false };
}

describe("fields a tool doesn't take", () => {
  it("are refused, with the fields it does take, and nothing changes", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    const r = await call("start_task", { task: "t1", goall: "login" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/goall/);
    expect(r.text).toMatch(/start_task takes:/);
    expect(agent().roadmap().goals[0]).toBeDefined();
    const plan = await call("get_item", { ref: "progressor://login/t1" });
    expect(plan.text).toMatch(/pending/);
  });

  it("say plainly when project is given to a tool that only works on this plan", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    const r = await call("start_task", { task: "t1", project: "elsewhere" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/only works on this project's plan/);
  });
});

describe("finishing a step twice", () => {
  it("says it was already done, and keeps its files", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route", code: ["src/a.ts"] }] });
    const first = await call("complete_task", { task: "t1" });
    expect(first.text).toMatch(/^Done/);
    const second = await call("complete_task", { task: "t1", code: ["src/b.ts"] });
    expect(second.isError).toBe(false);
    expect(second.text).toMatch(/already done/i);
    const item = await call("get_item", { ref: "progressor://login/t1" });
    expect(item.text).toContain("src/a.ts");
    expect(item.text).toContain("src/b.ts");
  });
});

describe("a claim whose process number was reused", () => {
  // Times from now, as the plan file's own save time is now.
  const start = Date.now();
  const at = (hours: number) => () => new Date(start + hours * 3_600_000);
  const holder = (now: number) => new Project({ root, session: { id: "old", pid: 4242 }, isAlive: () => true, now: at(now) });
  const reader = (now: number) => new Project({ root, session: { id: "new", pid: 5555 }, isAlive: () => true, now: at(now) });

  it("still counts while the plan was changed recently", () => {
    holder(0).addGoal("Login", [{ title: "Route" }]);
    holder(0).claimGoal("login");
    expect(reader(10).heldElsewhere(reader(10).roadmap().goal("login")!)).toBe(true);
  });

  it("frees up after a day with no change to the plan, though some process has that number", () => {
    holder(0).addGoal("Login", [{ title: "Route" }]);
    holder(0).claimGoal("login");
    const later = reader(48);
    expect(later.heldElsewhere(later.roadmap().goal("login")!)).toBe(false);
  });
});

describe("goal IDs and other projects", () => {
  it("finds a goal whatever case its ID is typed in", async () => {
    await call("add_goal", { title: "Login", claim: true, tasks: [{ title: "Route" }] });
    const r = await call("get_item", { ref: "progressor://LOGIN/t1" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Route");
  });

  it("get_item takes project, and add_goal says claim can't be used on another project's plan", async () => {
    const { tools } = await client.listTools();
    const props = (n: string) => Object.keys((tools.find((t) => t.name === n)!.inputSchema as { properties: object }).properties);
    expect(props("get_item")).toContain("project");
    const claim = (tools.find((t) => t.name === "add_goal")!.inputSchema as { properties: Record<string, { description?: string }> }).properties.claim!;
    expect(claim.description).toMatch(/another project/i);
  });
});

describe("how long a closed-looking chat keeps its claim (Settings)", () => {
  it("follows the setting instead of a day", () => {
    const start = Date.now();
    const at = (hours: number) => () => new Date(start + hours * 3_600_000);
    const holder = new Project({ root, session: { id: "old", pid: 4242 }, isAlive: () => true, now: at(0) });
    holder.addGoal("Login", [{ title: "Route" }]);
    holder.claimGoal("login");
    const reader = (hours: number, idleHours: number) =>
      new Project({ root, session: { id: "new", pid: 5555 }, isAlive: () => true, now: at(hours), claims: () => ({ idleHours }) });
    const r1 = reader(3, 2);
    expect(r1.heldElsewhere(r1.roadmap().goal("login")!)).toBe(false);
    const r2 = reader(3, 48);
    expect(r2.heldElsewhere(r2.roadmap().goal("login")!)).toBe(true);
  });
});
