import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import type { GitFacts, GitRange } from "../src/gitFacts.js";
import { handoffFacts, handoffName, listHandoffs, readHandoff, saveHandoff } from "../src/handoff.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
let clock: Date;
let asked: GitRange[];

const fakeGit: GitFacts = {
  commitsSince: () => [],
  dirty: () => false,
  branch: () => "main",
  commitLink: () => undefined,
  range(_root, r) {
    asked.push(r);
    return { total: 2, lines: ["abc1234 Add the handoff tool", "def5678 Fix a typo"], files: ["src/handoff.ts", "README.md"] };
  },
  timeOf: (_root, ref) => (ref === "abc1234" ? "2026-11-03T09:00:00.000Z" : undefined),
};

const agent = () => new Project({ root, session: { id: "s", pid: process.pid }, git: fakeGit, now: () => clock });

beforeEach(() => {
  root = tempDir("progressor-handoff-");
  clock = new Date("2026-11-01T10:00:00.000Z");
  asked = [];
});

/** A goal with one step finished on Nov 1 and one on Nov 5, a decision, an open note and an open question. */
function someWork(p: Project) {
  const g = p.addGoal("Handoffs", [{ title: "Old step" }, { title: "New step" }, { title: "Later step" }], { outcome: "Handoffs are written" });
  p.claimGoal(g.id);
  p.completeTask("t1", [], undefined, g.id);
  clock = new Date("2026-11-05T10:00:00.000Z");
  p.completeTask("t2", ["src/handoff.ts"], undefined, g.id);
  p.addDecision("Handoffs live in the plan folder", g.id);
  p.addNote(g.id, "The viewer needs a print style");
  p.askDeveloper("Should handoffs be shared through git?", ["Yes", "No"], { goal: g.id });
  clock = new Date("2026-11-07T10:00:00.000Z");
  return g.id;
}

describe("the facts a handoff is written from", () => {
  it("covers the steps finished in the range, with decisions, what is left open, commits and files", () => {
    const p = agent();
    someWork(p);
    const f = handoffFacts(p, { since: "2026-11-04" });
    expect(f.range).toBe("2026-11-04 to 2026-11-07");
    expect(f.text).toContain("Handoff facts for 2026-11-04 to 2026-11-07");
    expect(f.text).toContain("- handoffs: Handoffs (active). Finished when: Handoffs are written.");
    expect(f.text).toContain("  Steps finished: t2 New step");
    expect(f.text).not.toContain("Old step");
    expect(f.text).toContain("  Steps left: t3 Later step");
    expect(f.text).toContain("  Decisions: Handoffs live in the plan folder");
    expect(f.text).toContain("  Open notes: The viewer needs a print style");
    expect(f.text).toContain("  Open questions: Should handoffs be shared through git?");
    expect(f.text).toContain("Commits (2):\n- abc1234 Add the handoff tool\n- def5678 Fix a typo");
    expect(f.text).toContain("Files changed: src/handoff.ts, README.md");
    expect(f.text).toContain("Then call handoff again with text");
    expect(asked[0]).toEqual({ since: "2026-11-04T00:00:00.000Z", until: "2026-11-07T10:00:00.000Z" });
  });

  it("starts from a commit when given one, and from the last handoff by default", () => {
    const p = agent();
    someWork(p);
    expect(handoffFacts(p, { since: "abc1234" }).range).toBe("abc1234 to 2026-11-07");
    expect(asked[0]).toEqual({ from: "abc1234", until: "2026-11-07T10:00:00.000Z" });
    // No handoff yet: the last 7 days.
    expect(handoffFacts(p, {}).range).toBe("2026-10-31 to 2026-11-07");
    saveHandoff(p, { title: "Week one", text: "Body", range: "2026-10-31 to 2026-11-07" }, 50);
    clock = new Date("2026-11-09T10:00:00.000Z");
    expect(handoffFacts(p, {}).range).toBe("2026-11-07 to 2026-11-09");
  });

  it("covers the commits named, and nothing else from git", () => {
    const p = agent();
    someWork(p);
    handoffFacts(p, { commits: ["abc1234", "def5678"] });
    expect(asked[0]).toEqual({ commits: ["abc1234", "def5678"] });
  });

  it("says when nothing happened", () => {
    const p = new Project({ root, session: { id: "s", pid: process.pid }, git: { ...fakeGit, range: () => ({ total: 0, lines: [], files: [] }) }, now: () => clock });
    expect(handoffFacts(p, {}).text).toContain("No steps were finished and no commits made in this range.");
  });
});

describe("saved handoffs", () => {
  it("are markdown files in the plan folder, named by date and title, newest first", () => {
    const p = agent();
    expect(handoffName("2026-11-07", "Week one: handoffs & more!")).toBe("2026-11-07-week-one-handoffs-more.md");
    const a = saveHandoff(p, { title: "Week one", text: "# Week one\n\nDone things.", range: "2026-10-31 to 2026-11-07", commits: 2 }, 50);
    expect(a.file).toBe("2026-11-01-week-one.md");
    const text = readFileSync(join(root, ".progressor", "handoffs", a.file), "utf8");
    expect(text).toBe("# Week one\n\n- range: 2026-10-31 to 2026-11-07\n- commits: 2\n- written: 2026-11-01T10:00:00.000Z by AI\n\nDone things.\n");
    const b = saveHandoff(p, { title: "Week one", text: "Again", range: "x" }, 50);
    expect(b.file).toBe("2026-11-01-week-one-2.md");
    clock = new Date("2026-11-08T10:00:00.000Z");
    saveHandoff(p, { title: "Next", text: "Later", range: "y" }, 50);
    expect(listHandoffs(p).map((h) => h.file)).toEqual(["2026-11-08-next.md", "2026-11-01-week-one-2.md", "2026-11-01-week-one.md"]);
    expect(listHandoffs(p)[2]).toMatchObject({ title: "Week one", range: "2026-10-31 to 2026-11-07", written: "2026-11-01T10:00:00.000Z" });
    expect(readHandoff(p, a.file)).toContain("Done things.");
    expect(() => readHandoff(p, "../roadmap.md")).toThrow(/No handoff/);
  });

  it("keeps only the newest ones the settings allow", () => {
    const p = agent();
    for (let i = 1; i <= 4; i++) {
      clock = new Date(`2026-11-0${i}T10:00:00.000Z`);
      saveHandoff(p, { title: `Day ${i}`, text: "x", range: "r" }, 2);
    }
    expect(readdirSync(join(root, ".progressor", "handoffs")).sort()).toEqual(["2026-11-03-day-3.md", "2026-11-04-day-4.md"]);
  });
});

describe("the handoff tool and the dashboard", () => {
  async function connect(settings?: string) {
    const server = createServer(agent(), { settingsFile: settings ?? join(tempDir("progressor-set-"), "settings.json") });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await server.connect(x);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(y);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content.map((c) => c.text).join("\n"), isError: !!r.isError };
    };
  }

  it("gives the facts, then saves what the AI wrote", async () => {
    someWork(agent());
    const call = await connect();
    const facts = await call("handoff", { since: "2026-11-04" });
    expect(facts.isError).toBe(false);
    expect(facts.text).toContain("Handoff facts for 2026-11-04 to 2026-11-07");
    const saved = await call("handoff", { since: "2026-11-04", title: "This week", text: "## What changed\n\nThe handoff tool." });
    expect(saved.text).toContain("Saved the handoff 2026-11-07-this-week.md");
    expect(existsSync(join(root, ".progressor", "handoffs", "2026-11-07-this-week.md"))).toBe(true);
    expect((await call("handoff", { text: "No title" })).isError).toBe(true);
  });
});

describe("what real git says about a range", () => {
  it("lists the commits after a tag, the files they touched, and when a commit was made", async () => {
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync } = await import("node:fs");
    const { realGit } = await import("../src/gitFacts.js");
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stdio: "pipe" }).toString().trim();
    git("init", "-q", "-b", "main");
    writeFileSync(join(root, "a.txt"), "a");
    git("add", ".");
    git("commit", "-qm", "First");
    git("tag", "v1");
    writeFileSync(join(root, "b.txt"), "b");
    git("add", ".");
    git("commit", "-qm", "Second");
    const r = realGit.range!(root, { from: "v1" }, 10)!;
    expect(r.total).toBe(1);
    expect(r.lines[0]).toMatch(/^[0-9a-f]{7} Second$/);
    expect(r.files).toEqual(["b.txt"]);
    const hash = r.lines[0]!.slice(0, 7);
    expect(realGit.range!(root, { commits: [hash] }, 10)!.files).toEqual(["b.txt"]);
    expect(realGit.range!(root, { from: "HEAD~1" }, 10)!.total).toBe(1);
    expect(realGit.timeOf!(root, "v1")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(realGit.timeOf!(root, "no-such-tag")).toBeUndefined();
    expect(realGit.range!(root, { from: "--all" }, 10)).toBeUndefined();
  });
});

describe("handoffs on the dashboard", () => {
  it("lists and shows saved handoffs, and asks the AI for one only from the dashboard's own page", async () => {
    const { startDashboard } = await import("../src/dashboard/http.js");
    const { requestMessage } = await import("../src/dashboard/routes/handoffs.js");
    const p = agent();
    saveHandoff(p, { title: "Week one", text: "Done things.", range: "r" }, 50);
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const dash = await startDashboard({ project: agent(), registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const id = (await (await fetch(new URL("/api/projects", dash.url!))).json())[0].id as string;
      const base = `/api/projects/${id}/handoffs`;
      const list = await (await fetch(new URL(base, dash.url!))).json();
      expect(list.map((h: { file: string }) => h.file)).toEqual(["2026-11-01-week-one.md"]);
      expect((await (await fetch(new URL(`${base}/2026-11-01-week-one.md`, dash.url!))).json()).text).toContain("Done things.");
      expect((await fetch(new URL(`${base}/nothing.md`, dash.url!))).status).toBe(404);
      const ask = new URL(`${base}/request`, dash.url!);
      expect((await fetch(ask, { method: "POST", body: "{}" })).status).toBe(403);
      const headers = { origin: new URL(dash.url!).origin, "x-progressor": "handoffs", "content-type": "application/json" };
      expect((await fetch(ask, { method: "POST", headers, body: JSON.stringify({ last: 5 }) })).status).toBe(201);
      expect(agent().talk("_project").messages.at(-1)!.text).toBe('On the dashboard I asked for a handoff of the last 5 commits (handoff since: "HEAD~5"). Write it from the facts and save it.');
      expect((await fetch(ask, { method: "POST", headers, body: JSON.stringify({ since: "yesterday" }) })).status).toBe(400);
    } finally {
      await dash.close();
    }
    expect(requestMessage({ since: "2026-11-01" })).toBe('On the dashboard I asked for a handoff of 2026-11-01 to now (handoff since: "2026-11-01"). Write it from the facts and save it.');
    expect(requestMessage({})).toContain("since the last handoff");
  });
});
