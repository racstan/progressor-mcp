import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSyncState, syncStateFileFor } from "../src/sync/run.js";
import { ROADMAP, T2, T3, bareRepo, computer, git, goalFile } from "./syncHelpers.js";

const state = (c: { settingsFile: string }) => readSyncState(syncStateFileFor(c.settingsFile));

describe("two computers sharing one plans repo", () => {
  it("A adds a goal; B syncs and has it", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("roadmap.md", ROADMAP);
    a.write("goals/login.md", goalFile());
    expect((await a.sync()).ok).toBe(true);
    expect(git(bare, "ls-tree", "-r", "--name-only", "main")).toContain("github.com/acme/app/goals/login.md");
    expect(b.exists("roadmap.md")).toBe(false);
    expect((await b.sync()).ok).toBe(true);
    expect(b.read("goals/login.md")).toBe(goalFile());
    expect(b.read("roadmap.md")).toBe(ROADMAP);
  });

  it("changes to different steps on both computers both survive on both", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("roadmap.md", ROADMAP);
    a.write("goals/login.md", goalFile());
    await a.sync();
    await b.sync();
    a.write("goals/login.md", goalFile("Build the form (A)", "Add tests", T2));
    b.write("goals/login.md", goalFile("Build the form", "Add tests (B)", undefined, T2));
    await a.sync();
    await b.sync();
    await a.sync();
    for (const c of [a, b]) {
      expect(c.read("goals/login.md")).toContain("Build the form (A)");
      expect(c.read("goals/login.md")).toContain("Add tests (B)");
    }
    expect(a.read("goals/login.md")).toBe(b.read("goals/login.md"));
  });

  it("the same step changed on both: the newer one is kept and the other is recorded as a conflict", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("goals/login.md", goalFile());
    a.write("roadmap.md", ROADMAP);
    await a.sync();
    await b.sync();
    a.write("goals/login.md", goalFile("A's wording", "Add tests", T2));
    b.write("goals/login.md", goalFile("B's wording", "Add tests", T3));
    await a.sync();
    const result = await b.sync();
    await a.sync();
    expect(b.read("goals/login.md")).toContain("B's wording");
    expect(b.read("goals/login.md")).not.toContain("A's wording");
    expect(a.read("goals/login.md")).toContain("B's wording");
    expect(result.conflicts).toBeGreaterThan(0);
    const kept = state(b).conflicts;
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.map((c) => c.lost).join("\n")).toContain("A's wording");
  });

  it("while B is offline its changes wait, and go through once it is back", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("roadmap.md", ROADMAP);
    await a.sync();
    await b.sync();
    git(b.plansDir, "remote", "set-url", "origin", `${bare}-missing`);
    b.write("goals/offline.md", goalFile());
    const off = await b.sync();
    expect(off.offline).toBe(true);
    expect(state(b)).toMatchObject({ offline: true, ok: false });
    expect(state(b).problem).toMatch(/can't reach/i);
    expect(state(b).pending).toBeGreaterThan(0);
    await a.sync();
    expect(a.exists("goals/offline.md")).toBe(false);
    git(b.plansDir, "remote", "set-url", "origin", bare);
    const back = await b.sync();
    expect(back.ok).toBe(true);
    expect(state(b)).toMatchObject({ offline: false, ok: true, pending: 0 });
    await a.sync();
    expect(a.read("goals/offline.md")).toBe(goalFile());
  });

  it("the offline computer also takes up changes made elsewhere meanwhile, losing nothing", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("goals/one.md", goalFile());
    await a.sync();
    await b.sync();
    git(b.plansDir, "remote", "set-url", "origin", `${bare}-missing`);
    b.write("goals/b-only.md", goalFile("B step", "B step 2"));
    await b.sync();
    a.write("goals/a-only.md", goalFile("A step", "A step 2"));
    await a.sync();
    git(b.plansDir, "remote", "set-url", "origin", bare);
    await b.sync();
    await a.sync();
    for (const c of [a, b]) for (const f of ["goals/one.md", "goals/a-only.md", "goals/b-only.md"]) expect(c.exists(f)).toBe(true);
  });

  it("a file deleted on one computer is deleted on the other", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("goals/old.md", goalFile());
    await a.sync();
    await b.sync();
    rmSync(join(a.root, ".progressor", "goals", "old.md"));
    await a.sync();
    await b.sync();
    expect(b.exists("goals/old.md")).toBe(false);
  });

  it("messages and screenshots (talk/, pictures/, attachments/) are not synced unless talk is on", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare);
    const b = await computer("desktop", bare);
    a.write("roadmap.md", ROADMAP);
    a.write("talk/login.md", "hello\n");
    a.write("pictures/login/a.png", Buffer.from([0, 1, 2, 255]));
    await a.sync();
    await b.sync();
    expect(b.exists("roadmap.md")).toBe(true);
    expect(b.exists("talk/login.md")).toBe(false);
    expect(b.exists("pictures/login/a.png")).toBe(false);
  });

  it("with talk on, messages and screenshots sync, byte for byte", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare, { talk: true });
    const b = await computer("desktop", bare, { talk: true });
    const png = Buffer.from([0x89, 0x50, 0, 1, 2, 255, 254, 13, 10]);
    a.write("talk/login.md", "hello\n");
    a.write("pictures/login/a.png", png);
    await a.sync();
    await b.sync();
    expect(b.read("talk/login.md")).toBe("hello\n");
    expect(Buffer.compare(readFileSync(join(b.root, ".progressor", "pictures", "login", "a.png")), png)).toBe(0);
  });

  it("history/, cost/ and checkup/ never sync", async () => {
    const bare = bareRepo();
    const a = await computer("laptop", bare, { talk: true });
    const b = await computer("desktop", bare, { talk: true });
    a.write("roadmap.md", ROADMAP);
    a.write("history/2026-01-01.json", "{}");
    a.write("cost/x.json", "{}");
    a.write("checkup/y.md", "x");
    a.write(".gitignore", "*\n");
    await a.sync();
    await b.sync();
    expect(git(bare, "ls-tree", "-r", "--name-only", "main")).not.toMatch(/history|cost|checkup|gitignore/);
    expect(b.exists("history/2026-01-01.json")).toBe(false);
    expect(b.exists("cost/x.json")).toBe(false);
  });
});
