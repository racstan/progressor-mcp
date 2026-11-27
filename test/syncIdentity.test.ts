import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkProject, remoteKey, syncKey, unlinkProject } from "../src/sync/identity.js";
import { tempDir } from "./tmp.js";

describe("remoteKey: the same repo in any URL form gives one key", () => {
  it.each([
    "https://github.com/Racstan/Progressor-MCP.git",
    "https://github.com/racstan/progressor-mcp",
    "https://github.com/racstan/progressor-mcp/",
    "https://user:ghp_secret@github.com/racstan/progressor-mcp.git",
    "http://github.com/racstan/progressor-mcp.git",
    "git@github.com:racstan/progressor-mcp.git",
    "git@github.com:racstan/progressor-mcp",
    "ssh://git@github.com/racstan/progressor-mcp.git",
    "ssh://git@github.com:22/racstan/progressor-mcp.git",
    "git://github.com/racstan/progressor-mcp.git",
    "  https://www.github.com/racstan/progressor-mcp.git\n",
  ])("%s", (url) => {
    expect(remoteKey(url)).toBe("github.com/racstan/progressor-mcp");
  });

  it("keeps other hosts and nested groups", () => {
    expect(remoteKey("https://gitlab.com/team/sub/app.git")).toBe("gitlab.com/team/sub/app");
    expect(remoteKey("git@gitea.local:me/app.git")).toBe("gitea.local/me/app");
  });

  it("gives nothing for a local folder or a nonsense remote", () => {
    expect(remoteKey("/srv/git/app.git")).toBeUndefined();
    expect(remoteKey("C:\\repos\\app.git")).toBeUndefined();
    expect(remoteKey("file:///srv/git/app.git")).toBeUndefined();
    expect(remoteKey("")).toBeUndefined();
    expect(remoteKey("https://github.com/")).toBeUndefined();
    expect(remoteKey("https://github.com/../../etc")).toBeUndefined();
  });
});

describe("syncKey: which plan in the plans repo a project is", () => {
  const linksFile = () => join(tempDir("progressor-links-"), "sync-links.json");

  it("comes from the git remote, so two folders of one repo match", () => {
    const links = linksFile();
    const remote = () => "git@github.com:me/app.git";
    expect(syncKey("/home/me/code/app", { links, remote })).toBe("github.com/me/app");
    expect(syncKey("C:\\Work\\app-copy", { links, remote })).toBe("github.com/me/app");
  });

  it("falls back to the folder name when there is no remote", () => {
    expect(syncKey("/home/me/My Notes", { links: linksFile(), remote: () => undefined })).toBe("folder/my-notes");
  });

  it("uses a project's hand-made link before anything else, and forgets it when unlinked", () => {
    const links = linksFile();
    const remote = () => "https://github.com/me/app.git";
    linkProject("/home/me/notes", "github.com/me/notes-plan", links);
    expect(syncKey("/home/me/notes", { links, remote })).toBe("github.com/me/notes-plan");
    expect(syncKey("/home/me/other", { links, remote })).toBe("github.com/me/app");
    expect(unlinkProject("/home/me/notes", links)).toBe(true);
    expect(syncKey("/home/me/notes", { links, remote })).toBe("github.com/me/app");
  });

  it("refuses a link that is not a safe folder name in the plans repo", () => {
    const links = linksFile();
    expect(() => linkProject("/a", "../escape", links)).toThrow();
    expect(() => linkProject("/a", "/abs/path", links)).toThrow();
    expect(() => linkProject("/a", "", links)).toThrow();
    expect(() => linkProject("/a", ".git", links)).toThrow();
  });

  it("reads the real origin remote of a git folder", () => {
    const root = tempDir("progressor-idgit-");
    mkdirSync(join(root, "sub"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/Me/Real.git"], { cwd: root });
    expect(syncKey(root, { links: linksFile() })).toBe("github.com/me/real");
  });
});
