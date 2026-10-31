import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { parsePlanFile } from "../src/planFile.js";
import { MAX_CONTEXT_LENGTH, PROJECT_TALK, Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
let agent: Project;
let d: Dashboard;
let id: string;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(new URL(`/api/projects/${id}/${path}`, d.url), {
    method: "POST",
    headers: { origin: new URL(d.url).origin, "x-progressor": "notes", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
/** What the AI is told: the messages to the whole project. */
const told = () => {
  try {
    return parsePlanFile(readFileSync(join(root, ".progressor/talk/_project.md"), "utf8"), PROJECT_TALK).messages.map((m) => m.text);
  } catch {
    return [];
  }
};

beforeEach(async () => {
  root = tempDir("progressor-notes-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid } });
  agent.addStandingInstruction("Write tests first");
  const registry = join(tempDir("progressor-registry-"), "projects.json");
  d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
  id = projectEntry(root).id;
});
afterEach(async () => {
  await d.close();
});

describe("editing the project notes on the dashboard", () => {
  it("adds a rule, a must-never-break one too, and tells the AI", async () => {
    const res = await post("rules", { text: "Never push without asking", hard: true });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "s2", text: "Never push without asking", hard: true });
    expect(agent.roadmap().standingInstructions.map((s) => [s.id, s.hard])).toEqual([["s1", false], ["s2", true]]);
    expect(told()).toEqual(['On the dashboard I added a rule that must never be broken, s2: "Never push without asking". Follow it from now on.']);
  });

  it("rewords a rule or changes whether it must never be broken, and tells the AI", async () => {
    const res = await post("rules/s1", { text: "Write tests before code", hard: true });
    expect(res.status).toBe(200);
    expect(agent.roadmap().standingInstructions[0]).toMatchObject({ id: "s1", text: "Write tests before code", hard: true });
    expect((await post("rules/s1", { hard: false })).status).toBe(200);
    expect(agent.roadmap().standingInstructions[0]!.hard).toBe(false);
    expect(told()).toEqual([
      'On the dashboard I changed rule s1 to: "Write tests before code" (it must never be broken). Follow it from now on.',
      'On the dashboard I changed rule s1 to: "Write tests before code". Follow it from now on.',
    ]);
  });

  it("removes a rule and tells the AI", async () => {
    expect((await post("rules/s1/delete", {})).status).toBe(200);
    expect(agent.roadmap().standingInstructions).toEqual([]);
    expect(told()).toEqual(['On the dashboard I removed rule s1: "Write tests first". Stop following it.']);
  });

  it("replaces the About this project text and tells the AI", async () => {
    const res = await post("context", { text: "A shop for socks.\n\n- Runs on Linux" });
    expect(res.status).toBe(200);
    expect(agent.context()).toBe("A shop for socks.\n\n- Runs on Linux");
    expect(told()).toEqual(["On the dashboard I changed the Important context. Read it again with get_rules before your next step."]);
    expect((await post("context", { text: "" })).status).toBe(200);
    expect(agent.context()).toBe("");
  });

  it("refuses other pages, wrong headers, empty rules, missing ones and text that is too long", async () => {
    expect((await post("rules", { text: "x" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("rules", { text: "x" }, { "x-progressor": "talk" })).status).toBe(403);
    expect((await post("rules", { text: "x" }, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post("rules", "{nope")).status).toBe(400);
    expect((await post("rules", { text: "  " })).status).toBe(400);
    expect((await post("rules", { text: "x", hard: "yes" })).status).toBe(400);
    expect((await post("rules/s1", {})).status).toBe(400);
    expect((await post("rules/s1", { text: " " })).status).toBe(400);
    expect((await post("rules/s9", { text: "x" })).status).toBe(404);
    expect((await post("rules/s9/delete", {})).status).toBe(404);
    expect((await post("context", { text: 5 })).status).toBe(400);
    expect((await post("context", { text: "x".repeat(MAX_CONTEXT_LENGTH + 1) })).status).toBe(400);
    expect(agent.roadmap().standingInstructions.map((s) => s.text)).toEqual(["Write tests first"]);
    expect(told()).toEqual([]);
  });
});

describe("editing the wishlist on the dashboard", () => {
  it("adds a wish and tells the AI it may suggest a goal", async () => {
    const res = await post("wishes", { text: "Dark mode on phones" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "w1", text: "Dark mode on phones", granted: false });
    expect(agent.wishes().map((w) => w.text)).toEqual(["Dark mode on phones"]);
    expect(told()).toEqual(['On the dashboard I added wish w1 to the wishlist: "Dark mode on phones". You may suggest a goal for it; don\'t change the wishlist yourself.']);
  });

  it("rewords a wish, ticks it off and back, and tells the AI", async () => {
    agent.addWish("Dark mode");
    expect((await post("wishes/w1", { text: "Dark mode on phones" })).status).toBe(200);
    expect((await post("wishes/w1", { granted: true })).status).toBe(200);
    expect(agent.wishes()[0]).toEqual({ id: "w1", text: "Dark mode on phones", granted: true });
    expect((await post("wishes/w1", { granted: false })).status).toBe(200);
    expect(told()).toEqual([
      'On the dashboard I changed wish w1 to: "Dark mode on phones".',
      'On the dashboard I ticked off wish w1, "Dark mode on phones": I have what I wished for.',
      'On the dashboard I put wish w1, "Dark mode on phones", back on the wishlist: I still want it.',
    ]);
  });

  it("removes a wish and tells the AI", async () => {
    agent.addWish("Export to PDF");
    expect((await post("wishes/w1/delete", {})).status).toBe(200);
    expect(agent.wishes()).toEqual([]);
    expect(told()).toEqual(['On the dashboard I removed wish w1 from the wishlist: "Export to PDF". I don\'t want it any more.']);
  });

  it("shows the wishlist with the project", async () => {
    agent.addWish("Export to PDF");
    const res = await fetch(new URL(`/api/projects/${id}/roadmap`, d.url));
    expect((await res.json()).wishes).toEqual([{ id: "w1", text: "Export to PDF", granted: false }]);
  });

  it("refuses other pages, empty or bad wishes and missing ones", async () => {
    agent.addWish("One");
    expect((await post("wishes", { text: "x" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("wishes", { text: "  " })).status).toBe(400);
    expect((await post("wishes/w1", {})).status).toBe(400);
    expect((await post("wishes/w1", { granted: "yes" })).status).toBe(400);
    expect((await post("wishes/w1", { text: " " })).status).toBe(400);
    expect((await post("wishes/w9", { granted: true })).status).toBe(404);
    expect((await post("wishes/w9/delete", {})).status).toBe(404);
    expect(agent.wishes()).toEqual([{ id: "w1", text: "One", granted: false }]);
    expect(told()).toEqual([]);
  });
});
