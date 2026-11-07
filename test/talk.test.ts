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
import { writeSettings } from "../src/settings.js";
import { lookAtProject } from "../src/ntfy.js";
import { PROJECT_TALK, Project } from "../src/project.js";
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

describe("messages to the whole project", () => {
  const projectTalk = () => parsePlanFile(readFileSync(join(root, ".progressor/talk/_project.md"), "utf8"), PROJECT_TALK);
  let client: Client;
  /** An AI chat in the project that holds no goal. */
  let other: Project;
  beforeEach(async () => {
    other = new Project({ root, session: { id: "s-b", pid: process.pid }, now: () => clock });
    const server = createServer(other);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };

  it("are kept in their own talk file, out of git like the rest", () => {
    page.sendMessage(PROJECT_TALK, "Stop everything");
    expect(readFileSync(join(root, ".progressor/talk/_project.md"), "utf8")).toMatch(/^# The whole project: talk with the Developer\n/);
    expect(projectTalk().message("m1")).toMatchObject({ text: "Stop everything", state: "new" });
    expect(readFileSync(join(root, ".progressor/.gitignore"), "utf8")).toMatch(/^talk\/$/m);
  });

  it("reach an AI chat that holds no goal, once, and stay listed until replied to", async () => {
    page.sendMessage(PROJECT_TALK, "Start on the logo next");
    let { text } = await call("get_status");
    expect(text.split("\n")[0]).toBe("New from the Developer on the dashboard (act on it, then answer each message with reply_to_developer):");
    expect(text).toContain("- Message m1 to the whole project: Start on the logo next (reply with whole_project: true)");
    ({ text } = await call("get_status"));
    expect(text).not.toContain("New from the Developer");
    expect(text).toContain("Messages to the whole project not replied to yet: m1 Start on the logo next");
    const replied = await call("reply_to_developer", { message: "m1", whole_project: true, reply: "Starting on the logo." });
    expect(replied.isError).toBe(false);
    expect(projectTalk().message("m1")).toMatchObject({ state: "replied", reply: "Starting on the logo." });
    expect((await call("get_status")).text).not.toContain("m1");
  });

  it("end any tool reply, and a reply to a missing one is refused", async () => {
    page.sendMessage(PROJECT_TALK, "Stop everything");
    expect((await call("get_rules")).text).toContain("- Message m1 to the whole project: Stop everything");
    expect((await call("reply_to_developer", { message: "m9", whole_project: true, reply: "ok" })).isError).toBe(true);
  });

  it("show in the Claude Code prompt hook, even with no goal in progress", () => {
    agent.releaseGoal("dark-mode");
    page.sendMessage(PROJECT_TALK, "Stop everything");
    const hook = new Project({ root, session: { id: "hook", pid: 1 }, now: () => clock });
    expect(promptReminder(hook.overview(), clock)).toContain("New from the Developer on the dashboard: message m1 to the whole project: Stop everything. Call get_status to act on it.");
    expect(projectTalk().message("m1")!.state).toBe("new");
  });

  it("are sent and listed through the dashboard", async () => {
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    const d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const id = projectEntry(root).id;
      const res = await fetch(new URL(`/api/projects/${id}/goals/${PROJECT_TALK}/messages`, d.url), {
        method: "POST",
        headers: { origin: new URL(d.url).origin, "x-progressor": "talk", "content-type": "application/json" },
        body: JSON.stringify({ text: "Stop everything" }),
      });
      expect(res.status).toBe(201);
      const roadmap = (await (await fetch(new URL(`/api/projects/${id}/roadmap`, d.url))).json()) as { projectTalk: { messages: unknown[] } };
      expect(roadmap.projectTalk.messages).toMatchObject([{ id: "m1", text: "Stop everything", state: "new" }]);
    } finally {
      await d.close();
    }
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

describe("alternatives to choose from", () => {
  const layouts = [
    { title: "Cards", about: "Big tiles with a picture each" },
    { title: "List", about: "Compact rows, more on screen" },
  ];

  it("are kept as a question: the choices old readers see, plus about, picture, recommended and proceeds lines", () => {
    agent.askAlternatives("Which layout for the home page?", layouts, { recommended: 2, waitMinutes: 10 });
    expect(talkText()).toContain(
      [
        "- [ ] Which layout for the home page? ^q1",
        "  - choice: Cards",
        "  - choice: List",
        "  - about 1: Big tiles with a picture each",
        "  - about 2: Compact rows, more on screen",
        "  - recommended: 2",
        "  - proceeds: 2026-10-28T10:10:00.000Z",
        "  - asked: 2026-10-28T10:00:00.000Z",
      ].join("\n"),
    );
    const q = talk().question("q1")!;
    expect(q).toMatchObject({ state: "open", choices: ["Cards", "List"], recommended: 2, proceeds: "2026-10-28T10:10:00.000Z", moreRequested: false, chosenBy: undefined });
    expect(q.alternatives).toEqual([
      { title: "Cards", about: "Big tiles with a picture each", picture: undefined },
      { title: "List", about: "Compact rows, more on screen", picture: undefined },
    ]);
  });

  it("a plain question has no alternatives", () => {
    agent.askDeveloper("A or B?", ["A", "B"]);
    expect(talk().question("q1")).toMatchObject({ alternatives: [], recommended: undefined, chosenBy: undefined });
  });

  it("refuses too few or too many, a recommended one out of range and a picture the goal does not have", () => {
    expect(() => agent.askAlternatives("Which?", [layouts[0]!], { recommended: 1, waitMinutes: 0 })).toThrow(/2 to 4/);
    expect(() => agent.askAlternatives("Which?", layouts, { recommended: 3, waitMinutes: 0 })).toThrow(/recommended/);
    expect(() => agent.askAlternatives("Which?", [{ title: "A", picture: "p9" }, { title: "B" }], { recommended: 1, waitMinutes: 0 })).toThrow(/No picture p9/);
  });

  it("keeps a picture the goal has", () => {
    const shot = join(root, "shot.png");
    writeFileSync(shot, "png");
    agent.attachPicture(shot, "The cards layout");
    agent.askAlternatives("Which?", [{ title: "Cards", picture: "p1" }, { title: "List" }], { recommended: 1, waitMinutes: 10 });
    expect(talkText()).toContain("  - picture 1: p1");
    expect(talk().question("q1")!.alternatives[0]).toMatchObject({ title: "Cards", picture: "p1" });
  });

  it("with no wait, the AI goes ahead at once: answered by the AI, kept as a decision, and already known to it", () => {
    const q = agent.askAlternatives("Which layout?", layouts, { recommended: 1, waitMinutes: 0 });
    expect(q).toMatchObject({ state: "answered", answer: "Cards", chosenBy: "AI", decision: "c1", seen: true });
    expect(talkText()).toContain("  - answer: Cards (chosen by AI)");
    expect(plan().decision("c1")!.text).toBe("Which layout? Your AI went ahead with its recommended option: Cards");
    expect(agent.hasNewFromDeveloper("dark-mode")).toBe(false);
  });

  it("with a wait, nothing happens before it is over; after it, the AI's next look closes it and tells it to go ahead", () => {
    agent.askAlternatives("Which layout?", layouts, { recommended: 2, waitMinutes: 10 });
    later(5);
    expect(agent.hasNewFromDeveloper("dark-mode")).toBe(false);
    later(10);
    expect(agent.hasNewFromDeveloper("dark-mode")).toBe(true);
    const news = agent.takeNewFromDeveloper("dark-mode");
    expect(news.answers).toEqual([expect.objectContaining({ id: "q1", answer: "List", chosenBy: "AI", decision: "c1" })]);
    expect(talk().question("q1")!.state).toBe("answered");
    expect(agent.takeNewFromDeveloper("dark-mode").answers).toEqual([]);
  });

  it("the Developer can still pick another after the AI went ahead; it comes to the AI as news and changes the decision", () => {
    agent.askAlternatives("Which layout?", layouts, { recommended: 1, waitMinutes: 0 });
    later(30);
    const picked = page.answerQuestion("dark-mode", "q1", "List");
    expect(picked).toMatchObject({ state: "answered", answer: "List", chosenBy: "Developer", wentAhead: "Cards", seen: false });
    expect(plan().decision("c1")!.text).toBe("Which layout? The Developer answered: List");
    expect(plan().decisions).toHaveLength(1);
    expect(agent.takeNewFromDeveloper("dark-mode").answers).toEqual([expect.objectContaining({ id: "q1", answer: "List" })]);
    expect(() => page.answerQuestion("dark-mode", "q1", "Cards")).toThrow(/already answered/);
  });

  it("picking the option the AI already went ahead with only confirms it, with no news", () => {
    agent.askAlternatives("Which layout?", layouts, { recommended: 1, waitMinutes: 0 });
    expect(page.answerQuestion("dark-mode", "q1", "Cards")).toMatchObject({ chosenBy: "Developer", seen: true });
    expect(agent.hasNewFromDeveloper("dark-mode")).toBe(false);
  });

  it("the Developer picking before the wait is over is an ordinary answer", () => {
    agent.askAlternatives("Which layout?", layouts, { recommended: 1, waitMinutes: 60 });
    expect(page.answerQuestion("dark-mode", "q1", "List")).toMatchObject({ chosenBy: "Developer", wentAhead: undefined });
    later(120);
    expect(agent.takeNewFromDeveloper("dark-mode").answers).toEqual([expect.objectContaining({ answer: "List", chosenBy: "Developer" })]);
  });

  it("asking for other options marks the question and tells the AI as a notice", () => {
    agent.askAlternatives("Which layout?", layouts, { recommended: 1, waitMinutes: 0 });
    page.requestMoreAlternatives("dark-mode", "q1");
    expect(talkText()).toContain("  - more: requested");
    expect(talk().question("q1")!.moreRequested).toBe(true);
    const news = agent.takeNewFromDeveloper("dark-mode");
    expect(news.messages[0]!.text).toBe('On the dashboard I asked for other options to question q1 "Which layout?". Offer new ones with ask_developer.');
    expect(() => page.requestMoreAlternatives("dark-mode", "q1")).toThrow(/already/);
    agent.askDeveloper("A or B?", ["A", "B"]);
    expect(() => page.requestMoreAlternatives("dark-mode", "q2")).toThrow(/no alternatives/);
  });

  it("reads the lines back as they were", () => {
    const source = "# G\n\n## Questions\n\n- [x] Which? ^q1\n  - choice: a\n  - choice: b\n  - about 2: the b one\n  - recommended: 1\n  - answer: a (chosen by AI)\n";
    const p = parsePlanFile(source, "g");
    expect(p.question("q1")).toMatchObject({ answer: "a", chosenBy: "AI", recommended: 1 });
    expect(p.question("q1")!.alternatives[1]).toMatchObject({ title: "b", about: "the b one" });
    expect(p.toString()).toBe(source);
  });
});

describe("alternatives through the AI's tools", () => {
  let client: Client;
  let settingsFile: string;
  beforeEach(async () => {
    settingsFile = join(tempDir("progressor-settings-"), "settings.json");
    const server = createServer(agent, { settingsFile });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
  };
  const alternatives = [
    { title: "Cards", about: "Big tiles" },
    { title: "List", about: "Compact rows" },
  ];

  it("offers alternatives and tells the AI to go ahead now with its pick (the default wait is none)", async () => {
    const { text, isError } = await call("ask_developer", { question: "Which layout?", alternatives, recommended: 2 });
    expect(isError).toBe(false);
    expect(text).toContain("Offered q1: Which layout? (1 Cards / 2 List, recommended 2)");
    expect(text).toContain('Go ahead now with 2 "List" (kept as decision c1).');
    expect(text).toContain("a later pick comes as news");
    expect((await call("get_status")).text).not.toContain("q1");
  });

  it("with a wait, get_status lists it with its pick until the wait is over, then tells the AI once to go ahead", async () => {
    await call("ask_developer", { question: "Which layout?", alternatives, wait: "10m" });
    let { text } = await call("get_status");
    expect(text).toContain('Alternatives waiting for a pick: q1 Which layout? (yours: 1 "Cards"; if nobody picks, go ahead at 2026-10-28T10:10:00.000Z)');
    later(11);
    ({ text } = await call("get_status"));
    expect(text).toContain('- q1 on goal dark-mode "Which layout?": nobody picked in time, so go ahead now with your recommended option: Cards (kept as decision c1). A later pick comes as news.');
    expect(text).not.toContain("Alternatives waiting");
    expect((await call("get_status")).text).not.toContain("nobody picked");
  });

  it("the default wait comes from the settings", async () => {
    writeSettings(settingsFile, "alternatives", { wait: "1h" });
    const { text } = await call("ask_developer", { question: "Which layout?", alternatives });
    expect(text).toContain("If nobody picks by 2026-10-28T11:00:00.000Z, go ahead with 1");
    expect(talk().question("q1")!.state).toBe("open");
  });

  it("a later different pick tells the AI to change course", async () => {
    await call("ask_developer", { question: "Which layout?", alternatives });
    page.answerQuestion("dark-mode", "q1", "List");
    const { text } = await call("get_status");
    expect(text).toContain('- The Developer picked another option for q1 on goal dark-mode "Which layout?": List, not Cards that you went ahead with; change course (kept as decision c1)');
  });

  it("refuses alternatives with a bad wait", async () => {
    expect((await call("ask_developer", { question: "Which?", alternatives, wait: "soon" })).isError).toBe(true);
  });

  it("gives one short hint about when to offer alternatives, following the setting", async () => {
    expect((await call("get_status")).text).toContain("For a big product or design choice, offer 2 to 4 alternatives with ask_developer");
    writeSettings(settingsFile, "alternatives", { offer: "always" });
    expect((await call("get_status")).text).toContain("For any choice with more than one good way, offer 2 to 4 alternatives with ask_developer");
    writeSettings(settingsFile, "alternatives", { offer: "off" });
    expect((await call("get_status")).text).not.toContain("alternatives with ask_developer");
  });
});

describe("alternatives on the dashboard", () => {
  let d: Dashboard;
  let id: string;
  const post = (path: string, body: unknown) =>
    fetch(new URL(`/api/projects/${id}/goals/dark-mode/${path}`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "talk", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  beforeEach(async () => {
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    id = projectEntry(root).id;
  });
  afterEach(async () => {
    await d.close();
  });

  it("are picked through the answer route and can ask for other options", async () => {
    agent.askAlternatives("Which layout?", [{ title: "Cards" }, { title: "List" }], { recommended: 1, waitMinutes: 0 });
    const view = (await (await fetch(new URL(`/api/projects/${id}/goals/dark-mode`, d.url))).json()) as { questions: unknown[] };
    expect(view.questions).toMatchObject([{ id: "q1", chosenBy: "AI", recommended: 1, alternatives: [{ title: "Cards" }, { title: "List" }] }]);
    expect((await post("questions/q1/more", {})).status).toBe(200);
    expect(talk().question("q1")!.moreRequested).toBe(true);
    const picked = await post("questions/q1/answer", { answer: "List" });
    expect(picked.status).toBe(200);
    expect(await picked.json()).toMatchObject({ answer: "List", chosenBy: "Developer" });
    expect((await post("questions/q9/more", {})).status).toBe(404);
  });
});

describe("alternatives for phone notifications", () => {
  it("are looked at apart from plain questions, until the Developer picks", () => {
    const look = () => lookAtProject(page, "p", "P").goals.find((g) => g.id === "dark-mode")!;
    agent.askDeveloper("A or B?", ["A", "B"]);
    agent.askAlternatives("Which layout?", [{ title: "Cards" }, { title: "List" }], { recommended: 1, waitMinutes: 0 });
    expect(look()).toMatchObject({ questions: ["q1"], alternatives: ["q2"] });
    page.answerQuestion("dark-mode", "q2", "List");
    expect(look()).toMatchObject({ alternatives: [] });
  });
});
