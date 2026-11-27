import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeSettings } from "../src/settings.js";
import { type Run, realRun } from "../src/sync/connect.js";
import { readSyncState, startBackgroundSync, syncOnce, syncStateFileFor } from "../src/sync/run.js";
import { ROADMAP, bareRepo, computer, git, goalFile } from "./syncHelpers.js";
import { tempDir } from "./tmp.js";

describe("syncOnce", () => {
  it("writes a state file saying when it last synced and that all is well", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    await a.sync();
    const s = readSyncState(syncStateFileFor(a.settingsFile));
    expect(s).toMatchObject({ ok: true, offline: false, pending: 0, conflicts: [] });
    expect(s.lastSync).toBeTruthy();
    expect(s.problem).toBeUndefined();
  });

  it("commits as Progressor with a message naming the computer", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    await a.sync();
    expect(git(bare, "log", "-1", "--format=%an|%s", "main")).toBe("Progressor|Sync from laptop");
  });

  it("a round with nothing new makes no commit", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    await a.sync();
    const before = git(bare, "rev-parse", "main");
    const r = await a.sync();
    expect(git(bare, "rev-parse", "main")).toBe(before);
    expect(r.changed).toBe(false);
  });

  it("leaves a project with no plan and nothing in the repo alone", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const r = await a.sync();
    expect(r.ok).toBe(true);
    expect(a.exists("roadmap.md")).toBe(false);
  });

  it("syncs the rules for every project (global.json); the newer one wins when both changed", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    const globalA = join(dirname(a.settingsFile), "global.json");
    const globalB = join(dirname(b.settingsFile), "global.json");
    writeFileSync(globalA, '{"rules":[{"id":"g1","text":"one"}]}\n');
    await a.sync();
    expect(git(bare, "ls-tree", "-r", "--name-only", "main")).toContain(".global/global.json");
    await b.sync();
    expect(readFileSync(globalB, "utf8")).toContain("one");
    writeFileSync(globalB, '{"rules":[{"id":"g1","text":"two"}]}\n');
    await b.sync();
    await a.sync();
    expect(readFileSync(globalA, "utf8")).toContain("two");
  });

  it("retries once when the push is turned down because another computer got there first", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("goals/a.md", goalFile());
    b.write("goals/b.md", goalFile("B", "B2"));
    let pushes = 0;
    let raced = false;
    const run: Run = async (cmd, args, cwd) => {
      if (args[0] === "push") {
        pushes++;
        if (!raced) {
          raced = true; // the other computer syncs between our fetch and our push
          await b.sync();
        }
      }
      return realRun(cmd, args, cwd);
    };
    const r = await syncOnce({ ...a.deps(), run });
    expect(r.ok).toBe(true);
    expect(pushes).toBe(2);
    await b.sync();
    for (const c of [a, b]) expect(c.exists("goals/a.md") && c.exists("goals/b.md")).toBe(true);
  });

  it("two rounds at once in one process take turns", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    const [x, y] = await Promise.all([a.sync(), a.sync()]);
    expect(x.ok && y.ok).toBe(true);
    expect(git(bare, "log", "--format=%s", "main").split("\n")).toHaveLength(1);
  });

  it("says in plain words when sync was never connected", async () => {
    const dir = tempDir();
    const settingsFile = join(dir, "settings.json");
    const r = await syncOnce({ settingsFile, plansDir: join(dir, "plans"), projects: [], host: "x" });
    expect(r.ok).toBe(false);
    expect(readSyncState(syncStateFileFor(settingsFile)).problem).toMatch(/sync connect/);
  });

  it("keeps only the last 50 conflicts", () => {
    const dir = tempDir();
    const file = join(dir, "sync-state.json");
    writeFileSync(file, JSON.stringify({ conflicts: Array.from({ length: 70 }, (_, i) => ({ file: `f${i}`, section: "", id: "", kept: "ours", lost: "", at: "x", host: "h" })) }));
    expect(readSyncState(file).conflicts.length).toBe(50);
  });
});

describe("startBackgroundSync", () => {
  it("runs a round at the start, one soon after changes, and stops when told", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    let rounds = 0;
    const bg = startBackgroundSync({ ...a.deps(), projects: () => [a.root], debounceMs: 30, everyMs: 60_000, onRound: () => rounds++ });
    await bg.idle();
    expect(rounds).toBe(1);
    expect(git(bare, "ls-tree", "-r", "--name-only", "main")).toContain("roadmap.md");
    a.write("goals/x.md", goalFile());
    bg.changed();
    bg.changed();
    await new Promise((r) => setTimeout(r, 150));
    await bg.idle();
    expect(rounds).toBe(2); // the two changes were one round
    bg.stop();
    bg.changed();
    await new Promise((r) => setTimeout(r, 100));
    expect(rounds).toBe(2);
  });

  it("does nothing while sync is off, and notices when it is turned on", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    a.write("roadmap.md", ROADMAP);
    writeSettings(a.settingsFile, "sync", { enabled: false });
    const bg = startBackgroundSync({ ...a.deps(), projects: () => [a.root], debounceMs: 20, everyMs: 60_000 });
    await bg.idle();
    expect(git(bare, "branch", "--list")).toBe("");
    writeSettings(a.settingsFile, "sync", { enabled: true });
    bg.changed();
    await new Promise((r) => setTimeout(r, 120));
    await bg.idle();
    expect(git(bare, "ls-tree", "-r", "--name-only", "main")).toContain("roadmap.md");
    bg.stop();
  });

  it("never throws when the round fails", async () => {
    const dir = tempDir();
    const bg = startBackgroundSync({ settingsFile: join(dir, "s.json"), plansDir: join(dir, "nope"), projects: () => ["/does/not/exist"], host: "x", debounceMs: 10, everyMs: 60_000 });
    await expect(bg.idle()).resolves.toBeUndefined();
    bg.stop();
  });
});
