import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type HistoryItem, lineDiff, listHistory, prune, tracked } from "../src/history.js";
import { Project, PROJECT_TALK } from "../src/project.js";
import { SETTINGS_DEFAULTS } from "../src/settings.js";
import { tempDir } from "./tmp.js";

const ON = SETTINGS_DEFAULTS.history;

function project(options: { root?: string; session?: string; history?: typeof ON; isAlive?: (pid: number) => boolean } = {}) {
  return new Project({
    root: options.root ?? tempDir("progressor-history-"),
    session: { id: options.session ?? "s-a", pid: process.pid },
    history: () => options.history ?? ON,
    ...(options.isAlive ? { isAlive: options.isAlive } : {}),
  });
}

const read = (p: Project, rel: string) => readFileSync(join(p.root, ".progressor", rel), "utf8");
const entries = (p: Project) => listHistory(p.historyDir);

/** A project with a claimed Goal, made in one change. */
function started(p = project()) {
  p.transaction("add_goal", () => {
    const g = p.addGoal("Login", [{ title: "Route" }, { title: "Callback" }]);
    p.claimGoal(g.id);
  });
  return p;
}

describe("plan history", () => {
  it("records one entry per transaction, with who and what", () => {
    const p = started();
    p.transaction("start_task", () => p.startTask("t1"));
    const list = entries(p);
    expect(list.map((e) => e.label)).toEqual(["add_goal", "start_task"]);
    expect(list[0]!.actor).toBe("AI");
    expect(list[0]!.files.sort()).toEqual(["goals/login.md", "roadmap.md"]);
    expect(list[1]!.files).toEqual(["goals/login.md"]);
    expect(read(p, ".gitignore")).toMatch(/^history\/$/m);
  });

  it("makes one entry for transactions inside a transaction", () => {
    const p = started();
    p.transaction("update_tasks", () => {
      p.transaction("start_task", () => p.startTask("t1"));
      p.transaction("complete_task", () => p.completeTask("t1", []));
    });
    expect(entries(p).map((e) => e.label)).toEqual(["add_goal", "update_tasks"]);
  });

  it("records nothing for a change that changes nothing, and nothing outside a transaction", () => {
    const p = started();
    p.transaction("get_status", () => p.roadmap());
    p.startTask("t1");
    expect(entries(p)).toHaveLength(1);
  });

  it("records nothing while history is off", () => {
    const p = started(project({ history: { ...ON, enabled: false } }));
    expect(existsSync(p.historyDir)).toBe(false);
  });

  it("goes back byte for byte, Windows line endings included", () => {
    const p = started();
    const crlf = read(p, "goals/login.md").replace(/\n/g, "\r\n");
    writeFileSync(join(p.root, ".progressor", "goals", "login.md"), crlf);
    const roadmap = read(p, "roadmap.md");
    p.transaction("start_task", () => p.startTask("t1"));
    p.transaction("complete_task", () => p.completeTask("t1", ["a.ts"]));
    const target = entries(p)[1]!;
    const done = p.restoreHistory(target.id);
    expect(done.undone.map((e) => e.label)).toEqual(["start_task", "complete_task"]);
    expect(done.files).toEqual(["goals/login.md"]);
    expect(read(p, "goals/login.md")).toBe(crlf);
    expect(read(p, "roadmap.md")).toBe(roadmap);
  });

  it("removes files that did not exist before, and the going-back can itself be undone", () => {
    const p = started();
    const before = { roadmap: read(p, "roadmap.md"), plan: read(p, "goals/login.md") };
    p.transaction("add_goal", () => p.addGoal("Billing"));
    p.transaction("update_context", () => p.setContext("Shop app"));
    const after = { roadmap: read(p, "roadmap.md"), context: read(p, "context.md") };
    const back = p.restoreHistory(entries(p)[1]!.id);
    expect(back.entry?.label).toBe("Went back to before: add_goal");
    expect(back.entry?.restores).toBe(entries(p)[1]!.id);
    expect(read(p, "roadmap.md")).toBe(before.roadmap);
    expect(read(p, "goals/login.md")).toBe(before.plan);
    expect(existsSync(join(p.root, ".progressor", "context.md"))).toBe(false);
    p.restoreHistory(back.entry!.id);
    expect(read(p, "roadmap.md")).toBe(after.roadmap);
    expect(read(p, "context.md")).toBe(after.context);
  });

  it("never takes back talk", () => {
    const p = started();
    p.transaction("Sent a message", () => p.sendMessage(PROJECT_TALK, "Hello"));
    const talk = read(p, "talk/_project.md");
    p.transaction("start_task", () => p.startTask("t1"));
    expect(entries(p).map((e) => e.label)).toEqual(["add_goal", "start_task"]);
    p.restoreHistory(entries(p)[0]!.id);
    expect(read(p, "talk/_project.md")).toBe(talk);
    expect(existsSync(join(p.root, ".progressor", "roadmap.md"))).toBe(false);
  });

  it("says plainly when there is no such change", () => {
    const p = started();
    expect(() => p.restoreHistory("20990101T000000000Z-1")).toThrow(/No change/);
  });

  it("clears Claims of Sessions that have ended after going back", () => {
    const root = tempDir("progressor-history-");
    const gone = project({ root, session: "s-old", isAlive: () => true });
    started(gone);
    const p = project({ root, session: "s-new", isAlive: (pid) => pid !== 4242 });
    // the old Session's Claim, with a pid that has ended, comes back with the going-back
    writeFileSync(join(root, ".progressor", "roadmap.md"), read(p, "roadmap.md").replace(/(claimed by: s-old) \(pid \d+\)/, "$1 (pid 4242)"));
    p.transaction("add_goal", () => p.addGoal("Billing"));
    p.restoreHistory(entries(p).at(-1)!.id);
    expect(p.roadmap().goal("login")?.claim).toBeUndefined();
  });

  it("records the dashboard's changes as the Developer's", () => {
    const root = started().root;
    const dash = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, history: () => ON });
    dash.transaction("Changed the project notes", () => dash.setContext("From the dashboard"));
    expect(listHistory(dash.historyDir).at(-1)).toMatchObject({ actor: "Developer", label: "Changed the project notes", files: ["context.md"] });
  });

  it("drops the oldest entries past the limits", () => {
    const p = started(project({ history: { ...ON, maxEntries: 3 } }));
    for (const title of ["A", "B", "C", "D"]) p.transaction("add_goal", () => p.addGoal(title));
    expect(entries(p)).toHaveLength(3);
    expect(readdirSync(p.historyDir).filter((f) => f !== "index.json")).toHaveLength(3);
  });

  it("shows what a change did, file by file", () => {
    const p = started();
    p.transaction("update_context", () => p.setContext("One"));
    p.transaction("update_context", () => p.setContext("Two"));
    const first = p.historyChanges(entries(p)[1]!.id)!;
    expect(first.files[0]).toMatchObject({ file: "context.md", made: true, removed: false });
    expect(first.files[0]!.lines).toContainEqual({ kind: "add", text: "One" });
    const second = p.historyChanges(entries(p)[2]!.id)!;
    expect(second.files[0]!.lines.filter((l) => l.kind !== "same")).toEqual([
      { kind: "del", text: "One" },
      { kind: "add", text: "Two" },
    ]);
  });
});

describe("history pieces", () => {
  const item = (id: number, at: string, bytes = 10): HistoryItem => ({ id: String(id), at, actor: "AI", label: "x", files: [], bytes });

  it("prunes by count, age and size, oldest first, keeping the newest", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const items = [item(1, "2026-09-01T00:00:00Z"), item(2, "2026-11-01T00:00:00Z"), item(3, "2026-11-06T00:00:00Z"), item(4, "2026-11-07T00:00:00Z")];
    expect(prune(items, { ...ON, keepDays: 30 }, now).keep.map((i) => i.id)).toEqual(["2", "3", "4"]);
    expect(prune(items, { ...ON, maxEntries: 2 }, now).keep.map((i) => i.id)).toEqual(["3", "4"]);
    expect(prune(items, { ...ON, maxMB: 25 / 1024 / 1024 }, now).keep.map((i) => i.id)).toEqual(["3", "4"]);
    expect(prune([item(1, "2020-01-01T00:00:00Z", 1e9)], ON, now).keep).toHaveLength(1);
  });

  it("keeps only the plan's own files", () => {
    expect(["roadmap.md", "context.md", "wishlist.md", "goals/a.md", "handoffs/2026-11-07-x.md"].every(tracked)).toBe(true);
    expect(["talk/a.md", "pictures/a/index.json", "attachments/w1/index.json", ".gitignore", "history/index.json", "goals/../x.md"].some(tracked)).toBe(false);
  });

  it("diffs lines with a little context", () => {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].join("\n");
    const after = before.replace("e", "E");
    expect(lineDiff(before, after, 1)).toEqual([
      { kind: "same", text: "…" },
      { kind: "same", text: "d" },
      { kind: "del", text: "e" },
      { kind: "add", text: "E" },
      { kind: "same", text: "f" },
      { kind: "same", text: "…" },
    ]);
  });
});

describe("the plan_history tool", () => {
  async function connect() {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../src/server.js");
    const settingsFile = join(tempDir("progressor-settings-"), "settings.json");
    const p = new Project({ root: tempDir("progressor-history-"), session: { id: "s-a", pid: process.pid } });
    const server = createServer(p, { settingsFile });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(b), client.connect(a)]);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
    };
    return { p, call, settingsFile };
  }

  it("records each tool call under its name, lists them and goes back", async () => {
    const { p, call } = await connect();
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }], claim: true });
    await call("start_task", { task: "t1" });
    await call("get_status");
    expect(entries(p).map((e) => e.label)).toEqual(["add_goal", "start_task"]);
    const list = await call("plan_history");
    expect(list.text).toMatch(/last 2 changes, newest first/);
    expect(list.text).toMatch(new RegExp(`- ${entries(p)[1]!.id} · .* · AI · start_task · goals/login.md`));
    const back = await call("plan_history", { restore: entries(p)[1]!.id });
    expect(back.isError).toBe(false);
    expect(back.text).toMatch(/^Went back to before .* \(start_task, by AI\): undid 1 change\.\nPut back: goals\/login\.md\./);
    expect(back.text).toMatch(/To undo this: plan_history restore: \S+\./);
    expect(p.plan("login").task("t1")?.status).toBe("pending");
    expect(entries(p).at(-1)!.label).toBe("Went back to before: start_task");
    expect((await call("plan_history", { restore: "nope" })).isError).toBe(true);
  });

  it("warns when it undoes the Developer's own change, and records nothing when history is off", async () => {
    const { p, call, settingsFile } = await connect();
    await call("add_goal", { title: "Login", claim: true });
    const dash = new Project({ root: p.root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false });
    dash.transaction("Changed the project notes", () => dash.setContext("Mine"));
    const back = await call("plan_history", { restore: entries(p)[1]!.id });
    expect(back.text).toMatch(/also undid the Developer's own 1 change on the dashboard \(Changed the project notes\)/);
    writeFileSync(settingsFile, JSON.stringify({ history: { enabled: false } }));
    const count = entries(p).length;
    await call("add_goal", { title: "Billing" });
    expect(entries(p)).toHaveLength(count);
    expect((await call("plan_history")).text).toMatch(/^History is turned off/);
  });
});

describe("history words", () => {
  it("names each change, who made it and the files in plain words", async () => {
    const { historyFile, historyLabel, historyWho, historyConfirm } = await import("../src/ui/words.js");
    expect(historyLabel("complete_task")).toBe("Finished a step");
    expect(historyLabel("claim_resource")).toBe("Claim resource");
    expect(historyLabel("Marked something to try")).toBe("Marked something to try");
    expect(historyLabel("Went back to before: start_task")).toBe('Went back to before "Started a step"');
    expect(historyWho("Developer")).toBe("You");
    expect(historyWho("AI")).toBe("Your AI");
    expect(historyFile("goals/login.md", (id) => (id === "login" ? "Login" : undefined))).toBe('Steps of "Login"');
    expect(historyFile("roadmap.md", () => undefined)).toBe("Goals and rules");
    expect(historyConfirm("add_goal", 2)).toMatch(/^Go back to before "Planned a goal"\?\n\nThis undoes it and the 2 changes after it\./);
  });
});
