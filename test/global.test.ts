import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import {
  addGlobalRule,
  globalFileFor,
  globalStatusLines,
  readGlobal,
  setGlobalContext,
  updateGlobalRule,
} from "../src/globalRules.js";
import { sessionStatus } from "../src/hooks.js";
import { MAX_CONTEXT_LENGTH, Project } from "../src/project.js";
import { createServer, formatRules } from "../src/server.js";
import { tempDir } from "./tmp.js";

let registry: string;
let file: string;

beforeEach(() => {
  registry = join(tempDir("progressor-global-"), "projects.json");
  file = globalFileFor(registry);
});

describe("the rules and context for every project", () => {
  it("live in global.json beside the project list", () => {
    expect(file).toBe(join(registry, "..", "global.json"));
    expect(readGlobal(file)).toEqual({ rules: [], context: "" });
  });

  it("adds rules with IDs g1, g2..., rewords them, marks them hard and removes them", () => {
    const a = addGlobalRule(file, "  Answer in   British English ");
    const b = addGlobalRule(file, "Never push without asking", true);
    expect(a).toEqual({ id: "g1", text: "Answer in British English", hard: false });
    expect(b).toEqual({ id: "g2", text: "Never push without asking", hard: true });
    expect(updateGlobalRule(file, "g1", { text: "Answer in plain English" })).toEqual({ id: "g1", text: "Answer in plain English", hard: false });
    expect(updateGlobalRule(file, "G1", { hard: true })!.hard).toBe(true);
    expect(updateGlobalRule(file, "g2", { text: "" })).toBeUndefined();
    expect(readGlobal(file).rules).toEqual([{ id: "g1", text: "Answer in plain English", hard: true }]);
    // a removed ID is not given out again while a higher one exists
    addGlobalRule(file, "Third");
    expect(addGlobalRule(file, "Fourth").id).toBe("g3");
    expect(JSON.parse(readFileSync(file, "utf8")).rules).toHaveLength(3);
  });

  it("refuses an empty rule and an unknown ID", () => {
    expect(() => addGlobalRule(file, "   ")).toThrow(/Write the rule/);
    expect(() => updateGlobalRule(file, "g9", { text: "x" })).toThrow(/^No rule g9/);
    expect(existsSync(file)).toBe(false);
  });

  it("keeps one context text, cleared by an empty one, within the length limit", () => {
    expect(setGlobalContext(file, "  I work on Windows.\n\nMy projects use pnpm. ")).toBe("I work on Windows.\n\nMy projects use pnpm.");
    expect(readGlobal(file).context).toBe("I work on Windows.\n\nMy projects use pnpm.");
    expect(() => setGlobalContext(file, "x".repeat(MAX_CONTEXT_LENGTH + 1))).toThrow(/too long/);
    expect(setGlobalContext(file, "")).toBe("");
    expect(readGlobal(file).context).toBe("");
  });

  it("reads a broken or hand-edited file safely", () => {
    writeFileSync(file, "{ not json");
    expect(readGlobal(file)).toEqual({ rules: [], context: "" });
    writeFileSync(file, JSON.stringify({ rules: [{ id: "g1", text: "ok", hard: true }, { id: "x", text: "bad id" }, { id: "g2", text: " " }, "junk"], context: 5 }));
    expect(readGlobal(file)).toEqual({ rules: [{ id: "g1", text: "ok", hard: true }], context: "" });
  });

  it("lists hard rules first, labelled as for every project", () => {
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never delete my notes", true);
    setGlobalContext(file, "I am not a programmer.");
    expect(globalStatusLines(readGlobal(file))).toEqual([
      "Rules for every project (the Developer's, they apply in all their projects; a HARD RULE must never be broken):",
      "- HARD RULE g2: Never delete my notes",
      "- g1 Prefer small commits",
      "Context for every project:",
      "I am not a programmer.",
    ]);
    expect(globalStatusLines({ rules: [], context: "" })).toEqual([]);
  });
});

describe("what the AI is given", () => {
  let client: Client;
  let project: Project;

  beforeEach(async () => {
    project = new Project({ root: tempDir("progressor-"), session: { id: "s-a", pid: process.pid } });
    const server = createServer(project, { registryFile: registry });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError ?? false };
  }

  it("get_status shows the rules and context for every project before the project's own", async () => {
    project.addStandingInstruction("Write tests first");
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never push without asking", true);
    setGlobalContext(file, "I use Windows.");
    const text = (await call("get_status")).text;
    const at = (s: string) => text.indexOf(s);
    expect(at("Rules for every project")).toBeGreaterThan(-1);
    expect(at("- HARD RULE g2: Never push without asking")).toBeLessThan(at("- g1 Prefer small commits"));
    expect(at("Context for every project:\nI use Windows.")).toBeGreaterThan(at("- g1 Prefer small commits"));
    expect(at("Standing Instructions:\n- s1 Write tests first")).toBeGreaterThan(at("I use Windows."));
  });

  it("get_status says nothing of them when there are none", async () => {
    expect((await call("get_status")).text).not.toContain("every project");
  });

  it("get_rules puts them in the helper's brief, hard ones first", async () => {
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never push without asking", true);
    setGlobalContext(file, "I use Windows.");
    expect((await call("get_rules")).text).toBe(
      [
        "Rules from the Developer for every project (they apply in all their projects):",
        "- HARD RULE, never break it: Never push without asking",
        "- Prefer small commits",
        "Context for every project:",
        "I use Windows.",
        "This project has no rules of its own.",
        "Do not edit anything in .progressor/; the Agent that briefed you keeps the plan there.",
      ].join("\n"),
    );
    project.addStandingInstruction("Write tests first");
    const both = (await call("get_rules")).text;
    expect(both.indexOf("Prefer small commits")).toBeLessThan(both.indexOf("Project rules from the Developer."));
    expect(both).toContain("- Write tests first");
  });

  it("formatRules without global rules is as before", () => {
    expect(formatRules([])).toMatch(/^No Standing Instructions/);
    expect(formatRules([], { rules: [], context: "" })).toMatch(/^No Standing Instructions/);
  });

  it("add_standing_instruction with global: true saves a rule for every project, not in this one", async () => {
    const res = await call("add_standing_instruction", { text: "Answer in plain English", hard: true, global: true });
    expect(res.isError).toBe(false);
    expect(res.text).toMatch(/^Saved HARD RULE g1 for every project: Answer in plain English/);
    expect(readGlobal(file).rules).toEqual([{ id: "g1", text: "Answer in plain English", hard: true }]);
    expect(project.roadmap().standingInstructions).toEqual([]);
    expect((await call("add_standing_instruction", { text: "x", global: true, helpers_at_once: 2 })).isError).toBe(true);
  });

  it("update_standing_instruction with global: true rewords and removes one", async () => {
    addGlobalRule(file, "Answer in English");
    expect((await call("update_standing_instruction", { id: "g1", text: "Answer in plain English", global: true })).text).toBe(
      "Changed rule g1 for every project: Answer in plain English",
    );
    expect((await call("update_standing_instruction", { id: "g1", hard: true })).text).toBe("Changed HARD RULE g1 for every project: Answer in plain English");
    expect((await call("update_standing_instruction", { id: "g1", text: "", global: true })).text).toBe("Removed rule g1 for every project.");
    expect(readGlobal(file).rules).toEqual([]);
    expect((await call("update_standing_instruction", { id: "g4", text: "x", global: true })).isError).toBe(true);
  });

  it("project rules are unchanged without global", async () => {
    await call("add_standing_instruction", { text: "Write tests first" });
    expect(project.roadmap().standingInstructions.map((s) => s.id)).toEqual(["s1"]);
    expect(readGlobal(file).rules).toEqual([]);
  });

  it("update_context with global: true replaces the context for every project", async () => {
    expect((await call("update_context", { text: "I use Windows.", global: true })).text).toMatch(/^Saved the context for every project/);
    expect(readGlobal(file).context).toBe("I use Windows.");
    expect(project.context()).toBe("");
  });

  it("the session start hook shows them too", () => {
    project.addGoal("Login");
    const text = sessionStatus(project.overview(), { rules: [{ id: "g1", text: "Be brief", hard: false }, { id: "g2", text: "Never push", hard: true }], context: "On Windows." })!;
    expect(text).toContain("Rules for every project: HARD RULE g2: Never push; g1 Be brief");
    expect(text).toContain("Context for every project:\nOn Windows.");
  });
});

describe("the rules and context for every project on the dashboard", () => {
  let d: Dashboard;
  let events: string[];
  let stream: AbortController;

  beforeEach(async () => {
    const project = new Project({ root: tempDir("progressor-"), session: { id: "s-a", pid: process.pid } });
    d = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    events = [];
    stream = new AbortController();
    const res = await fetch(new URL("/api/events", d.url), { signal: stream.signal });
    void (async () => {
      const reader = res.body!.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          events.push(new TextDecoder().decode(value));
        }
      } catch {
        // stopped
      }
    })();
  });
  afterEach(async () => {
    stream.abort();
    await d.close();
  });

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(new URL(`/api/global/${path}`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "global", "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  it("adds, rewords, marks and removes a rule, and edits the context", async () => {
    expect(await (await fetch(new URL("/api/global", d.url))).json()).toEqual({ rules: [], context: "" });
    const added = await post("rules", { text: "Never push without asking", hard: true });
    expect(added.status).toBe(201);
    expect(await added.json()).toEqual({ id: "g1", text: "Never push without asking", hard: true });
    expect((await post("rules/g1", { text: "Ask before pushing" })).status).toBe(200);
    expect((await post("rules/g1", { hard: false })).status).toBe(200);
    expect(readGlobal(file).rules).toEqual([{ id: "g1", text: "Ask before pushing", hard: false }]);
    expect((await post("context", { text: "I use Windows." })).status).toBe(200);
    expect((await post("rules/g1/delete", {})).status).toBe(200);
    expect(await (await fetch(new URL("/api/global", d.url))).json()).toEqual({ rules: [], context: "I use Windows." });
    await new Promise((r) => setTimeout(r, 50));
    expect(events.join("")).toContain("event: global");
  });

  it("refuses requests from other pages and bad input", async () => {
    expect((await post("rules", { text: "x" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("rules", { text: "x" }, { "x-progressor": "notes" })).status).toBe(403);
    expect((await post("rules", { text: "  " })).status).toBe(400);
    expect((await post("rules", { text: "x", hard: "yes" })).status).toBe(400);
    expect((await post("rules/g7", { text: "x" })).status).toBe(404);
    expect((await post("rules/g7/delete", {})).status).toBe(404);
    expect((await post("context", { text: "x".repeat(MAX_CONTEXT_LENGTH + 1) })).status).toBe(400);
    expect(readGlobal(file)).toEqual({ rules: [], context: "" });
  });

  it("tells open pages when an AI changed them", async () => {
    await fetch(new URL("/api/projects", d.url)); // the hub has looked once
    addGlobalRule(file, "Be brief");
    await fetch(new URL("/api/projects", d.url));
    await new Promise((r) => setTimeout(r, 50));
    expect(events.join("")).toContain("event: global");
  });
});
