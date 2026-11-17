// Replies that don't repeat the same blocks: the rules, Important context and wishlist are sent in full
// by get_status, and once per chat by the tools that end with a status (add_goal, claim_goal); a rule
// for everything that a project rule repeats word for word is listed once.
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { addGlobalRule, globalFileFor, readGlobal } from "../src/globalRules.js";
import { sessionStatus } from "../src/hooks.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let registry: string;

beforeEach(() => {
  root = tempDir("progressor-quiet-");
  registry = join(tempDir("progressor-reg-"), "registry.json");
});

async function connect() {
  const p = new Project({ root, session: { id: "s", pid: process.pid } });
  p.addGoal("Login", [{ title: "Route" }]);
  p.addGoal("Billing", [{ title: "Checkout" }]);
  p.addStandingInstruction("Write tests first");
  p.setContext("A web app in TypeScript.");
  const server = createServer(p, { registryFile: registry, settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "t", version: "1" });
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[] };
    return r.content.map((c) => c.text).join("\n");
  };
}

const UNCHANGED = /Standing Instructions, Important context and wishlist: unchanged since this chat last saw them/;

describe("replies that don't repeat the same blocks", () => {
  it("claim_goal and add_goal leave out rules and context this chat has already been sent", async () => {
    const call = await connect();
    const first = await call("claim_goal", { goal: "login" });
    expect(first).toContain("- s1 Write tests first");
    expect(first).toContain("A web app in TypeScript.");
    const second = await call("claim_goal", { goal: "billing" });
    expect(second).not.toContain("Write tests first");
    expect(second).not.toContain("A web app in TypeScript.");
    expect(second).toMatch(UNCHANGED);
    const added = await call("add_goal", { title: "Search", tasks: [{ title: "Index" }], claim: true });
    expect(added).toMatch(UNCHANGED);
  });

  it("get_status always sends them in full, since it is called after the chat's memory is compressed", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    const status = await call("get_status");
    expect(status).toContain("- s1 Write tests first");
    expect(status).toContain("A web app in TypeScript.");
  });

  it("sends them again in full when they change", async () => {
    const call = await connect();
    await call("claim_goal", { goal: "login" });
    await call("add_standing_instruction", { text: "Use British English" });
    const after = await call("claim_goal", { goal: "billing" });
    expect(after).toContain("Use British English");
    expect(after).toContain("- s1 Write tests first");
  });

  it("lists a rule for everything once when a project rule says the same", async () => {
    addGlobalRule(globalFileFor(registry), "Only one helper at a time", true);
    const call = await connect();
    await call("add_standing_instruction", { text: "only one helper at a time.", hard: true });
    const status = await call("get_status");
    expect(status.match(/one helper at a time/gi)).toHaveLength(1);
  });

  it("does the same in the message a chat starts with", async () => {
    addGlobalRule(globalFileFor(registry), "Only one helper at a time", true);
    const p = new Project({ root, session: { id: "s", pid: process.pid } });
    p.addGoal("Login", [{ title: "Route" }]);
    p.addStandingInstruction("Only one helper at a time!", true);
    p.addStandingInstruction("Write tests first");
    const text = sessionStatus(p.overview(), readGlobal(globalFileFor(registry))) ?? "";
    expect(text.match(/one helper at a time/gi)).toHaveLength(1);
    expect(text).toContain("Write tests first");
  });
});
