// worktreeOf: telling a linked git worktree (a helper chat's folder) from an ordinary folder.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planRootFor, worktreeOf } from "../src/worktree.js";
import { tempDir } from "./tmp.js";

/** Fakes what `git worktree add` leaves: <main>/.git/worktrees/<name> and a `.git` file in the worktree. */
function fake(opts: { head?: string; commondir?: string | null; pointer?: (gitdir: string) => string } = {}) {
  const main = tempDir("pg-main-");
  const wt = join(tempDir("pg-wt-"), "helper");
  const gitdir = join(main, ".git", "worktrees", "helper");
  mkdirSync(gitdir, { recursive: true });
  mkdirSync(wt, { recursive: true });
  writeFileSync(join(gitdir, "HEAD"), opts.head ?? "ref: refs/heads/t3-export\n");
  if (opts.commondir !== null) writeFileSync(join(gitdir, "commondir"), opts.commondir ?? "../..\n");
  writeFileSync(join(wt, ".git"), `gitdir: ${(opts.pointer ?? ((g) => g))(gitdir)}\n`);
  return { main, wt, gitdir };
}

describe("worktreeOf", () => {
  it("finds the main folder and branch of a linked worktree", () => {
    const { main, wt } = fake();
    expect(worktreeOf(wt)).toEqual({ mainRoot: main, folder: wt, branch: "t3-export" });
  });

  it("keeps a branch name with slashes whole", () => {
    const { wt } = fake({ head: "ref: refs/heads/claude/t3-export-6bb45e\n" });
    expect(worktreeOf(wt)?.branch).toBe("claude/t3-export-6bb45e");
  });

  it("has no branch on a detached HEAD", () => {
    const { main, wt } = fake({ head: "0123456789abcdef0123456789abcdef01234567\n" });
    expect(worktreeOf(wt)).toEqual({ mainRoot: main, folder: wt, branch: undefined });
  });

  it("follows an absolute commondir and a relative gitdir pointer", () => {
    const a = fake();
    writeFileSync(join(a.gitdir, "commondir"), join(a.main, ".git"));
    expect(worktreeOf(a.wt)?.mainRoot).toBe(a.main);
    const b = fake({ pointer: (g) => g });
    expect(worktreeOf(b.wt)?.mainRoot).toBe(b.main);
  });

  it("is undefined for a main checkout, a plain folder and a missing folder", () => {
    const main = tempDir("pg-plain-");
    expect(worktreeOf(main)).toBeUndefined();
    mkdirSync(join(main, ".git"));
    expect(worktreeOf(main)).toBeUndefined();
    expect(worktreeOf(join(main, "nope"))).toBeUndefined();
  });

  it("is undefined, without throwing, when the files are wrong", () => {
    expect(worktreeOf(fake({ commondir: null }).wt)).toBeUndefined();
    const w = tempDir("pg-bad-");
    writeFileSync(join(w, ".git"), "not a pointer");
    expect(worktreeOf(w)).toBeUndefined();
    const gone = tempDir("pg-gone-");
    writeFileSync(join(gone, ".git"), `gitdir: ${join(gone, "missing")}`);
    expect(worktreeOf(gone)).toBeUndefined();
  });
});

describe("planRootFor", () => {
  it("serves the main folder for a worktree whose main folder has a plan", () => {
    const { main, wt } = fake();
    mkdirSync(join(main, ".progressor"));
    expect(planRootFor(wt)).toEqual({ root: main, worktree: wt, branch: "t3-export" });
  });

  it("keeps the folder when the main folder has no plan, or it is no worktree", () => {
    const { wt } = fake();
    expect(planRootFor(wt)).toEqual({ root: wt });
    const plain = tempDir("pg-plain-");
    expect(planRootFor(plain)).toEqual({ root: plain });
  });
});
