// `progressor-mcp sync connect [owner/repo | URL]`: points this computer at the one private git repo
// that keeps every project's plan (plan sync). With no repo given it uses the GitHub CLI (gh) to find
// the Developer's private progressor-plans repo, or to make it, so the AI can run it on each computer
// with nothing to fill in. It clones the repo to ~/.progressor/plans and turns sync on in Settings;
// `sync off` turns it off again (the clone stays, so turning it back on is quick).
import { execFile } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultRegistryFile } from "../dashboard/registry.js";
import { defaultSettingsFile, readSettings, writeSettings } from "../settings.js";

/** Runs a command and gives its output; rejects when it fails. Tests pass their own. */
export type Run = (cmd: string, args: string[], cwd?: string) => Promise<string>;

export const realRun: Run = (cmd, args, cwd) =>
  new Promise((resolveRun, reject) => {
    execFile(cmd, args, { cwd, encoding: "utf8", timeout: 120_000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${String(stderr || err.message).trim()}`));
      else resolveRun(stdout);
    });
  });

/** The plans repo's name when the Developer gives none. */
export const PLANS_REPO = "progressor-plans";

/** `~/.progressor/plans`: this computer's clone of the plans repo. */
export function defaultPlansDir(registryFile = defaultRegistryFile()): string {
  return join(dirname(registryFile), "plans");
}

export interface SyncPlaces {
  settingsFile?: string;
  plansDir?: string;
  run?: Run;
}

export interface Connected {
  /** The plans repo's address, as saved in Settings. */
  repo: string;
  /** Whether this call made the repo on GitHub. */
  created: boolean;
  /** Whether this call cloned it (false when this computer already had the clone). */
  cloned: boolean;
  plansDir: string;
}

/** `owner/repo` becomes its GitHub address; a URL or a folder stays as given. */
export function repoUrl(given: string): string {
  const g = given.trim();
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(g) && !existsSync(g)) return `https://github.com/${g.replace(/\.git$/, "")}.git`;
  return g;
}

const GH_HELP =
  "Plan sync needs the GitHub CLI to find or make your private plans repo. Install it from https://cli.github.com and run `gh auth login`, " +
  "or give the repo yourself: `progressor-mcp sync connect <owner/repo or URL>`.";

/** Finds the Developer's private progressor-plans repo on GitHub, or makes it. */
async function findOrCreate(run: Run): Promise<{ repo: string; created: boolean }> {
  let owner: string;
  try {
    owner = (await run("gh", ["api", "user", "--jq", ".login"])).trim();
  } catch (e) {
    throw new Error(`${GH_HELP} (${(e as Error).message})`);
  }
  if (!owner) throw new Error(GH_HELP);
  const name = `${owner}/${PLANS_REPO}`;
  const view = async () => (await run("gh", ["repo", "view", name, "--json", "url", "--jq", ".url"])).trim();
  try {
    return { repo: await view(), created: false };
  } catch {
    // not there yet
  }
  await run("gh", ["repo", "create", name, "--private", "--description", "Progressor plans, synced between computers"]);
  return { repo: await view(), created: true };
}

/** Connects this computer to the plans repo and turns sync on. */
export async function connectSync(given: string | undefined, places: SyncPlaces = {}): Promise<Connected> {
  const run = places.run ?? realRun;
  const settingsFile = places.settingsFile ?? defaultSettingsFile();
  const plansDir = places.plansDir ?? defaultPlansDir();
  const { repo, created } = given?.trim() ? { repo: repoUrl(given), created: false } : await findOrCreate(run);
  if (!repo) throw new Error(GH_HELP);

  let cloned = false;
  let current: string | undefined;
  if (existsSync(join(plansDir, ".git"))) {
    current = (await run("git", ["remote", "get-url", "origin"], plansDir).catch(() => "")).trim();
  }
  if (current !== repo) {
    // A clone of some other repo is kept aside, never mixed with this one's plans.
    if (existsSync(plansDir)) renameSync(plansDir, `${plansDir}-old-${Date.now()}`);
    try {
      await run("git", ["clone", "--quiet", repo, plansDir]);
    } catch (e) {
      throw new Error(`Could not copy the plans repo ${repo} to this computer: ${(e as Error).message}`);
    }
    cloned = true;
  }
  writeSettings(settingsFile, "sync", { enabled: true, repo });
  return { repo, created, cloned, plansDir };
}

/** Turns sync off on this computer; the clone stays. */
export function syncOff(places: SyncPlaces = {}): void {
  writeSettings(places.settingsFile ?? defaultSettingsFile(), "sync", { enabled: false });
}

/** Whether sync is on, and with which repo. */
export function syncSettings(settingsFile = defaultSettingsFile()): { enabled: boolean; repo: string; talk: boolean } {
  return readSettings(settingsFile).sync;
}
