// Fake computers for the plan-sync tests: each has its own settings and plans folder and its own project
// folder; they all share one local bare git repo, and their projects share a git address, so they match.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeSettings } from "../src/settings.js";
import { connectSync } from "../src/sync/connect.js";
import { type SyncDeps, syncOnce } from "../src/sync/run.js";
import { tempDir } from "./tmp.js";

export const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function bareRepo(): string {
  const dir = join(tempDir("progressor-bare-"), "plans.git");
  mkdirSync(dir);
  git(dir, "init", "-q", "--bare");
  return dir;
}

export const T1 = "2026-03-01T10:00:00.000Z";
export const T2 = "2026-03-02T10:00:00.000Z";
export const T3 = "2026-03-03T10:00:00.000Z";

export const ROADMAP = `# Roadmap

## Goals

- [ ] Login ^login
  - outcome: People can sign in
  - updated: ${T1} by AI
`;

/** A goal file with two steps; each step's wording and last-changed time can be set. */
export const goalFile = (a = "Build the form", b = "Add tests", at = T1, bt = T1) => `# Login

## Tasks

- [ ] ${a} ^t1
  - files: src/form.ts
  - updated: ${at} by AI
- [ ] ${b} ^t2
  - files: test/form.test.ts
  - updated: ${bt} by AI

## Notes
`;

export interface Computer {
  name: string;
  root: string;
  settingsFile: string;
  plansDir: string;
  deps: () => SyncDeps;
  sync: () => ReturnType<typeof syncOnce>;
  read: (rel: string) => string | undefined;
  write: (rel: string, text: string | Buffer) => void;
  exists: (rel: string) => boolean;
}

/** A computer connected to `bare`, with a project that has the git address github.com/acme/app. */
export async function computer(name: string, bare: string, options: { talk?: boolean; remote?: string } = {}): Promise<Computer> {
  const home = tempDir(`progressor-${name}-`);
  const settingsFile = join(home, "settings.json");
  const plansDir = join(home, "plans");
  await connectSync(bare, { settingsFile, plansDir });
  if (options.talk) writeSettings(settingsFile, "sync", { talk: true });
  const root = tempDir(`progressor-${name}-project-`);
  git(root, "init", "-q");
  git(root, "remote", "add", "origin", options.remote ?? "https://github.com/acme/app.git");
  const linksFile = join(home, "sync-links.json");
  const deps = (): SyncDeps => ({ settingsFile, plansDir, projects: [root], host: name, linksFile });
  const path = (rel: string) => join(root, ".progressor", rel);
  return {
    name,
    root,
    settingsFile,
    plansDir,
    deps,
    sync: () => syncOnce(deps()),
    read: (rel) => (existsSync(path(rel)) ? readFileSync(path(rel), "utf8") : undefined),
    write: (rel, text) => {
      mkdirSync(dirname(path(rel)), { recursive: true });
      writeFileSync(path(rel), text);
    },
    exists: (rel) => existsSync(path(rel)),
  };
}
