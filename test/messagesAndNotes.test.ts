import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { parsePlanFile } from "../src/planFile.js";
import { PROJECT_TALK, Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
let agent: Project;
let d: Dashboard;
let id: string;

const post = (path: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  fetch(new URL(`/api/projects/${id}/${path}`, d.url), {
    method: "POST",
    headers: { origin: new URL(d.url).origin, "x-progressor": /^goals\/[^/]+\/(messages|questions|clear)/.test(path) ? "talk" : "notes", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const goalPost = (path: string, body: unknown = {}, headers: Record<string, string> = {}) => post(`goals/login/${path}`, body, headers);
/** What the AI is told on a goal (or the whole project). */
const told = (goal = "login") => {
  try {
    return parsePlanFile(readFileSync(join(root, `.progressor/talk/${goal}.md`), "utf8"), goal).messages.map((m) => m.text);
  } catch {
    return [];
  }
};
const history = async () => ((await (await fetch(new URL(`/api/projects/${id}/history`, d.url))).json()) as { entries: { label: string }[] }).entries.map((e) => e.label);

beforeEach(async () => {
  root = tempDir("progressor-msgnotes-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid } });
  agent.claimGoal(agent.addGoal("Login", [{ title: "Form" }]).id);
  const registry = join(tempDir("progressor-registry-"), "projects.json");
  d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
  id = projectEntry(root).id;
});
afterEach(async () => {
  await d.close();
});

describe("removing messages on the dashboard", () => {
  it("removes a message the AI has read and answered, with its answer, without telling the AI", async () => {
    const m = agent.sendMessage("login", "Use the blue logo");
    agent.takeNewFromDeveloper("login");
    agent.replyToDeveloper(m.id!, "Done");
    expect((await goalPost("messages/m1/delete")).status).toBe(409); // take back is only for unread ones
    const res = await goalPost(`messages/${m.id}/remove`);
    expect(res.status).toBe(200);
    expect(agent.talk("login").messages).toEqual([]);
  });

  it("removes a message on the whole project's page, and a dashboard notice", async () => {
    agent.sendMessage(PROJECT_TALK, "On the dashboard I added rule s1.");
    const res = await post(`goals/${PROJECT_TALK}/messages/m1/remove`);
    expect(res.status).toBe(200);
    expect(told(PROJECT_TALK)).toEqual([]);
  });

  it("removes an answered question, but not one still waiting for an answer", async () => {
    const q = agent.askDeveloper("Which colour?", ["Blue", "Green"], { goal: "login" });
    const waiting = await goalPost(`questions/${q.id}/remove`);
    expect(waiting.status).toBe(409);
    expect((await waiting.json()).error).toMatch(/still waiting for your answer/);
    expect(agent.talk("login").questions).toHaveLength(1);
    agent.answerQuestion("login", q.id!, "Blue");
    expect((await goalPost(`questions/${q.id}/remove`)).status).toBe(200);
    expect(agent.talk("login").questions).toEqual([]);
    // the answer stays in the plan as a decision
    expect(agent.plan("login").decisions.map((x) => x.text)).toEqual(["Which colour? The Developer answered: Blue"]);
  });

  it("refuses an unknown message and a request from another page", async () => {
    expect((await goalPost("messages/m9/remove")).status).toBe(404);
    agent.sendMessage("login", "Hi");
    expect((await goalPost("messages/m1/remove", {}, { origin: "https://evil.example" })).status).toBe(403);
    expect(agent.talk("login").messages).toHaveLength(1);
  });

  it("Clear all removes finished messages and answered questions, and keeps unread, open and unseen ones", async () => {
    const read = agent.sendMessage("login", "Read one");
    const replied = agent.sendMessage("login", "Replied one");
    agent.takeNewFromDeveloper("login");
    agent.replyToDeveloper(replied.id!, "Ok");
    const seenAnswer = agent.askDeveloper("Seen?", ["Yes", "No"], { goal: "login" });
    agent.answerQuestion("login", seenAnswer.id!, "Yes");
    agent.takeNewFromDeveloper("login"); // the AI is shown the answer
    agent.askDeveloper("Still open?", ["Yes", "No"], { goal: "login" });
    const unseen = agent.askDeveloper("Unseen?", ["Yes", "No"], { goal: "login" });
    agent.answerQuestion("login", unseen.id!, "No");
    agent.sendMessage("login", "Not read yet");
    const res = await goalPost("clear");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 3 });
    const talk = agent.talk("login");
    expect(talk.messages.map((m) => m.text)).toEqual(["Not read yet"]);
    expect(talk.questions.map((q) => q.text)).toEqual(["Still open?", "Unseen?"]);
    expect(read.id).toBeDefined();
  });
});

describe("clearing the project's background", () => {
  it("removes About this project and tells the AI", async () => {
    agent.setContext("A shop for socks.");
    const res = await post("context", { text: "" });
    expect(res.status).toBe(200);
    expect(agent.context()).toBe("");
    expect(told(PROJECT_TALK)).toEqual(["On the dashboard I removed the Important context. Fill it in again with update_context only if I ask."]);
  });
});

describe("editing a goal's notes and decisions on the dashboard", () => {
  it("rewords a note, marks it dealt with and reopens it, telling the AI each time", async () => {
    const n = agent.addNote("login", "The logo is blurry");
    expect((await goalPost(`notes/${n.id}`, { text: "The logo is blurry on phones" })).status).toBe(200);
    expect((await goalPost(`notes/${n.id}`, { resolved: true })).status).toBe(200);
    expect(agent.plan("login").note(n.id!)).toMatchObject({ text: "The logo is blurry on phones", resolved: true });
    expect((await goalPost(`notes/${n.id}`, { resolved: false })).status).toBe(200);
    expect(agent.plan("login").note(n.id!)!.resolved).toBe(false);
    expect(told()).toEqual([
      `On the dashboard I changed note ${n.id} on goal login to: "The logo is blurry on phones".`,
      `On the dashboard I marked note ${n.id} on goal login dealt with: "The logo is blurry on phones".`,
      `On the dashboard I reopened note ${n.id} on goal login: "The logo is blurry on phones". It still needs dealing with.`,
    ]);
    expect(await history()).toEqual(expect.arrayContaining(["Changed a note", "Marked a note dealt with", "Reopened a note"]));
  });

  it("deletes a note, and the change can be undone from history", async () => {
    const n = agent.addNote("login", "The logo is blurry");
    expect((await goalPost(`notes/${n.id}/delete`)).status).toBe(200);
    expect(agent.plan("login").notes).toEqual([]);
    expect(told()).toEqual([`On the dashboard I removed note ${n.id} on goal login: "The logo is blurry".`]);
    const entries = (await (await fetch(new URL(`/api/projects/${id}/history`, d.url))).json()) as { entries: { id: string; label: string }[] };
    const entry = entries.entries.find((e) => e.label === "Removed a note")!;
    const undo = await fetch(new URL(`/api/projects/${id}/history/${entry.id}/restore`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "history", "content-type": "application/json" },
      body: "{}",
    });
    expect(undo.status).toBe(200);
    expect(agent.plan("login").notes.map((x) => x.text)).toEqual(["The logo is blurry"]);
  });

  it("rewords and deletes a decision, telling the AI, with no claim needed", async () => {
    const dec = agent.addDecision("Use OAuth only", "login");
    expect((await goalPost(`decisions/${dec.id}`, { text: "Use OAuth and email" })).status).toBe(200);
    expect(agent.plan("login").decision(dec.id!)!.text).toBe("Use OAuth and email");
    expect((await goalPost(`decisions/${dec.id}/delete`)).status).toBe(200);
    expect(agent.plan("login").decisions).toEqual([]);
    expect(told()).toEqual([
      `On the dashboard I changed decision ${dec.id} on goal login to: "Use OAuth and email". Follow it from now on.`,
      `On the dashboard I removed decision ${dec.id} on goal login: "Use OAuth and email". It no longer holds.`,
    ]);
    expect(await history()).toEqual(expect.arrayContaining(["Changed a decision", "Removed a decision"]));
  });

  it("refuses empty text, unknown items, bad fields and other pages", async () => {
    const n = agent.addNote("login", "A note");
    const dec = agent.addDecision("A decision", "login");
    expect((await goalPost(`notes/${n.id}`, { text: " " })).status).toBe(400);
    expect((await goalPost(`notes/${n.id}`, {})).status).toBe(400);
    expect((await goalPost(`notes/${n.id}`, { resolved: "yes" })).status).toBe(400);
    expect((await goalPost(`decisions/${dec.id}`, { text: "" })).status).toBe(400);
    expect((await goalPost("notes/n9", { text: "x" })).status).toBe(404);
    expect((await goalPost("notes/n9/delete")).status).toBe(404);
    expect((await goalPost("decisions/d9", { text: "x" })).status).toBe(404);
    expect((await goalPost("decisions/d9/delete")).status).toBe(404);
    expect((await goalPost(`notes/${n.id}/delete`, {}, { origin: "https://evil.example" })).status).toBe(403);
    expect((await goalPost(`decisions/${dec.id}/delete`, {}, { "x-progressor": "talk" })).status).toBe(403);
    expect(agent.plan("login").notes).toHaveLength(1);
    expect(agent.plan("login").decisions).toHaveLength(1);
  });
});
