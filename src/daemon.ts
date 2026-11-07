// The background dashboard: `progressor-mcp daemon` (daemonCommand.ts) serves every registered
// project from a small process of its own, so the dashboard stays up with no AI session open. This
// file holds its pure parts: where its files go, the launcher it starts from, the entries that start
// it at login on Windows, macOS and Linux, and its words.
//
// The login entries never name a Progressor version: they run a small launcher in ~/.progressor that
// starts whichever Progressor `daemon.json` names. When a newer Progressor takes the dashboard over,
// the background process points `daemon.json` at the newer one and starts again from it.
import { dirname, join, posix, win32 } from "node:path";

/** The name of the login entry (a Startup-folder script, a LaunchAgent, a systemd unit). */
export const DAEMON_NAME = "progressor-dashboard";

/**
 * The JavaScript heap cap, in MB. The dashboard holds the plans it shows and little else, so a
 * modest cap keeps it small and makes the garbage collector tidy up early.
 */
export const MAX_OLD_SPACE_MB = 96;

export interface DaemonFiles {
  /** `~/.progressor`, beside the project list. */
  dir: string;
  /** What the background process is and which Progressor it runs (DaemonState). */
  state: string;
  /** Its output. */
  log: string;
  /** The launcher the login entries run. */
  launcher: string;
}

export function daemonFiles(registryFile: string): DaemonFiles {
  const dir = dirname(registryFile);
  return { dir, state: join(dir, "daemon.json"), log: join(dir, "daemon.log"), launcher: join(dir, "daemon-launch.mjs") };
}

/** What `daemon.json` keeps. */
export interface DaemonState {
  /** The Progressor CLI (dist/cli.js) the launcher runs: the newest one this process has seen. */
  cli: string;
  /** Older CLIs, tried in turn if `cli` has been removed. */
  fallback?: string[];
  /** The port asked for (PROGRESSOR_PORT when it was set up), else 4747. */
  port?: number;
  /** The login entry made by `install`: "startup", "launchagent", "systemd" or "autostart". */
  loginItem?: string;
  /** The login entry's name, when it is not the usual one (tests). */
  name?: string;
}

/** node's arguments for the background process. */
export const nodeArgs = (launcher: string): string[] => [`--max-old-space-size=${MAX_OLD_SPACE_MB}`, launcher];

/** The launcher: picks the CLI from daemon.json beside it and runs `daemon run` in the same process. */
export function launcherSource(): string {
  return `// Written by \`progressor-mcp daemon\`: starts Progressor's background dashboard with the newest
// Progressor it knows of (daemon.json, beside this file). Safe to delete with \`progressor-mcp daemon uninstall\`.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const state = JSON.parse(readFileSync(here("./daemon.json"), "utf8"));
const cli = [state.cli, ...(state.fallback ?? [])].find((c) => typeof c === "string" && existsSync(c));
if (!cli) {
  console.error("progressor: the Progressor this background dashboard ran has been removed. Run: npx -y progressor-mcp daemon install");
  process.exit(1);
}
process.env.PROGRESSOR_REGISTRY ??= here("./projects.json");
if (state.port && !process.env.PROGRESSOR_PORT) process.env.PROGRESSOR_PORT = String(state.port);
process.argv = [process.argv[0], cli, "daemon", "run"];
await import(pathToFileURL(cli).href);
`;
}

/** A program to run, with its arguments. */
export interface Run {
  command: string;
  args: string[];
}

export interface LoginItemPlan {
  /** What kind of entry this is, for daemon.json. */
  kind: string;
  /** In words, for what install prints. */
  describe: string;
  /** Files to write. */
  files: { path: string; content: string }[];
  /** Then run these, in order; all must work. */
  run: Run[];
  /** Whether running them also starts the background dashboard now. */
  startsItself: boolean;
  /** Tried when `run` fails. */
  fallback?: LoginItemPlan;
  /** What uninstall removes (failures are ignored: the entry may already be gone). */
  remove: { run: Run[]; files: string[] };
}

export interface LoginItemEnv {
  platform: NodeJS.Platform;
  home: string;
  /** %APPDATA% on Windows. */
  appData?: string;
  /** XDG_CONFIG_HOME on Linux. */
  configHome?: string;
  /** The user's ID on macOS, for launchctl. */
  uid?: number;
  /** The node program. */
  node: string;
  /** The background dashboard's folder (DaemonFiles.dir). */
  dir: string;
  /** The entry's name (DAEMON_NAME, or a test name). */
  name: string;
}

/** A string in VBScript quotes. */
export const vbsQuote = (s: string) => `"${s.replace(/"/g, '""')}"`;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shellQuote = (s: string) => `"${s.replace(/(["\\$`])/g, "\\$1")}"`;

/** The login entry that starts the background dashboard for this user, without admin rights. */
export function loginItem(env: LoginItemEnv): LoginItemPlan {
  const path = env.platform === "win32" ? win32 : posix;
  const launcher = path.join(env.dir, "daemon-launch.mjs");
  const command = [env.node, ...nodeArgs(launcher)];
  const log = path.join(env.dir, "daemon.log");

  if (env.platform === "win32") {
    // A script in the Startup folder: Task Scheduler refuses logon tasks to anyone who isn't an
    // admin. Windows runs it with wscript, which shows no window; node itself is a console program
    // and would show one.
    const startup = path.join(env.appData ?? path.join(env.home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", `${env.name}.vbs`);
    const line = command.map((c) => `"${c}"`).join(" ");
    const content =
      `' Starts Progressor's background dashboard with no window (progressor-mcp daemon install).\r\n` +
      `CreateObject("WScript.Shell").Run ${vbsQuote(line)}, 0, False\r\n`;
    return {
      kind: "startup",
      describe: "a script in your Startup folder",
      files: [{ path: startup, content }],
      run: [],
      startsItself: false,
      // and a task by this name, made by an earlier build that tried Task Scheduler first
      remove: { run: [{ command: "schtasks", args: ["/Delete", "/TN", env.name, "/F"] }], files: [startup] },
    };
  }

  if (env.platform === "darwin") {
    const label = `com.progressor.${env.name.replace(/^progressor-/, "")}`;
    const plist = path.join(env.home, "Library", "LaunchAgents", `${label}.plist`);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Progressor's background dashboard (progressor-mcp daemon install). -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
${command.map((c) => `    <string>${xml(c)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(log)}</string>
</dict>
</plist>
`;
    const remove = { run: [{ command: "launchctl", args: ["bootout", `gui/${env.uid ?? 501}/${label}`] }], files: [plist] };
    const files = [{ path: plist, content }];
    return {
      kind: "launchagent",
      describe: `a LaunchAgent (${plist})`,
      files,
      run: [{ command: "launchctl", args: ["bootstrap", `gui/${env.uid ?? 501}`, plist] }],
      startsItself: true,
      fallback: { kind: "launchagent", describe: `a LaunchAgent (${plist})`, files, run: [{ command: "launchctl", args: ["load", "-w", plist] }], startsItself: true, remove },
      remove,
    };
  }

  // Linux and the other Unixes: a systemd user unit, or an XDG autostart entry where there is no systemd.
  const config = env.configHome ?? path.join(env.home, ".config");
  const unitName = `${env.name}.service`;
  const unit = path.join(config, "systemd", "user", unitName);
  const desktop = path.join(config, "autostart", `${env.name}.desktop`);
  const exec = command.map(shellQuote).join(" ");
  const remove = {
    run: [
      { command: "systemctl", args: ["--user", "disable", "--now", unitName] },
      { command: "systemctl", args: ["--user", "daemon-reload"] },
    ],
    files: [unit, desktop],
  };
  return {
    kind: "systemd",
    describe: `a systemd user service "${unitName}"`,
    files: [
      {
        path: unit,
        content: `# Progressor's background dashboard (progressor-mcp daemon install).
[Unit]
Description=Progressor dashboard in the background

[Service]
ExecStart=${exec}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
`,
      },
    ],
    run: [
      { command: "systemctl", args: ["--user", "daemon-reload"] },
      { command: "systemctl", args: ["--user", "enable", "--now", unitName] },
    ],
    startsItself: true,
    fallback: {
      kind: "autostart",
      describe: `an autostart entry (${desktop})`,
      files: [
        {
          path: desktop,
          content: `[Desktop Entry]
Type=Application
Name=Progressor dashboard
Comment=Progressor's dashboard in the background (progressor-mcp daemon install)
Exec=${exec}
NoDisplay=true
X-GNOME-Autostart-enabled=true
`,
        },
      ],
      run: [],
      startsItself: false,
      remove,
    },
    remove,
  };
}

export type DaemonAction = { action: "start" | "stop" | "status" | "install" | "uninstall" | "run" | "help"; name?: string } | { action: "unknown"; word: string };

const ACTIONS = ["start", "stop", "status", "install", "uninstall", "run"] as const;

export function parseDaemonArgs(args: string[]): DaemonAction {
  const word = args.find((a) => !a.startsWith("-"));
  const at = args.indexOf("--name");
  const name = at >= 0 ? args[at + 1] : undefined;
  if (!word || args.includes("--help") || args.includes("-h")) return { action: "help" };
  if (!(ACTIONS as readonly string[]).includes(word)) return { action: "unknown", word };
  return name ? { action: word as (typeof ACTIONS)[number], name } : { action: word as (typeof ACTIONS)[number] };
}

/** What `status` and the Settings page know about the running background dashboard. */
export interface DaemonStatus {
  pid: number;
  port: number;
  version: string;
  /** The process's own memory, in bytes: private bytes on Windows, private pages on Linux, else resident memory. */
  memory: number;
  /** Whether it serves the dashboard itself, rather than sharing a newer Progressor's. */
  serving: boolean;
  startedAt: string;
}

const mb = (bytes: number) => `about ${Math.round(bytes / 1_048_576)} MB`;

/** The private pages (clean and dirty) in Linux's /proc/<pid>/smaps_rollup, in bytes. */
export function privateFromSmaps(text: string): number | undefined {
  let kb = 0;
  let found = false;
  for (const m of text.matchAll(/^Private_(?:Clean|Dirty):\s+(\d+) kB$/gm)) {
    kb += Number(m[1]);
    found = true;
  }
  return found ? kb * 1024 : undefined;
}

export function describeStatus(s: DaemonStatus | undefined): string {
  if (!s) return "The background dashboard is not running.";
  const url = `http://localhost:${s.port}/`;
  if (s.serving) return `The background dashboard is running: ${url}, version ${s.version}, process ${s.pid}, ${mb(s.memory)} of memory.`;
  return `The background dashboard is running (version ${s.version}, process ${s.pid}, ${mb(s.memory)} of memory). Another Progressor process serves ${url} right now; this one takes over when it closes.`;
}
