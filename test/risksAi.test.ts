// The AI keeps the risks list current: it is nudged to start one, told about serious risks nothing is
// reducing, and asked to update a goal's risks when the goal is finished. Nothing needs the Developer.
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let p: Project;

beforeEach(() => {
  root = tempDir("progressor-risks-ai-");
  p = new Project({ root, session: { id: "s", pid: process.pid } });
  p.addGoal("Login", [{ title: "Route" }]);
});

async function connect() {
  const server = createServer(p, { registryFile: join(tempDir("progressor-reg-"), "registry.json"), settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "t", version: "1" });
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) =>
    ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
}

const START = /This project has no risks list yet/;
const SERIOUS = /Serious risks nothing is reducing/;

describe("keeping the risks list current", () => {
  it("nudges the AI once per chat to start a risks list, and stops once there is one", async () => {
    const call = await connect();
    expect(await call("get_status")).toMatch(START);
    expect(await call("get_status")).not.toMatch(START);
    p.addRisk({ title: "Slow CI", likelihood: "low", impact: "low" });
    const again = await connect();
    expect(await again("get_status")).not.toMatch(START);
  });

  it("names serious risks nothing is reducing, until a goal is linked to them", async () => {
    p.addRisk({ title: "Token leaks", likelihood: "high", impact: "high" });
    p.addRisk({ title: "Typos", likelihood: "high", impact: "low" });
    const call = await connect();
    const status = await call("get_status");
    expect(status).toMatch(SERIOUS);
    expect(status).toContain("r1 Token leaks");
    expect(status).not.toContain("r2 Typos");
    p.updateRisk("r1", { goals: ["login"] });
    expect(await call("get_status")).not.toMatch(SERIOUS);
  });

  it("asks for the risks linked to a goal to be updated when it is finished", async () => {
    p.addRisk({ title: "Token leaks", likelihood: "high", impact: "high", goals: ["login"] });
    p.addRisk({ title: "Old one", likelihood: "low", impact: "low", goals: ["login"], status: "closed" });
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    await call("complete_task", { task: "t1" });
    const done = await call("complete_goal");
    expect(done).toMatch(/Risk r1 Token leaks is linked to this goal: now that it is finished, mark it reduced or closed with update_risk, or say why it is still open\./);
    expect(done).not.toContain("Old one");
  });
});
