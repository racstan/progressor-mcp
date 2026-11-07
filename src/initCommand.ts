// `progressor-mcp init [folder] [--yes] [--remove] [--no-server]`: shows what it will change, asks once, then does it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  type Change,
  type Launch,
  type LocalStep,
  applyChanges,
  desktopConfigs,
  desktopProject,
  launchFor,
  pickTargets,
  planDesktop,
  planDesktopRemove,
  planInit,
  planLocal,
  planLocalRemove,
  planRemove,
  startedViaNpx,
} from "./init.js";

const USAGE = `Usage: progressor-mcp init [folder] [--code | --desktop | --all] [--yes] [--no-server]
       progressor-mcp init [folder] --remove [--yes]

Sets up a project (the current folder by default) for Progressor and Claude Code: registers the MCP
server in .mcp.json, adds the status hooks to .claude/settings.json, adds a short note for the Agent
to CLAUDE.md and AGENTS.md and creates .progressor/roadmap.md, with a .gitignore that keeps the new plan
out of git until you choose to share it. It lists the changes and asks before making them;
--yes skips the question. --no-server leaves .mcp.json alone, for an app that already runs
Progressor in every folder. --remove takes them out again and leaves .progressor/ alone.

By default it sets up Claude Code in the project and, if the Claude Desktop chat app is installed,
Claude Desktop too. --code does only the project, --desktop only Claude Desktop, --all both. Claude
Desktop works on one project folder at a time (this one); your AI can reach other projects with the
project parameter. When it is done, init starts Progressor once to check that it runs.

.mcp.json gets a command that works on Windows, macOS and Linux alike, so it can be shared. On
Windows, init also asks Claude Code to start Progressor through cmd /c in this folder on this
computer only (claude mcp add --scope local).`;

/** Claude Code's own settings, only read: init changes them through the claude command. */
function claudeConfig(): Record<string, any> | undefined {
  try {
    return JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));
  } catch {
    return undefined;
  }
}

/** Runs the step's claude commands; on failure, says what to run by hand. Windows needs a shell to find claude.cmd. */
function runLocal(root: string, step: LocalStep): boolean {
  for (const args of step.commands) {
    const r = spawnSync("claude", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    if (r.error || r.status !== 0) {
      console.error(
        `\nprogressor: couldn't run claude to ${step.what}. In this folder, run:\n` +
          step.commands.map((a) => `  claude ${a.join(" ")}`).join("\n"),
      );
      return false;
    }
  }
  return true;
}

export interface RunResult {
  status: number | null;
  stdout: string;
  error?: Error;
}
type Runner = (command: string, args: string[]) => RunResult;

const spawnRunner: Runner = (command, args) => {
  const r = spawnSync(command, args, { encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout ?? "", error: r.error };
};

/** Starts the server the way the apps will (`--version`), to see that the command works on this computer. */
export function checkServer(launch: Launch, run: Runner = spawnRunner): { ok: true; version: string } | { ok: false } {
  const how = launch.local ?? launch.server;
  const r = run(how.command, [...how.args, "--version"]);
  if (r.error || r.status !== 0) return { ok: false };
  return { ok: true, version: r.stdout.trim() };
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

function reportCheck(launch: Launch): void {
  const check = checkServer(launch);
  console.log(
    check.ok
      ? `Checked: Progressor starts fine on this computer (version ${check.version}).`
      : "Warning: I couldn't start Progressor to check it. Make sure it is installed (npm install -g progressor-mcp) and try again.",
  );
}

export async function runInitCommand(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const root = resolve(args.find((a) => !a.startsWith("-")) ?? process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`progressor: ${root} is not a folder.\n\n${USAGE}`);
    return 1;
  }
  const remove = args.includes("--remove");
  const noServer = args.includes("--no-server");
  const viaNpx = startedViaNpx();
  const launch = launchFor({ viaNpx, platform: process.platform });
  const found = desktopConfigs({ env: process.env, platform: process.platform, home: homedir() });
  const targets = pickTargets(args, found);
  const wantsDesktop = args.includes("--desktop") || args.includes("--all");
  if (args.includes("--desktop") && found.length === 0) {
    console.error("progressor: Claude Desktop doesn't seem to be installed on this computer, so there is nothing to set up. Install it, open it once, and run this again.");
    return 1;
  }
  let changes: Change[] = [];
  const desktopChanges: Change[] = [];
  try {
    if (targets.code) changes = remove ? planRemove(root) : planInit(root, launch, { server: !noServer });
    for (const path of targets.desktop) {
      const c = remove
        ? planDesktopRemove(path, args.includes("--desktop") ? undefined : root)
        : planDesktop(root, launch, path, { switchProject: wantsDesktop });
      if (c) desktopChanges.push(c);
      else if (!remove && !wantsDesktop && desktopProject(path) !== undefined && desktopProject(path) !== root)
        console.log(`Claude Desktop stays on ${desktopProject(path)}. To switch it to this folder, run this again with --desktop.
`);
    }
  } catch (e) {
    console.error(`progressor: ${(e as Error).message}`);
    return 1;
  }
  const local = !targets.code ? undefined : remove ? planLocalRemove(root, claudeConfig()) : noServer ? undefined : planLocal(root, launch, claudeConfig());
  if (wantsDesktop && !args.includes("--desktop") && found.length === 0) console.log("Claude Desktop doesn't seem to be installed here, so only Claude Code is set up.\n");

  if (changes.length === 0 && desktopChanges.length === 0 && !local) {
    console.log(remove ? `Progressor is not set up in ${root}; nothing to remove.` : `Progressor is already set up in ${root}; nothing to change.`);
    if (!remove) reportCheck(launch);
    return 0;
  }
  console.log(`${remove ? "Removing Progressor from" : "Setting up Progressor in"} ${root}:\n`);
  for (const c of [...changes, ...desktopChanges])
    console.log(`  ${c.contents === null ? "delete" : existsSync(c.path) ? "change" : "create"} ${c.file}: ${c.what}`);
  if (local) console.log(`  run claude: ${local.what}`);
  console.log("");

  if (!args.includes("--yes") && !args.includes("-y")) {
    if (!process.stdin.isTTY) {
      console.log("Run it again with --yes to make these changes.");
      return 1;
    }
    if (!(await confirm("Make these changes? [y/N] "))) {
      console.log("Nothing changed.");
      return 0;
    }
  }
  applyChanges([...changes, ...desktopChanges]);
  if (local && !runLocal(root, local)) return 1;

  if (remove) {
    console.log("Done. The progress record in .progressor/ is still there; delete it yourself if you no longer want it.");
    return 0;
  }
  const done: string[] = [];
  if (changes.length > 0 || local) done.push("Claude Code is set up in this folder");
  if (desktopChanges.length > 0) done.push("Claude Desktop is set up to use this folder as its project");
  console.log(`Done: ${done.join(", and ")}.`);
  reportCheck(launch);
  if (desktopChanges.length > 0)
    console.log(
      "Quit Claude Desktop completely and open it again. It works on this one project folder; your AI can reach your other projects by naming them in the project parameter.",
    );
  if (targets.code)
    console.log(
      noServer
        ? "Progressor's tools work right away; the hooks and the notes in CLAUDE.md and AGENTS.md take effect from the next conversation."
        : "Restart Claude Code in this folder to load Progressor, then ask the Agent to plan a Goal.",
    );
  console.log("See every project's progress with: progressor-mcp dashboard");
  if (viaNpx)
    console.log(
      "\nThis ran through npx, so the hooks do too, and npx adds about 1.5 seconds to every message. For a faster setup, run\n" +
        `  npm install -g progressor-mcp\n  progressor-mcp init${noServer ? " --no-server" : ""}\n` +
        "which switches the server and the hooks to the global command.",
    );
  return 0;
}
