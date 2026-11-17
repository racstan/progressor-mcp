// Steps for other people: a step can wait on a named person other than the Developer (a team member, a
// lawyer, a payments provider), with what they need to do. People are kept in .progressor/people.md,
// added by the AI as they come up; nothing needs setting up.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { formatPeople, parsePeople } from "../src/people.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let p: Project;
const NOW = new Date("2026-11-17T10:00:00Z");

beforeEach(() => {
  root = tempDir("progressor-people-");
  p = new Project({ root, session: { id: "s", pid: process.pid }, now: () => NOW });
  p.addGoal("Payments", [{ title: "Sign the contract" }, { title: "Wire the API" }]);
  p.claimGoal("payments");
});

describe("the people file", () => {
  it("reads and writes each person with a role", () => {
    const text = "# People\n\n- Priya: payments lawyer ^p1\n- Stripe support ^p2\n";
    const people = parsePeople(text);
    expect(people).toEqual([
      { id: "p1", name: "Priya", role: "payments lawyer" },
      { id: "p2", name: "Stripe support" },
    ]);
    expect(formatPeople(people)).toBe(text);
  });
});

describe("a step waiting on someone", () => {
  it("records who and what they need to do, and adds the person the first time", () => {
    const t = p.setTaskState("t1", "waiting on someone", "payments", { person: "Priya", need: "Sign and send back the contract" });
    expect(t).toMatchObject({ status: "waiting on someone", waitingFor: "Priya", need: "Sign and send back the contract" });
    expect(p.people()).toEqual([{ id: "p1", name: "Priya" }]);
    const text = readFileSync(join(root, ".progressor", "goals", "payments.md"), "utf8");
    expect(text).toContain("state: waiting on someone");
    expect(text).toContain("waiting for: Priya");
    expect(parsePlanFile(text, "payments").task("t1")).toMatchObject({ status: "waiting on someone", waitingFor: "Priya" });
  });

  it("matches a person already known, whatever the case, and keeps one entry", () => {
    p.addPerson("Priya", "payments lawyer");
    p.setTaskState("t1", "waiting on someone", "payments", { person: "priya" });
    expect(p.people()).toEqual([{ id: "p1", name: "Priya", role: "payments lawyer" }]);
    expect(p.plan("payments").task("t1")!.waitingFor).toBe("Priya");
  });

  it("needs a person, and forgets who once the step moves on", () => {
    expect(() => p.setTaskState("t1", "waiting on someone", "payments")).toThrow(/who/);
    p.setTaskState("t1", "waiting on someone", "payments", { person: "Priya", need: "Sign" });
    const t = p.setTaskState("t1", "in progress", "payments");
    expect(t.waitingFor).toBeUndefined();
    expect(t.need).toBeUndefined();
  });

  it("is not waiting on the Developer: the goal does not need them", () => {
    p.setTaskState("t1", "waiting on someone", "payments", { person: "Priya" });
    const s = p.sessionStatus().held[0]!;
    expect(s.waitingOnYou).toEqual([]);
    expect(s.waitingOnOthers.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("through the tools", () => {
  it("set_task_state takes person, need and their role", async () => {
    const server = createServer(p, { registryFile: join(tempDir("progressor-reg-"), "registry.json"), settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    const call = async (name: string, args: Record<string, unknown>) =>
      ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
    expect(await call("set_task_state", { task: "t1", state: "waiting on someone", person: "Priya", need: "Sign the contract" })).toMatch(/waiting on Priya: Sign the contract/);
    expect(await call("set_task_state", { task: "t1", state: "waiting on someone", person: "Priya", role: "payments lawyer" })).toMatch(/Priya \(p1\) is now: payments lawyer\./);
    expect(await call("set_task_state", { task: "t2", state: "in progress", person: "Priya" })).toMatch(/person and need go only with 'waiting on someone'/);
  });
});
