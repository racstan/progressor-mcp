import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { checkUp, lastCheckup } from "../src/checkup.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
const dir = () => join(root, ".progressor");
const agent = (id = "s", pid = process.pid) => new Project({ root, session: { id, pid }, isAlive: (p) => p === process.pid });
const kinds = (r: ReturnType<typeof checkUp>) => r.findings.map((f) => `${f.kind}${f.fixed ? " (fixed)" : ""}`);

beforeEach(() => {
  root = tempDir("progressor-checkup-");
  const p = agent();
  p.addGoal("Login", [{ title: "Route", code: ["src/route.ts"] }, { title: "Callback" }]);
});

describe("the plan check-up", () => {
  it("finds nothing wrong in a healthy plan", () => {
    expect(checkUp(agent(), { repair: true }).findings).toEqual([]);
  });

  it("puts a file with mixed line endings back to one kind, so it can be read again", () => {
    const file = join(dir(), "roadmap.md");
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace("\n", "\r\n")); // one Windows line in an otherwise plain file
    expect(kinds(checkUp(agent(), { repair: false }))).toEqual(["line endings"]);
    const fixed = checkUp(agent(), { repair: true });
    expect(kinds(fixed)).toEqual(["line endings (fixed)"]);
    expect(readFileSync(file, "utf8")).toBe(text);
    expect(agent().roadmap().goals.map((g) => g.id)).toEqual(["login"]);
  });

  it("removes temporary files a crash left behind, but not ones still being written", () => {
    const old = join(dir(), "goals", "login.md.1234.tmp");
    const fresh = join(dir(), "roadmap.md.5678.tmp");
    writeFileSync(old, "x");
    writeFileSync(fresh, "y");
    const hourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(old, hourAgo, hourAgo);
    expect(kinds(checkUp(agent(), { repair: true }))).toEqual(["leftover file (fixed)"]);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it("frees a goal held by a chat that has ended", () => {
    agent("gone", 999999).claimGoal("login");
    const r = checkUp(agent(), { repair: true });
    expect(kinds(r)).toEqual(["stale claim (fixed)"]);
    expect(agent().roadmap().goal("login")!.claim).toBeUndefined();
  });

  it("reports, without changing anything, a finished step with files but no commits or tests", () => {
    const p = agent();
    p.claimGoal("login");
    p.completeTask("t1");
    p.completeTask("t2"); // lists no files: nothing to say
    const r = checkUp(agent(), { repair: true });
    expect(kinds(r)).toEqual(["no evidence"]);
    expect(r.findings[0]!.text).toContain("t1");
  });

  it("reports a goal that waits on a goal that is gone, and a picture whose file is missing", () => {
    const p = agent();
    p.addGoal("Release", [{ title: "Tag" }]);
    p.setWaitsOn("release", ["login"]);
    const roadmap = join(dir(), "roadmap.md");
    writeFileSync(roadmap, readFileSync(roadmap, "utf8").replace("waits on: login", "waits on: logout"));
    mkdirSync(join(dir(), "pictures", "login"), { recursive: true });
    writeFileSync(join(dir(), "pictures", "login", "index.json"), JSON.stringify([{ id: "p1", file: "1-shot.png", caption: "x", addedAt: "2026-11-07T00:00:00Z" }]));
    expect(kinds(checkUp(agent(), { repair: true }))).toEqual(["missing picture", "missing goal"]);
  });

  it("keeps its last result for the dashboard, and repairs are one undoable change", () => {
    const file = join(dir(), "roadmap.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("\n", "\r\n"));
    const p = agent();
    checkUp(p, { repair: true });
    expect(lastCheckup(p)?.findings.map((f) => f.kind)).toEqual(["line endings"]);
    expect(readFileSync(join(dir(), ".gitignore"), "utf8")).toContain("checkup/");
    const history = readFileSync(join(dir(), "history", "index.json"), "utf8");
    expect(history).toContain("check-up");
  });
});

describe("the check-up through get_status", () => {
  async function connect(settingsFile?: string) {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../src/server.js");
    const server = createServer(agent(), { settingsFile: settingsFile ?? join(tempDir("progressor-set-"), "settings.json") });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    return async (args: Record<string, unknown> = {}) =>
      ((await client.callTool({ name: "get_status", arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
  }

  it("repairs once per Session by itself and says so in one line; check: true lists everything", async () => {
    const file = join(dir(), "roadmap.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("\n", "\r\n"));
    const status = await connect();
    expect(await status()).toContain("Plan check-up: fixed 1 thing.");
    writeFileSync(file, readFileSync(file, "utf8").replace("\n", "\r\n"));
    expect(await status()).not.toContain("Plan check-up");
    expect(await status({ check: true })).toContain("- Fixed: roadmap.md mixed Windows and plain line endings");
  });

  it("does nothing by itself when that setting is off, and only reports when repairs are off", async () => {
    const { writeSettings } = await import("../src/settings.js");
    const settings = join(tempDir("progressor-set-"), "settings.json");
    writeSettings(settings, "checkup", { onStatus: false, autoRepair: false });
    const file = join(dir(), "roadmap.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("\n", "\r\n"));
    const status = await connect(settings);
    expect(await status()).not.toContain("Plan check-up");
    const listed = await status({ check: true });
    expect(listed).toContain("- roadmap.md mixed Windows and plain line endings");
    expect(listed).not.toContain("Fixed:");
  });
});

describe("the check-up on the dashboard", () => {
  it("shows the last result, and runs it only from the dashboard's own page", async () => {
    const { startDashboard } = await import("../src/dashboard/http.js");
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const dash = await startDashboard({ project: agent(), registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const id = (await (await fetch(new URL("/api/projects", dash.url!))).json())[0].id as string;
      const url = new URL(`/api/projects/${id}/checkup`, dash.url!);
      expect((await (await fetch(url)).json()).last).toBeNull();
      expect((await fetch(url, { method: "POST" })).status).toBe(403);
      const ran = await fetch(url, { method: "POST", headers: { origin: new URL(dash.url!).origin, "x-progressor": "checkup", "content-type": "application/json" }, body: "{}" });
      expect(ran.status).toBe(200);
      expect((await (await fetch(url)).json()).last.findings).toEqual([]);
    } finally {
      await dash.close();
    }
  });
});
