import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import {
  INSTRUCTION_CONTEXT,
  INSTRUCTION_RULES,
  addGlobalRule,
  globalFileFor,
  globalStatusLines,
  readGlobal,
  setGlobalContext,
  updateGlobalRule,
} from "../src/globalRules.js";
import { sessionStatus } from "../src/hooks.js";
import { MAX_CONTEXT_LENGTH, Project } from "../src/project.js";
import { INSTRUCTIONS, createServer, formatRules, serverInstructions } from "../src/server.js";
import { tempDir } from "./tmp.js";

let registry: string;
let file: string;

beforeEach(() => {
  registry = join(tempDir("progressor-global-"), "projects.json");
  file = globalFileFor(registry);
});

describe("the rules and context for everything", () => {
  it("live in global.json beside the project list", () => {
    expect(file).toBe(join(registry, "..", "global.json"));
    expect(readGlobal(file)).toEqual({ rules: [], computer: "", me: "" });
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

  it("keeps two context texts, about this computer and about me, each cleared by an empty one, within the length limit", () => {
    expect(setGlobalContext(file, "computer", "  Windows 11. CI runs on the local Gitea. ")).toBe("Windows 11. CI runs on the local Gitea.");
    expect(setGlobalContext(file, "me", "Explain in plain words.")).toBe("Explain in plain words.");
    expect(readGlobal(file)).toEqual({ rules: [], computer: "Windows 11. CI runs on the local Gitea.", me: "Explain in plain words." });
    expect(() => setGlobalContext(file, "me", "x".repeat(MAX_CONTEXT_LENGTH + 1))).toThrow(/too long/);
    expect(() => setGlobalContext(file, "other" as "me", "x")).toThrow(/Say which part/);
    expect(setGlobalContext(file, "computer", "")).toBe("");
    expect(readGlobal(file).computer).toBe("");
    expect(readGlobal(file).me).toBe("Explain in plain words.");
  });

  it("reads a broken or hand-edited file safely", () => {
    writeFileSync(file, "{ not json");
    expect(readGlobal(file)).toEqual({ rules: [], computer: "", me: "" });
    writeFileSync(file, JSON.stringify({ rules: [{ id: "g1", text: "ok", hard: true }, { id: "x", text: "bad id" }, { id: "g2", text: " " }, "junk"], computer: 5, me: " hi " }));
    expect(readGlobal(file)).toEqual({ rules: [{ id: "g1", text: "ok", hard: true }], computer: "", me: "hi" });
  });

  it("lists hard rules first, labelled as for everything", () => {
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never delete my notes", true);
    setGlobalContext(file, "computer", "Windows 11.");
    setGlobalContext(file, "me", "I am not a programmer.");
    expect(globalStatusLines(readGlobal(file))).toEqual([
      "Rules for everything (the Developer's: they apply in every project and anywhere you use Progressor on this computer; a HARD RULE must never be broken):",
      "- HARD RULE g2: Never delete my notes",
      "- g1 Prefer small commits",
      "About this computer (for everything):",
      "Windows 11.",
      "About me and how I work (for everything):",
      "I am not a programmer.",
    ]);
    expect(globalStatusLines({ rules: [], computer: "", me: "" })).toEqual([]);
  });

  it("go into the server's instructions: every hard rule, the others up to a limit, and the context cut short", () => {
    expect(serverInstructions({ rules: [], computer: "", me: "" })).toBe(INSTRUCTIONS);
    for (let i = 1; i <= INSTRUCTION_RULES + 3; i++) addGlobalRule(file, `Preference ${i}`);
    addGlobalRule(file, "Never push", true);
    addGlobalRule(file, "Never delete notes", true);
    setGlobalContext(file, "computer", "x".repeat(INSTRUCTION_CONTEXT + 50));
    setGlobalContext(file, "me", "Plain words.");
    const text = serverInstructions(readGlobal(file));
    expect(text.startsWith(`${INSTRUCTIONS}\n\nRules for everything`)).toBe(true);
    expect(text).toContain("- HARD RULE g14: Never push\n- HARD RULE g15: Never delete notes\n- g1 Preference 1");
    expect(text).toContain("- g10 Preference 10\n- and 3 more; get_rules lists them all.");
    expect(text).not.toContain("Preference 11");
    expect(text).toContain(`About this computer (for everything):\n${"x".repeat(INSTRUCTION_CONTEXT)}… (get_rules has all of it)`);
    expect(text).toContain("About me and how I work (for everything):\nPlain words.");
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

  it("get_status shows the rules and context for everything before the project's own", async () => {
    project.addStandingInstruction("Write tests first");
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never push without asking", true);
    setGlobalContext(file, "computer", "I use Windows.");
    const text = (await call("get_status")).text;
    const at = (s: string) => text.indexOf(s);
    expect(at("Rules for everything")).toBeGreaterThan(-1);
    expect(at("- HARD RULE g2: Never push without asking")).toBeLessThan(at("- g1 Prefer small commits"));
    expect(at("About this computer (for everything):\nI use Windows.")).toBeGreaterThan(at("- g1 Prefer small commits"));
    expect(at("Standing Instructions:\n- s1 Write tests first")).toBeGreaterThan(at("I use Windows."));
  });

  it("get_status says nothing of them when there are none", async () => {
    expect((await call("get_status")).text).not.toContain("for everything");
  });

  it("get_status and get_rules show them in a folder with no plan yet, without making one", async () => {
    addGlobalRule(file, "Never push without asking", true);
    expect(existsSync(join(project.root, ".progressor"))).toBe(false);
    expect((await call("get_status")).text).toContain("- HARD RULE g1: Never push without asking");
    expect((await call("get_rules")).text).toContain("- HARD RULE, never break it: Never push without asking");
  });

  it("are in the instructions the app gets when it connects", async () => {
    addGlobalRule(file, "Never push without asking", true);
    const server = createServer(project, { registryFile: registry });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const other = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), other.connect(clientSide)]);
    expect(other.getInstructions()).toContain("- HARD RULE g1: Never push without asking");
  });

  it("get_rules puts them in the helper's brief, hard ones first", async () => {
    addGlobalRule(file, "Prefer small commits");
    addGlobalRule(file, "Never push without asking", true);
    setGlobalContext(file, "me", "I use Windows.");
    expect((await call("get_rules")).text).toBe(
      [
        "Rules from the Developer for everything (they apply in every project and anywhere Progressor is used on this computer):",
        "- HARD RULE, never break it: Never push without asking",
        "- Prefer small commits",
        "About me and how I work (for everything):",
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
    expect(formatRules([], { rules: [], computer: "", me: "" })).toMatch(/^No Standing Instructions/);
  });

  it("add_standing_instruction with global: true saves a rule for everything, not in this one", async () => {
    const res = await call("add_standing_instruction", { text: "Answer in plain English", hard: true, global: true });
    expect(res.isError).toBe(false);
    expect(res.text).toMatch(/^Saved HARD RULE g1 for everything: Answer in plain English/);
    expect(readGlobal(file).rules).toEqual([{ id: "g1", text: "Answer in plain English", hard: true }]);
    expect(project.roadmap().standingInstructions).toEqual([]);
    expect((await call("add_standing_instruction", { text: "x", global: true, helpers_at_once: 2 })).isError).toBe(true);
  });

  it("update_standing_instruction with global: true rewords and removes one", async () => {
    addGlobalRule(file, "Answer in English");
    expect((await call("update_standing_instruction", { id: "g1", text: "Answer in plain English", global: true })).text).toBe(
      "Changed rule g1 for everything: Answer in plain English",
    );
    expect((await call("update_standing_instruction", { id: "g1", hard: true })).text).toBe("Changed HARD RULE g1 for everything: Answer in plain English");
    expect((await call("update_standing_instruction", { id: "g1", text: "", global: true })).text).toBe("Removed rule g1 for everything.");
    expect(readGlobal(file).rules).toEqual([]);
    expect((await call("update_standing_instruction", { id: "g4", text: "x", global: true })).isError).toBe(true);
  });

  it("project rules are unchanged without global", async () => {
    await call("add_standing_instruction", { text: "Write tests first" });
    expect(project.roadmap().standingInstructions.map((s) => s.id)).toEqual(["s1"]);
    expect(readGlobal(file).rules).toEqual([]);
  });

  it("update_context with global: true replaces one part of the context for everything", async () => {
    expect((await call("update_context", { text: "I use Windows.", global: true, part: "computer" })).text).toMatch(/^Saved "About this computer" for everything/);
    expect((await call("update_context", { text: "Plain words.", global: true, part: "me" })).text).toMatch(/^Saved "About me and how I work" for everything/);
    expect(readGlobal(file)).toMatchObject({ computer: "I use Windows.", me: "Plain words." });
    expect(project.context()).toBe("");
    expect((await call("update_context", { text: "x", global: true })).isError).toBe(true);
    expect((await call("update_context", { text: "", global: true, part: "me" })).text).toBe('Cleared "About me and how I work" for everything.');
  });

  it("the session start hook shows them too", () => {
    project.addGoal("Login");
    const text = sessionStatus(project.overview(), { rules: [{ id: "g1", text: "Be brief", hard: false }, { id: "g2", text: "Never push", hard: true }], computer: "On Windows.", me: "" })!;
    expect(text).toContain("Rules for everything: HARD RULE g2: Never push; g1 Be brief");
    expect(text).toContain("About this computer (for everything):\nOn Windows.");
  });
});

describe("the rules and context for everything on the dashboard", () => {
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
    expect(await (await fetch(new URL("/api/global", d.url))).json()).toEqual({ rules: [], computer: "", me: "" });
    const added = await post("rules", { text: "Never push without asking", hard: true });
    expect(added.status).toBe(201);
    expect(await added.json()).toEqual({ id: "g1", text: "Never push without asking", hard: true });
    expect((await post("rules/g1", { text: "Ask before pushing" })).status).toBe(200);
    expect((await post("rules/g1", { hard: false })).status).toBe(200);
    expect(readGlobal(file).rules).toEqual([{ id: "g1", text: "Ask before pushing", hard: false }]);
    expect((await post("context", { part: "computer", text: "I use Windows." })).status).toBe(200);
    expect((await post("context", { part: "me", text: "Plain words." })).status).toBe(200);
    expect((await post("rules/g1/delete", {})).status).toBe(200);
    expect(await (await fetch(new URL("/api/global", d.url))).json()).toEqual({ rules: [], computer: "I use Windows.", me: "Plain words." });
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
    expect((await post("context", { part: "me", text: "x".repeat(MAX_CONTEXT_LENGTH + 1) })).status).toBe(400);
    expect((await post("context", { text: "no part" })).status).toBe(400);
    expect(readGlobal(file)).toEqual({ rules: [], computer: "", me: "" });
  });

  it("tells open pages when an AI changed them", async () => {
    await fetch(new URL("/api/projects", d.url)); // the hub has looked once
    addGlobalRule(file, "Be brief");
    await fetch(new URL("/api/projects", d.url));
    await new Promise((r) => setTimeout(r, 50));
    expect(events.join("")).toContain("event: global");
  });
});
