import { describe, expect, it } from "vitest";
import {
  DAEMON_NAME,
  MAX_OLD_SPACE_MB,
  daemonFiles,
  describeStatus,
  launcherSource,
  loginItem,
  nodeArgs,
  parseDaemonArgs,
  privateFromSmaps,
  vbsQuote,
} from "../src/daemon.js";

const win = {
  platform: "win32" as const,
  home: "C:\\Users\\Ada",
  appData: "C:\\Users\\Ada\\AppData\\Roaming",
  node: "C:\\Program Files\\nodejs\\node.exe",
  dir: "C:\\Users\\Ada\\.progressor",
  name: DAEMON_NAME,
};
const mac = { platform: "darwin" as const, home: "/Users/ada", uid: 501, node: "/usr/local/bin/node", dir: "/Users/ada/.progressor", name: DAEMON_NAME };
const linux = { platform: "linux" as const, home: "/home/ada", node: "/usr/bin/node", dir: "/home/ada/.progressor", name: DAEMON_NAME };

describe("the background dashboard's files", () => {
  it("live beside the project list", () => {
    const f = daemonFiles("/home/ada/.progressor/projects.json");
    expect(f.dir).toMatch(/\.progressor$/);
    expect(f.state).toMatch(/daemon\.json$/);
    expect(f.log).toMatch(/daemon\.log$/);
    expect(f.launcher).toMatch(/daemon-launch\.mjs$/);
  });

  it("start node with a small memory cap and the launcher", () => {
    expect(MAX_OLD_SPACE_MB).toBeLessThanOrEqual(128);
    expect(nodeArgs("/x/daemon-launch.mjs")).toEqual([`--max-old-space-size=${MAX_OLD_SPACE_MB}`, "/x/daemon-launch.mjs"]);
  });

  it("has a launcher that runs the Progressor daemon.json names, with the folder's project list", () => {
    const src = launcherSource();
    expect(src).toContain("daemon.json");
    expect(src).toContain("PROGRESSOR_REGISTRY");
    expect(src).toContain('"daemon", "run"');
    expect(src).toContain("existsSync");
  });
});

describe("starting at login on Windows", () => {
  const plan = loginItem(win);
  const startup = "C:\\Users\\Ada\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\progressor-dashboard.vbs";

  it("puts a script in the Startup folder that runs node with no window, needing no admin rights", () => {
    expect(plan.kind).toBe("startup");
    expect(plan.files.map((f) => f.path)).toEqual([startup]);
    const vbs = plan.files[0]!.content;
    expect(vbs).toContain('CreateObject("WScript.Shell").Run');
    expect(vbs).toContain('""C:\\Program Files\\nodejs\\node.exe""');
    expect(vbs).toContain(`--max-old-space-size=${MAX_OLD_SPACE_MB}`);
    expect(vbs).toMatch(/, 0, False\r?\n/);
  });

  it("runs nothing else: Task Scheduler refuses logon tasks to people who aren't admins", () => {
    expect(plan.run).toEqual([]);
    expect(plan.fallback).toBeUndefined();
    expect(plan.startsItself).toBe(false);
    expect(JSON.stringify(plan.run)).not.toContain("schtasks");
  });

  it("removes the Startup script, and a task by that name left from an earlier build, if any", () => {
    expect(plan.remove.files).toEqual([startup]);
    expect(plan.remove.run).toEqual([{ command: "schtasks", args: ["/Delete", "/TN", "progressor-dashboard", "/F"] }]);
  });

  it("finds the Startup folder under the home folder when APPDATA isn't set", () => {
    const { appData: _none, ...rest } = win;
    expect(loginItem(rest).files[0]!.path).toBe(startup);
  });

  it("quotes for VBScript by doubling quotes", () => {
    expect(vbsQuote('a "b" c')).toBe('"a ""b"" c"');
  });
});

describe("starting at login on macOS", () => {
  const plan = loginItem(mac);
  const plist = plan.files[0]!;

  it("writes a LaunchAgent for this user that starts at login", () => {
    expect(plist.path).toBe("/Users/ada/Library/LaunchAgents/com.progressor.dashboard.plist");
    expect(plist.content).toContain("<key>Label</key>\n  <string>com.progressor.dashboard</string>");
    expect(plist.content).toContain("<string>/usr/local/bin/node</string>");
    expect(plist.content).toContain(`<string>--max-old-space-size=${MAX_OLD_SPACE_MB}</string>`);
    expect(plist.content).toContain("<string>/Users/ada/.progressor/daemon-launch.mjs</string>");
    expect(plist.content).toContain("<key>RunAtLoad</key>\n  <true/>");
    expect(plist.content).toContain("/Users/ada/.progressor/daemon.log");
  });

  it("loads it now, with the older launchctl as a fallback", () => {
    expect(plan.run).toEqual([{ command: "launchctl", args: ["bootstrap", "gui/501", plist.path] }]);
    expect(plan.startsItself).toBe(true);
    expect(plan.fallback!.run).toEqual([{ command: "launchctl", args: ["load", "-w", plist.path] }]);
  });

  it("unloads and removes it", () => {
    expect(plan.remove.run).toEqual([{ command: "launchctl", args: ["bootout", "gui/501/com.progressor.dashboard"] }]);
    expect(plan.remove.files).toEqual([plist.path]);
  });

  it("escapes paths for XML", () => {
    const odd = loginItem({ ...mac, node: "/opt/a&b/node" });
    expect(odd.files[0]!.content).toContain("<string>/opt/a&amp;b/node</string>");
  });
});

describe("starting at login on Linux", () => {
  const plan = loginItem(linux);
  const unit = plan.files[0]!;

  it("writes a systemd user unit", () => {
    expect(unit.path).toBe("/home/ada/.config/systemd/user/progressor-dashboard.service");
    expect(unit.content).toContain(`ExecStart="/usr/bin/node" "--max-old-space-size=${MAX_OLD_SPACE_MB}" "/home/ada/.progressor/daemon-launch.mjs"`);
    expect(unit.content).toContain("WantedBy=default.target");
    expect(unit.content).toContain("Restart=on-failure");
  });

  it("enables and starts it for this user", () => {
    expect(plan.run).toEqual([
      { command: "systemctl", args: ["--user", "daemon-reload"] },
      { command: "systemctl", args: ["--user", "enable", "--now", "progressor-dashboard.service"] },
    ]);
    expect(plan.startsItself).toBe(true);
  });

  it("falls back to an XDG autostart entry", () => {
    const fb = plan.fallback!;
    expect(fb.files[0]!.path).toBe("/home/ada/.config/autostart/progressor-dashboard.desktop");
    expect(fb.files[0]!.content).toContain("[Desktop Entry]");
    expect(fb.files[0]!.content).toContain(`Exec="/usr/bin/node" "--max-old-space-size=${MAX_OLD_SPACE_MB}" "/home/ada/.progressor/daemon-launch.mjs"`);
    expect(fb.startsItself).toBe(false);
  });

  it("disables and removes both", () => {
    expect(plan.remove.run).toEqual([
      { command: "systemctl", args: ["--user", "disable", "--now", "progressor-dashboard.service"] },
      { command: "systemctl", args: ["--user", "daemon-reload"] },
    ]);
    expect(plan.remove.files).toEqual([unit.path, "/home/ada/.config/autostart/progressor-dashboard.desktop"]);
  });

  it("follows XDG_CONFIG_HOME", () => {
    expect(loginItem({ ...linux, configHome: "/cfg" }).files[0]!.path).toBe("/cfg/systemd/user/progressor-dashboard.service");
  });

  it("uses a test name everywhere it is given", () => {
    const t = loginItem({ ...linux, name: "progressor-dashboard-test" });
    expect(t.files[0]!.path).toContain("progressor-dashboard-test.service");
    expect(loginItem({ ...mac, name: "progressor-dashboard-test" }).files[0]!.path).toContain("com.progressor.dashboard-test.plist");
    expect(loginItem({ ...win, name: "progressor-dashboard-test" }).files[0]!.path).toMatch(/\\progressor-dashboard-test\.vbs$/);
  });
});

describe("the daemon command's words", () => {
  it("reads the subcommand and options", () => {
    expect(parseDaemonArgs(["start"])).toEqual({ action: "start" });
    expect(parseDaemonArgs(["install", "--name", "progressor-dashboard-test"])).toEqual({ action: "install", name: "progressor-dashboard-test" });
    expect(parseDaemonArgs([])).toEqual({ action: "help" });
    expect(parseDaemonArgs(["--help"])).toEqual({ action: "help" });
    expect(parseDaemonArgs(["frobnicate"])).toEqual({ action: "unknown", word: "frobnicate" });
  });

  it("says plainly whether it runs, and how big it is", () => {
    expect(describeStatus(undefined)).toBe("The background dashboard is not running.");
    expect(
      describeStatus({ pid: 42, port: 4747, version: "1.3.0", memory: 69 * 1_048_576, serving: true, startedAt: "2026-11-07T10:00:00.000Z" }),
    ).toBe("The background dashboard is running: http://localhost:4747/, version 1.3.0, process 42, about 69 MB of memory.");
    expect(describeStatus({ pid: 42, port: 4747, version: "1.2.0", memory: 31.2 * 1_048_576, serving: false, startedAt: "x" })).toBe(
      "The background dashboard is running (version 1.2.0, process 42, about 31 MB of memory). Another Progressor process serves http://localhost:4747/ right now; this one takes over when it closes.",
    );
  });
});

describe("the process's own memory", () => {
  it("adds up its private pages on Linux, from /proc/<pid>/smaps_rollup", () => {
    const rollup = "55d0-7ffd ---p 00000000 00:00 0 [rollup]\nRss:               69000 kB\nShared_Clean:      30000 kB\nPrivate_Clean:      1200 kB\nPrivate_Dirty:     30744 kB\nSwap:                  0 kB\n";
    expect(privateFromSmaps(rollup)).toBe((1200 + 30744) * 1024);
  });

  it("says nothing when the file has no private lines", () => {
    expect(privateFromSmaps("Rss: 100 kB\n")).toBeUndefined();
    expect(privateFromSmaps("")).toBeUndefined();
  });
});
