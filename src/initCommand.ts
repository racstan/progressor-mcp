// `progressor-mcp init [folder] [--yes] [--remove] [--no-server]`: shows what it will change, asks once, then does it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { type Change, type LocalStep, applyChanges, launchFor, planInit, planLocal, planLocalRemove, planRemove, startedViaNpx } from "./init.js";

const USAGE = `Usage: progressor-mcp init [folder] [--yes] [--no-server]
       progressor-mcp init [folder] --remove [--yes]

Sets up a project (the current folder by default) for Progressor and Claude Code: registers the MCP
server in .mcp.json, adds the status hooks to .claude/settings.json, adds a short note for the Agent
to CLAUDE.md and AGENTS.md and creates .progressor/roadmap.md, with a .gitignore that keeps the new plan
out of git until you choose to share it. It lists the changes and asks before making them;
--yes skips the question. --no-server leaves .mcp.json alone, for an app that already runs
Progressor in every folder. --remove takes them out again and leaves .progressor/ alone.

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

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
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
  let changes: Change[];
  try {
    changes = remove ? planRemove(root) : planInit(root, launch, { server: !noServer });
  } catch (e) {
    console.error(`progressor: ${(e as Error).message}`);
    return 1;
  }
  const local = remove ? planLocalRemove(root, claudeConfig()) : noServer ? undefined : planLocal(root, launch, claudeConfig());

  if (changes.length === 0 && !local) {
    console.log(remove ? `Progressor is not set up in ${root}; nothing to remove.` : `Progressor is already set up in ${root}; nothing to change.`);
    return 0;
  }
  console.log(`${remove ? "Removing Progressor from" : "Setting up Progressor in"} ${root}:\n`);
  for (const c of changes) console.log(`  ${c.contents === null ? "delete" : existsSync(c.path) ? "change" : "create"} ${c.file}: ${c.what}`);
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
  applyChanges(changes);
  if (local && !runLocal(root, local)) return 1;

  if (remove) {
    console.log("Done. The progress record in .progressor/ is still there; delete it yourself if you no longer want it.");
    return 0;
  }
  console.log(
    noServer
      ? "Done. Progressor's tools work right away; the hooks and the notes in CLAUDE.md and AGENTS.md take effect from the next conversation."
      : "Done. Restart Claude Code in this folder to load Progressor, then ask the Agent to plan a Goal.",
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
