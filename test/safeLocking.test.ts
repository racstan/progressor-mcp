// Saving and locking that never lose a change: a failed save leaves no half-made goal, shutdown and
// slash prompts write under the lock, and waiting for the lock does not freeze a server.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { lockFile, withLockAsync } from "../src/lock.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

const SELF = { id: "s-a", pid: process.pid };
const failing = (name: string) => (from: string, to: string) => {
  if (to.endsWith(name)) throw Object.assign(new Error("disk full"), { code: "EIO" });
  renameSync(from, to);
};

const goalFiles = (root: string) => {
  try {
    return readdirSync(join(root, ".progressor", "goals"));
  } catch {
    return [];
  }
};

describe("a failed save never leaves a half-made goal", () => {
  it("addGoal: when the goal's plan file cannot be saved, the goal is not listed", () => {
    const root = tempDir();
    const p = new Project({ root, session: SELF, rename: failing("login.md") });
    expect(() => p.addGoal("Login", [{ title: "Form" }])).toThrow(/disk full/);
    expect(p.roadmap().goals).toEqual([]);
  });

  it("addGoal: when the roadmap cannot be saved, the new plan file is taken back", () => {
    const root = tempDir();
    const p = new Project({ root, session: SELF, rename: failing("roadmap.md") });
    expect(() => p.addGoal("Login", [{ title: "Form" }])).toThrow(/disk full/);
    expect(goalFiles(root)).toEqual([]);
  });

  it("addHotfix: the same, both ways", () => {
    const a = tempDir();
    const pa = new Project({ root: a, session: SELF, rename: failing("checkout-breaks.md") });
    expect(() => pa.addHotfix("Checkout breaks")).toThrow(/disk full/);
    expect(pa.roadmap().goals).toEqual([]);

    const b = tempDir();
    const pb = new Project({ root: b, session: SELF, rename: failing("roadmap.md") });
    expect(() => pb.addHotfix("Checkout breaks")).toThrow(/disk full/);
    expect(goalFiles(b)).toEqual([]);
  });
});

describe("shutdown", () => {
  it("releaseAll releases the Goals while holding the plan's lock", () => {
    const root = tempDir();
    let lockedDuringWrite = false;
    let watching = false;
    const p = new Project({
      root,
      session: SELF,
      rename: (from, to) => {
        if (watching && to.endsWith("roadmap.md") && existsSync(lockFile(root))) lockedDuringWrite = true;
        renameSync(from, to);
      },
    });
    p.claimGoal(p.addGoal("Login").id);
    watching = true;
    p.releaseAll();
    expect(lockedDuringWrite).toBe(true);
    expect(p.claimedGoals()).toEqual([]);
  });

  it("releaseAll gives up quickly, without throwing, when another process keeps the lock", () => {
    const root = tempDir();
    const p = new Project({ root, session: SELF });
    p.claimGoal(p.addGoal("Login").id);
    writeFileSync(lockFile(root), `${process.pid} other`); // a live process holding the plan
    const started = Date.now();
    try {
      expect(() => p.releaseAll()).not.toThrow();
    } finally {
      rmSync(lockFile(root), { force: true });
    }
    expect(Date.now() - started).toBeLessThan(2500);
  });
});

describe("slash prompts", () => {
  it("write news as seen only while holding the lock", async () => {
    const root = tempDir();
    let unlocked = 0;
    let writes = 0;
    let watching = false;
    const p = new Project({
      root,
      session: SELF,
      rename: (from, to) => {
        if (watching && to.endsWith(".md")) {
          writes++;
          if (!existsSync(lockFile(root))) unlocked++;
        }
        renameSync(from, to);
      },
    });
    const g = p.addGoal("Login", [{ title: "Form" }]);
    p.claimGoal(g.id);
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([createServer(p).connect(b), client.connect(a)]);
    for (const name of ["status", "next"]) {
      p.sendMessage(g.id, `again for ${name}`);
      watching = true;
      await client.getPrompt({ name });
      watching = false;
    }
    expect(writes).toBeGreaterThan(0);
    expect(unlocked).toBe(0);
  });
});

describe("waiting for the lock without freezing the process", () => {
  it("withLockAsync lets timers run while it waits, then takes the lock when it is freed", async () => {
    const root = tempDir();
    const dir = tempDir();
    writeFileSync(lockFile(root, dir), `${process.pid} other`);
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    setTimeout(() => rmSync(lockFile(root, dir), { force: true }), 120);
    const got = await withLockAsync(root, () => "ran", { dir, timeoutMs: 2000 });
    clearInterval(timer);
    expect(got).toBe("ran");
    expect(ticks).toBeGreaterThan(3);
  });

  it("withLockAsync says the plan is busy when the wait runs out", async () => {
    const root = tempDir();
    const dir = tempDir();
    writeFileSync(lockFile(root, dir), `${process.pid} other`);
    await expect(withLockAsync(root, () => "ran", { dir, timeoutMs: 60 })).rejects.toThrow(/is busy/);
  });

  it("transactionAsync changes the plan like transaction does", async () => {
    const root = tempDir();
    const p = new Project({ root, session: SELF });
    const goal = await p.transactionAsync("add", () => p.addGoal("Login"));
    expect(p.roadmap().goal(goal.id)?.title).toBe("Login");
  });

  it("leftover .pid.tmp files from a killed process are cleaned up, a running process's are kept", () => {
    const root = tempDir();
    const p = new Project({ root, session: SELF, isAlive: (pid) => pid === 4242 });
    p.addGoal("Login");
    const dir = join(root, ".progressor");
    mkdirSync(join(dir, "goals"), { recursive: true });
    writeFileSync(join(dir, "roadmap.md.999999.tmp"), "half");
    writeFileSync(join(dir, "goals", "login.md.999999.tmp"), "half");
    writeFileSync(join(dir, "roadmap.md.4242.tmp"), "in use");
    const q = new Project({ root, session: SELF, isAlive: (pid) => pid === 4242 });
    q.transaction("tidy", () => q.roadmap());
    expect(existsSync(join(dir, "roadmap.md.999999.tmp"))).toBe(false);
    expect(existsSync(join(dir, "goals", "login.md.999999.tmp"))).toBe(false);
    expect(existsSync(join(dir, "roadmap.md.4242.tmp"))).toBe(true);
  });
});
