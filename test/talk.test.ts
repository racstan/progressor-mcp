import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { type Dashboard, dashboardApi, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { promptReminder } from "../src/hooks.js";
import { createServer } from "../src/server.js";
import { parsePlanFile } from "../src/planFile.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

const NOW = new Date("2026-10-28T10:00:00.000Z");
let clock = NOW;
let root: string;
let agent: Project;
/** The dashboard: no Session of its own, as in http.ts. */
let page: Project;

beforeEach(() => {
  clock = NOW;
  root = tempDir("progressor-talk-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => clock });
  page = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now: () => clock });
  const goal = agent.addGoal("Dark mode", [{ title: "Add the switch" }, { title: "Pick colours" }]);
  agent.claimGoal(goal.id);
});

const planText = () => readFileSync(join(root, ".progressor/goals/dark-mode.md"), "utf8");
const plan = () => parsePlanFile(planText(), "dark-mode");
/** The goal's talk file: kept out of git, beside the Plan File. */
const talkText = () => readFileSync(join(root, ".progressor/talk/dark-mode.md"), "utf8");
const talk = () => parsePlanFile(talkText(), "dark-mode");
const later = (minutes: number) => (clock = new Date(NOW.getTime() + minutes * 60_000));

describe("where the talk is kept", () => {
  it("is in its own file that git ignores, never in the Plan File", () => {
    page.sendMessage("dark-mode", "My client is Acme");
    agent.askDeveloper("A or B?", ["A", "B"], { task: "t1" });
    expect(planText()).not.toContain("Acme");
    expect(planText()).not.toContain("## Messages");
    expect(planText()).not.toContain("## Questions");
    expect(talkText()).toMatch(/^# Dark mode: talk with the Developer\n/);
    expect(talkText()).toContain("My client is Acme");
    expect(readFileSync(join(root, ".progressor/.gitignore"), "utf8")).toMatch(/^talk\/$/m);
  });

  it("adds talk/ to a .gitignore that is already there, once", () => {
    writeFileSync(join(root, ".progressor/.gitignore"), "scratch/\n");
    page.sendMessage("dark-mode", "one");
    page.sendMessage("dark-mode", "two");
    expect(readFileSync(join(root, ".progressor/.gitignore"), "utf8")).toBe("scratch/\n\n# What you and your AI say on the dashboard stays on this computer\ntalk/\n");
  });

  it("an answer is still kept as a decision in the plan", () => {
    agent.askDeveloper("A or B?", ["A", "B"]);
    page.answerQuestion("dark-mode", "q1", "B");
    expect(plan().decision("c1")!.text).toBe("A or B? The Developer answered: B");
  });
});

describe("messages from the Developer", () => {
  it("are kept as checklist lines in their own section", () => {
    page.sendMessage("dark-mode", "Use the blue logo,\n not the green one");
    expect(talkText()).toContain(["## Messages", "", "- [ ] Use the blue logo, not the green one ^m1", "  - sent: 2026-10-28T10:00:00.000Z", ""].join("\n"));
    expect(talk().messages).toEqual([
      expect.objectContaining({ id: "m1", text: "Use the blue logo, not the green one", state: "new", sentAt: "2026-10-28T10:00:00.000Z", reply: undefined }),
    ]);
  });

  it("can be sent to a Goal nobody holds, but not to a dropped or missing one", () => {
    agent.releaseGoal("dark-mode");
    expect(page.sendMessage("dark-mode", "Hello").id).toBe("m1");
    expect(() => page.sendMessage("nope", "Hello")).toThrow(/No Goal nope/);
    expect(() => page.sendMessage("dark-mode", "   ")).toThrow(/empty/);
  });

  it("are cut to a length a person types in a box", () => {
    expect(page.sendMessage("dark-mode", "x".repeat(5000)).text).toHaveLength(2000);
  });

  it("are marked seen once shown to the Agent, and replied to after", () => {
    page.sendMessage("dark-mode", "Skip the export step");
    later(2);
    expect(agent.takeNewFromDeveloper("dark-mode")).toEqual({
      messages: [expect.objectContaining({ id: "m1", text: "Skip the export step" })],
      answers: [],
    });
    expect(talk().message("m1")).toMatchObject({ state: "seen", seenAt: "2026-10-28T10:02:00.000Z" });
    expect(agent.takeNewFromDeveloper("dark-mode")).toEqual({ messages: [], answers: [] });
    later(5);
    agent.replyToDeveloper("m1", "Dropped it: step t2 is cancelled.");
    expect(talk().message("m1")).toMatchObject({ state: "replied", reply: "Dropped it: step t2 is cancelled.", repliedAt: "2026-10-28T10:05:00.000Z" });
    expect(talkText()).toContain("- [x] Skip the export step ^m1\n  - sent: 2026-10-28T10:00:00.000Z\n  - seen: 2026-10-28T10:02:00.000Z\n  - reply: Dropped it: step t2 is cancelled.\n  - replied: 2026-10-28T10:05:00.000Z");
  });

  it("a reply needs the Goal held and some words", () => {
    page.sendMessage("dark-mode", "Hi");
    expect(() => agent.replyToDeveloper("m1", " ")).toThrow(/reply/i);
    expect(() => agent.replyToDeveloper("m9", "ok")).toThrow(/No message m9/);
    agent.releaseGoal("dark-mode");
    expect(() => agent.replyToDeveloper("m1", "ok")).toThrow();
  });

  it("can be taken back by the Developer only while the Agent has not seen it", () => {
    page.sendMessage("dark-mode", "Oops");
    page.sendMessage("dark-mode", "Keep");
    page.deleteMessage("dark-mode", "m1");
    expect(talk().messages.map((m) => m.id)).toEqual(["m2"]);
    agent.takeNewFromDeveloper("dark-mode");
    expect(() => page.deleteMessage("dark-mode", "m2")).toThrow(/already seen/);
  });

  it("reads a hand-typed section and keeps it as it was", () => {
    const source = "# G\n\n## Tasks\n\n- [ ] A ^t1\n\n## Messages\n\n- [ ] Typed by hand\n- [x] Answered one ^m3\n  - reply: ok\n";
    const p = parsePlanFile(source, "g");
    expect(p.messages.map((m) => [m.id, m.state, m.reply])).toEqual([
      [undefined, "new", undefined],
      ["m3", "replied", "ok"],
    ]);
    expect(p.toString()).toBe(source);
    p.assignMissingIds();
    expect(p.messages.map((m) => m.id)).toEqual(["m4", "m3"]);
  });
});

describe("questions from the Agent", () => {
  it("are asked with two to four choices, optionally about a Task", () => {
    const q = agent.askDeveloper("Dark mode: on by default, or follow the computer?", ["On by default", "Follow the computer"], { task: "t1" });
    expect(q).toMatchObject({ id: "q1", state: "open", choices: ["On by default", "Follow the computer"], task: "t1", askedAt: NOW.toISOString() });
    expect(talkText()).toContain(
      [
        "## Questions",
        "",
        "- [ ] Dark mode: on by default, or follow the computer? ^q1",
        "  - choice: On by default",
        "  - choice: Follow the computer",
        "  - task: ^t1",
        "  - asked: 2026-10-28T10:00:00.000Z",
      ].join("\n"),
    );
    expect(() => agent.askDeveloper("Only one?", ["Yes"])).toThrow(/2 to 4/);
    expect(() => agent.askDeveloper("Too many?", ["a", "b", "c", "d", "e"])).toThrow(/2 to 4/);
    expect(() => agent.askDeveloper("Same?", ["a", "A "])).toThrow(/different/);
    expect(() => agent.askDeveloper("Which?", ["a", "b"], { task: "t9" })).toThrow(/No Task t9/);
    expect(() => agent.askDeveloper("  ", ["a", "b"])).toThrow(/question/);
  });

  it("an answer is kept on the question and as a decision, and the Agent is shown it once", () => {
    agent.askDeveloper("Dark mode default?", ["On", "Follow the computer"]);
    later(3);
    const answered = page.answerQuestion("dark-mode", "q1", "Follow the computer");
    expect(answered).toMatchObject({ state: "answered", answer: "Follow the computer", answeredAt: "2026-10-28T10:03:00.000Z", decision: "c1" });
    expect(plan().decision("c1")!.text).toBe("Dark mode default? The Developer answered: Follow the computer");
    const news = agent.takeNewFromDeveloper("dark-mode");
    expect(news.answers).toEqual([expect.objectContaining({ id: "q1", answer: "Follow the computer", decision: "c1" })]);
    expect(agent.takeNewFromDeveloper("dark-mode").answers).toEqual([]);
  });

  it("takes an answer in the Developer's own words too", () => {
    agent.askDeveloper("Colour?", ["Blue", "Green"]);
    expect(page.answerQuestion("dark-mode", "q1", "  Purple,\nplease ").answer).toBe("Purple, please");
  });

  it("is answered once; a withdrawn one cannot be answered", () => {
    agent.askDeveloper("A or B?", ["A", "B"]);
    page.answerQuestion("dark-mode", "q1", "A");
    expect(() => page.answerQuestion("dark-mode", "q1", "B")).toThrow(/already answered/);
    agent.askDeveloper("C or D?", ["C", "D"]);
    agent.withdrawQuestion("q2");
    expect(talk().question("q2")!.state).toBe("withdrawn");
    expect(() => page.answerQuestion("dark-mode", "q2", "C")).toThrow(/withdrawn/);
    expect(() => page.answerQuestion("dark-mode", "q2", " ")).toThrow();
  });

  it("an open question makes the Goal wait on the Developer on the dashboard", () => {
    const waiting = () => dashboardApi(page).roadmap().goals.find((g) => g.id === "dark-mode")!;
    expect(waiting()).toMatchObject({ waitingOnYou: false, openQuestions: 0 });
    agent.askDeveloper("A or B?", ["A", "B"]);
    expect(waiting()).toMatchObject({ waitingOnYou: true, openQuestions: 1 });
    page.answerQuestion("dark-mode", "q1", "A");
    expect(waiting()).toMatchObject({ waitingOnYou: false, openQuestions: 0 });
  });

  it("reads a hand-typed section and keeps it as it was", () => {
    const source = "# G\n\n## Tasks\n\n- [ ] A ^t1\n\n## Questions\n\n- [ ] Which? ^q2\n  - choice: a\n  - choice: b\n- [x] Done?\n  - answer: yes\n- [-] Gone ^q1\n";
    const p = parsePlanFile(source, "g");
    expect(p.questions.map((q) => [q.id, q.state, q.choices, q.answer])).toEqual([
      ["q2", "open", ["a", "b"], undefined],
      [undefined, "answered", [], "yes"],
      ["q1", "withdrawn", [], undefined],
    ]);
    expect(p.toString()).toBe(source);
  });
});

describe("the Agent's tools", () => {
  let client: Client;
  beforeEach(async () => {
    const server = createServer(agent);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };

  it("get_status shows a new message first, once, and keeps it listed until replied to", async () => {
    page.sendMessage("dark-mode", "Use the blue logo");
    let { text } = await call("get_status");
    expect(text.split("\n")[0]).toBe("New from the Developer on the dashboard (act on it, then answer each message with reply_to_developer):");
    expect(text).toContain("- Message m1 on goal dark-mode: Use the blue logo");
    ({ text } = await call("get_status"));
    expect(text).not.toContain("New from the Developer");
    expect(text).toContain("Messages from the Developer not replied to yet: m1 Use the blue logo");
    await call("reply_to_developer", { message: "m1", reply: "Switched to blue." });
    ({ text } = await call("get_status"));
    expect(text).not.toContain("m1");
  });

  it("any tool reply ends with what the Developer just sent", async () => {
    const { text: first } = await call("start_task", { task: "t1" });
    expect(first).not.toContain("New from the Developer");
    page.sendMessage("dark-mode", "Stop: wait for me");
    const { text } = await call("add_decision", { text: "Blue it is" });
    expect(text).toMatch(/Saved decision[^]*\nNew from the Developer on the dashboard[^]*- Message m1 on goal dark-mode: Stop: wait for me/);
    expect((await call("start_task", { task: "t2" })).text).not.toContain("New from the Developer");
  });

  it("asks a question, lists it while open, and shows the answer once with its decision", async () => {
    const asked = await call("ask_developer", { question: "Dark mode default?", choices: ["On", "Follow the computer"], task: "t1" });
    expect(asked.text).toContain("Asked q1: Dark mode default? (On / Follow the computer)");
    expect(asked.text).toContain("dashboard");
    let { text } = await call("get_status");
    expect(text).toContain("Your questions waiting for the Developer's answer: q1 Dark mode default?");
    page.answerQuestion("dark-mode", "q1", "Follow the computer");
    ({ text } = await call("get_status"));
    expect(text).toContain('- Answer to q1 on goal dark-mode "Dark mode default?": Follow the computer (kept as decision c1)');
    expect(text).not.toContain("waiting for the Developer's answer");
    expect((await call("get_status")).text).not.toContain("Answer to q1");
  });

  it("withdraws a question, and refuses bad ones", async () => {
    expect((await call("ask_developer", { question: "Only one?", choices: ["Yes"] })).isError).toBe(true);
    await call("ask_developer", { question: "A or B?", choices: ["A", "B"] });
    expect((await call("ask_developer", { withdraw: "q1" })).text).toContain("Withdrew question q1");
    expect((await call("ask_developer", {})).isError).toBe(true);
  });

  it("mentions news on a Goal nobody holds without marking it seen", async () => {
    agent.addGoal("Logo");
    page.sendMessage("logo", "Make it round");
    const { text } = await call("get_status");
    expect(text).toContain("The Developer also wrote on goals you don't hold: logo (1 message). Claim the goal to read and act on it");
    expect(parsePlanFile(readFileSync(join(root, ".progressor/talk/logo.md"), "utf8"), "logo").message("m1")!.state).toBe("new");
  });
});

describe("the Claude Code prompt hook", () => {
  it("says what is new from the Developer, without marking it seen", () => {
    page.sendMessage("dark-mode", "Use the blue logo");
    agent.askDeveloper("A or B?", ["A", "B"]);
    page.answerQuestion("dark-mode", "q1", "B");
    const hook = new Project({ root, session: { id: "hook", pid: 1 }, now: () => clock });
    const text = promptReminder(hook.overview(), clock)!;
    expect(text).toContain("New from the Developer on the dashboard: message m1: Use the blue logo; answer to q1: B. Call get_status to act on it.");
    expect(talk().message("m1")!.state).toBe("new");
  });
});

describe("the dashboard endpoints", () => {
  let d: Dashboard;
  let id: string;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(new URL(`/api/projects/${id}/goals/dark-mode/${path}`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "talk", "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(async () => {
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    id = projectEntry(root).id;
  });
  afterEach(async () => {
    await d.close();
  });

  it("sends a message, shows it on the Goal's page, and takes it back while unseen", async () => {
    const res = await post("messages", { text: "Use the blue logo" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "m1", state: "new" });
    const view = (await (await fetch(new URL(`/api/projects/${id}/goals/dark-mode`, d.url))).json()) as { messages: unknown[]; questions: unknown[] };
    expect(view.messages).toMatchObject([{ id: "m1", text: "Use the blue logo" }]);
    expect(view.questions).toEqual([]);
    expect((await post("messages/m1/delete", {})).status).toBe(200);
    expect(talk().messages).toEqual([]);
    await post("messages", { text: "Again" });
    agent.takeNewFromDeveloper("dark-mode");
    const refused = await post("messages/m1/delete", {});
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toContain("already seen");
  });

  it("answers a question", async () => {
    agent.askDeveloper("A or B?", ["A", "B"]);
    const res = await post("questions/q1/answer", { answer: "B" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: "answered", answer: "B", decision: "c1" });
    expect((await post("questions/q1/answer", { answer: "A" })).status).toBe(409);
  });

  it("refuses other web pages, wrong headers, bad bodies and big ones", async () => {
    expect((await post("messages", { text: "x" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("messages", { text: "x" }, { "x-progressor": "mark" })).status).toBe(403);
    expect((await post("messages", { text: "x" }, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post("messages", "{nope")).status).toBe(400);
    expect((await post("messages", { text: 5 })).status).toBe(400);
    expect((await post("messages", { text: "  " })).status).toBe(400);
    expect((await post("messages", { text: "x".repeat(20000) })).status).toBe(413);
    expect((await post("questions/q9/answer", { answer: "A" })).status).toBe(404);
    expect(existsSync(join(root, ".progressor/talk/dark-mode.md"))).toBe(false); // nothing was written
  });
});

describe("what the dashboard says a goal needs", () => {
  it("counts questions, steps waiting and things to try, and any of them makes the goal wait on you", () => {
    const summary = () => dashboardApi(page).roadmap().goals.find((x) => x.id === "dark-mode")!;
    expect(summary()).toMatchObject({ waitingOnYou: false, openQuestions: 0, untriedTests: 0, waitingSteps: 0 });
    agent.addHandTest("Try the switch");
    expect(summary()).toMatchObject({ waitingOnYou: true, untriedTests: 1 });
    agent.markHandTest("dark-mode", "h1", "works");
    agent.setTaskState("t2", "waiting on you");
    expect(summary()).toMatchObject({ waitingOnYou: true, untriedTests: 0, waitingSteps: 1 });
  });
});
