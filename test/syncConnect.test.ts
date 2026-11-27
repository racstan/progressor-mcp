import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Run, connectSync, repoUrl, syncOff } from "../src/sync/connect.js";
import { readSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function home() {
  const dir = tempDir("progressor-synchome-");
  return { settingsFile: join(dir, "settings.json"), plansDir: join(dir, "plans") };
}

function bareRepo(): string {
  const dir = join(tempDir("progressor-bare-"), "plans.git");
  mkdirSync(dir);
  git(dir, "init", "-q", "--bare");
  return dir;
}

describe("repoUrl: what the Developer or the AI may give", () => {
  it("turns owner/repo into a GitHub address and keeps URLs and folders as they are", () => {
    expect(repoUrl("me/progressor-plans")).toBe("https://github.com/me/progressor-plans.git");
    expect(repoUrl("https://github.com/me/p.git")).toBe("https://github.com/me/p.git");
    expect(repoUrl("git@github.com:me/p.git")).toBe("git@github.com:me/p.git");
  });
});

describe("connectSync", () => {
  it("clones a repo by URL beside the registry and turns sync on", async () => {
    const h = home();
    const bare = bareRepo();
    const result = await connectSync(bare, h);
    expect(result.repo).toBe(bare);
    expect(existsSync(join(h.plansDir, ".git"))).toBe(true);
    expect(git(h.plansDir, "remote", "get-url", "origin")).toBe(bare);
    expect(readSettings(h.settingsFile).sync).toMatchObject({ enabled: true, repo: bare });
  });

  it("can be run again: keeps the clone it already has", async () => {
    const h = home();
    const bare = bareRepo();
    await connectSync(bare, h);
    const again = await connectSync(bare, h);
    expect(again.cloned).toBe(false);
    expect(readSettings(h.settingsFile).sync.enabled).toBe(true);
  });

  it("moves an old clone of another repo aside rather than mixing plans", async () => {
    const h = home();
    await connectSync(bareRepo(), h);
    const other = bareRepo();
    await connectSync(other, h);
    expect(git(h.plansDir, "remote", "get-url", "origin")).toBe(other);
  });

  it("with no repo given, finds or makes a private progressor-plans repo with gh", async () => {
    const h = home();
    const bare = bareRepo();
    const calls: string[] = [];
    let exists = false;
    const run: Run = async (cmd, args, cwd) => {
      calls.push(`${cmd} ${args.join(" ")}`);
      if (cmd === "gh" && args[0] === "api") return "me\n";
      if (cmd === "gh" && args[0] === "repo" && args[1] === "view") {
        if (!exists) throw new Error("not found");
        return `${bare}\n`;
      }
      if (cmd === "gh" && args[0] === "repo" && args[1] === "create") {
        exists = true;
        return "";
      }
      return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    };
    const result = await connectSync(undefined, { ...h, run });
    expect(calls).toContain("gh repo create me/progressor-plans --private --description Progressor plans, synced between computers");
    expect(result.created).toBe(true);
    expect(result.repo).toBe(bare);
    // A second computer finds the same repo instead of making another.
    const h2 = home();
    calls.length = 0;
    const second = await connectSync(undefined, { ...h2, run });
    expect(second.created).toBe(false);
    expect(calls.some((c) => c.startsWith("gh repo create"))).toBe(false);
  });

  it("says plainly when gh is missing or not signed in, and changes nothing", async () => {
    const h = home();
    const run: Run = async () => {
      throw new Error("spawn gh ENOENT");
    };
    await expect(connectSync(undefined, { ...h, run })).rejects.toThrow(/GitHub CLI/);
    expect(readSettings(h.settingsFile).sync.enabled).toBe(false);
  });

  it("is off by default, and sync off turns it off but keeps the clone", async () => {
    const h = home();
    expect(readSettings(h.settingsFile).sync).toMatchObject({ enabled: false, repo: "", talk: false });
    await connectSync(bareRepo(), h);
    syncOff(h);
    expect(readSettings(h.settingsFile).sync.enabled).toBe(false);
    expect(existsSync(join(h.plansDir, ".git"))).toBe(true);
  });
});
