import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { commitLinkBase, realGit } from "../src/gitFacts.js";
import { tempDir } from "./tmp.js";

let root: string;
const git = (args: string[], date?: string) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
  })
    .toString()
    .trim();
const commit = (file: string, date: string) => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), date);
  git(["add", "."]);
  git(["commit", "-q", "-m", `change ${file}`], date);
  return git(["rev-parse", "--short=7", "HEAD"]);
};

beforeEach(() => {
  root = tempDir("progressor-git-");
  git(["init", "-q", "-b", "main"]);
});

describe("git facts for a step", () => {
  it("lists the commits since the step started, newest first, only for its files when it lists some", () => {
    commit("src/a.ts", "2026-11-01T09:00:00Z");
    const one = commit("src/a.ts", "2026-11-01T11:00:00Z");
    commit("docs/x.md", "2026-11-01T11:30:00Z");
    const two = commit("src/ui/b.tsx", "2026-11-01T12:00:00Z");
    expect(realGit.commitsSince(root, "2026-11-01T10:00:00Z", ["src/a.ts:12", "src/ui/"])).toEqual([two, one]);
    expect(realGit.commitsSince(root, "2026-11-01T10:00:00Z", [])).toHaveLength(3);
  });

  it("tells whether a step's files have changes not saved in git", () => {
    commit("src/a.ts", "2026-11-01T09:00:00Z");
    expect(realGit.dirty(root, ["src/a.ts"])).toBe(false);
    writeFileSync(join(root, "src/a.ts"), "changed");
    expect(realGit.dirty(root, ["src/a.ts:3"])).toBe(true);
    expect(realGit.dirty(root, ["docs/"])).toBe(false);
  });

  it("knows the branch", () => {
    commit("a", "2026-11-01T09:00:00Z");
    expect(realGit.branch(root)).toBe("main");
  });

  it("says nothing, instead of failing, outside a repository", () => {
    const plain = tempDir("progressor-nogit-");
    expect(realGit.commitsSince(plain, "2026-11-01T10:00:00Z", [])).toBeUndefined();
    expect(realGit.dirty(plain, ["a"])).toBeUndefined();
    expect(realGit.branch(plain)).toBeUndefined();
    expect(realGit.commitLink(plain)).toBeUndefined();
  });

  it("makes commit links from the remote, and none without one", () => {
    commit("a", "2026-11-01T09:00:00Z");
    expect(realGit.commitLink(root)).toBeUndefined();
    git(["remote", "add", "origin", "git@github.com:racstan/progressor-mcp.git"]);
    expect(realGit.commitLink(root)).toBe("https://github.com/racstan/progressor-mcp/commit/");
  });
});

describe("commit links for each kind of remote", () => {
  it.each([
    ["https://github.com/racstan/progressor-mcp.git", "https://github.com/racstan/progressor-mcp/commit/"],
    ["git@github.com:racstan/progressor-mcp.git", "https://github.com/racstan/progressor-mcp/commit/"],
    ["ssh://git@github.com/racstan/progressor-mcp", "https://github.com/racstan/progressor-mcp/commit/"],
    ["https://gitlab.com/group/sub/repo.git", "https://gitlab.com/group/sub/repo/-/commit/"],
    ["git@gitlab.com:group/repo.git", "https://gitlab.com/group/repo/-/commit/"],
    ["http://gitea.local:3030/rachit/progressor.git", "http://gitea.local:3030/rachit/progressor/commit/"],
    ["https://user:secret@github.com/o/r.git", "https://github.com/o/r/commit/"],
  ])("%s", (remote, base) => {
    expect(commitLinkBase(remote)).toBe(base);
  });

  it("gives no link for a remote it can't read", () => {
    expect(commitLinkBase("/some/local/path")).toBeUndefined();
    expect(commitLinkBase("")).toBeUndefined();
  });
});
