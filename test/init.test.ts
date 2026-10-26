import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type Launch, applyChanges, launchFor, onPath, planInit, planLocal, planLocalRemove, planRemove, startedViaNpx } from "../src/init.js";
import { tempDir } from "./tmp.js";

let root: string;
const global: Launch = launchFor({ viaNpx: false, platform: "linux" });
const npx: Launch = launchFor({ viaNpx: true, platform: "linux" });
const windows: Launch = launchFor({ viaNpx: false, platform: "win32" });

const read = (path: string) => readFileSync(join(root, path), "utf8");
const json = (path: string) => JSON.parse(read(path));
const write = (path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
const init = (launch = global) => applyChanges(planInit(root, launch));

beforeEach(() => {
  root = tempDir("progressor-init-");
});

describe("how Progressor is started", () => {
  it("tells an npx start from a global install, on Windows and elsewhere", () => {
    expect(startedViaNpx(String.raw`C:\Users\dev\AppData\Local\npm-cache\_npx\1a2b\node_modules\progressor-mcp\dist\cli.js`)).toBe(true);
    expect(startedViaNpx("/home/dev/.npm/_npx/1a2b/node_modules/progressor-mcp/dist/cli.js")).toBe(true);
    expect(startedViaNpx(String.raw`C:\Users\dev\AppData\Roaming\npm\node_modules\progressor-mcp\dist\cli.js`)).toBe(false);
    expect(startedViaNpx("/usr/lib/node_modules/progressor-mcp/dist/cli.js")).toBe(false);
  });

  it("uses the global command, or npx, the same on every system for the shared server entry", () => {
    expect(global).toEqual({ server: { command: "progressor-mcp", args: [] }, hook: "progressor-mcp hook" });
    expect(npx).toEqual({ server: { command: "npx", args: ["-y", "progressor-mcp"] }, hook: "npx -y progressor-mcp hook" });
    expect(global.local).toBeUndefined();
    expect(windows.server).toEqual({ command: "progressor-mcp", args: [] });
  });

  it("wraps the command in cmd /c for this computer only on Windows", () => {
    expect(windows.local).toEqual({ command: "cmd", args: ["/c", "progressor-mcp"] });
    expect(launchFor({ viaNpx: true, platform: "win32" }).local).toEqual({ command: "cmd", args: ["/c", "npx", "-y", "progressor-mcp"] });
  });
});

describe("onPath", () => {
  it("finds a command in a PATH folder, with Windows' extensions on Windows", () => {
    write("bin/progressor-mcp", "");
    write("win/progressor-mcp.CMD", "");
    const bin = join(root, "bin");
    const win = join(root, "win");
    expect(onPath("progressor-mcp", { PATH: `/nowhere${delimiter}${bin}` }, "linux")).toBe(true);
    expect(onPath("cmd", { PATH: bin }, "linux")).toBe(false);
    expect(onPath("progressor-mcp", { Path: win, PATHEXT: ".COM;.EXE;.CMD" }, "win32")).toBe(true);
    expect(onPath("progressor-mcp", { PATH: win }, "linux")).toBe(false);
    expect(onPath(join(bin, "progressor-mcp"), {}, "linux")).toBe(true);
    expect(onPath("progressor-mcp", {}, "linux")).toBe(false);
  });
});

describe("the Windows launcher for this computer", () => {
  const add = ["mcp", "add", "--scope", "local", "progressor", "--", "cmd", "/c", "progressor-mcp"];
  const remove = ["mcp", "remove", "--scope", "local", "progressor"];
  const config = (key: string, server: unknown) => ({ projects: { [key]: { mcpServers: { progressor: server } } } });

  it("registers the cmd /c command in Claude Code's local settings for this folder", () => {
    expect(planLocal(root, windows, undefined)?.commands).toEqual([add]);
    expect(planLocal(root, windows, {})?.commands).toEqual([add]);
  });

  it("does nothing when it is already registered, whichever slashes the folder is written with", () => {
    const local = { type: "stdio", command: "cmd", args: ["/c", "progressor-mcp"], env: {} };
    expect(planLocal(root, windows, config(root, local))).toBeUndefined();
    expect(planLocal(String.raw`C:\Users\dev\app`, windows, config("C:/Users/dev/app", local))).toBeUndefined();
  });

  it("replaces a local entry that starts Progressor another way", () => {
    const old = { type: "stdio", command: "cmd", args: ["/c", "npx", "-y", "progressor-mcp"], env: {} };
    expect(planLocal(root, windows, config(root, old))?.commands).toEqual([remove, add]);
  });

  it("is not needed outside Windows", () => {
    expect(planLocal(root, global, {})).toBeUndefined();
  });

  it("is taken out again by --remove", () => {
    expect(planLocalRemove(root, config(root, { command: "cmd", args: ["/c", "progressor-mcp"] }))?.commands).toEqual([remove]);
    expect(planLocalRemove(root, {})).toBeUndefined();
    expect(planLocalRemove(root, undefined)).toBeUndefined();
  });
});

describe("init", () => {
  it("leaves .mcp.json alone without the server, for an app that already runs Progressor", () => {
    const changes = planInit(root, global, { server: false });
    expect(changes.map((c) => c.file)).toEqual([".claude/settings.json", "CLAUDE.md", "AGENTS.md", ".progressor/roadmap.md"]);
    applyChanges(changes);
    expect(existsSync(join(root, ".mcp.json"))).toBe(false);
    expect(planInit(root, global, { server: false })).toEqual([]);
  });

  it("sets up a fresh project: server, hooks, a note for the Agent and an empty Roadmap", () => {
    const changes = planInit(root, global);
    expect(changes.map((c) => c.file)).toEqual([".mcp.json", ".claude/settings.json", "CLAUDE.md", "AGENTS.md", ".progressor/roadmap.md"]);
    applyChanges(changes);

    expect(json(".mcp.json")).toEqual({ mcpServers: { progressor: { command: "progressor-mcp", args: [] } } });
    expect(json(".claude/settings.json")).toEqual({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "progressor-mcp hook session-start" }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "progressor-mcp hook prompt" }] }],
      },
    });
    expect(read("CLAUDE.md")).toMatch(/^<!-- progressor:start -->\n## Progressor\n[\s\S]*get_status[\s\S]*<!-- progressor:end -->\n$/);
    expect(read("AGENTS.md")).toBe(read("CLAUDE.md"));
    expect(read(".progressor/roadmap.md")).toBe("# Roadmap\n");
  });

  it("adds the note to an AGENTS.md that other apps already read, keeping what is there", () => {
    write("AGENTS.md", "# Agents\n\nRun npm test.\n");
    init();
    expect(read("AGENTS.md")).toMatch(/^# Agents\n\nRun npm test\.\n\n<!-- progressor:start -->[\s\S]*<!-- progressor:end -->\n$/);
  });

  it("changes nothing the second time", () => {
    init();
    expect(planInit(root, global)).toEqual([]);
  });

  it("keeps everything else in existing files", () => {
    write(".mcp.json", JSON.stringify({ mcpServers: { github: { command: "gh-mcp" } }, other: 1 }));
    write(
      ".claude/settings.json",
      JSON.stringify({ model: "opus", hooks: { SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "echo hi" }] }] } }),
    );
    write("CLAUDE.md", "# My project\n\nUse tabs.\n");
    write(".progressor/roadmap.md", "# Roadmap\n\n## Goals\n\n- [ ] [A](goals/a.md) ^a\n");
    init();

    expect(json(".mcp.json")).toEqual({
      mcpServers: { github: { command: "gh-mcp" }, progressor: { command: "progressor-mcp", args: [] } },
      other: 1,
    });
    const settings = json(".claude/settings.json");
    expect(settings.model).toBe("opus");
    expect(settings.hooks.SessionStart).toEqual([
      { matcher: "startup", hooks: [{ type: "command", command: "echo hi" }] },
      { hooks: [{ type: "command", command: "progressor-mcp hook session-start" }] },
    ]);
    expect(read("CLAUDE.md")).toMatch(/^# My project\n\nUse tabs\.\n\n<!-- progressor:start -->/);
    expect(read(".progressor/roadmap.md")).toContain("^a");
  });

  it("writes a command to .mcp.json that works on every system, even when run on Windows", () => {
    applyChanges(planInit(root, windows));
    expect(json(".mcp.json")).toEqual({ mcpServers: { progressor: { command: "progressor-mcp", args: [] } } });
  });

  it("replaces a Windows-only cmd /c entry from an older setup", () => {
    write(".mcp.json", JSON.stringify({ mcpServers: { progressor: { command: "cmd", args: ["/c", "progressor-mcp"] } } }));
    const changes = planInit(root, global);
    expect(changes.find((c) => c.file === ".mcp.json")?.what).toBe('update the "progressor" MCP server (progressor-mcp)');
    applyChanges(changes);
    expect(json(".mcp.json").mcpServers.progressor).toEqual({ command: "progressor-mcp", args: [] });
  });

  it("switches from npx to the global command when run again after a global install", () => {
    init(npx);
    const changes = planInit(root, global);
    expect(changes.map((c) => c.file)).toEqual([".mcp.json", ".claude/settings.json"]);
    applyChanges(changes);
    expect(json(".mcp.json").mcpServers.progressor.command).toBe("progressor-mcp");
    expect(json(".claude/settings.json").hooks.UserPromptSubmit).toEqual([
      { hooks: [{ type: "command", command: "progressor-mcp hook prompt" }] },
    ]);
  });

  it("refuses to touch a settings file it cannot read", () => {
    write(".claude/settings.json", "{ not json");
    expect(() => planInit(root, global)).toThrow(/\.claude[\\/]settings\.json is not valid JSON/);
  });
});

describe("init --remove", () => {
  it("takes out only what init added and keeps the progress record", () => {
    write(".mcp.json", JSON.stringify({ mcpServers: { github: { command: "gh-mcp" } } }));
    write("CLAUDE.md", "# My project\n");
    write("AGENTS.md", "# Agents\n");
    init();
    applyChanges(planRemove(root));

    expect(json(".mcp.json")).toEqual({ mcpServers: { github: { command: "gh-mcp" } } });
    expect(existsSync(join(root, ".claude/settings.json"))).toBe(false);
    expect(read("CLAUDE.md")).toBe("# My project\n");
    expect(read("AGENTS.md")).toBe("# Agents\n");
    expect(read(".progressor/roadmap.md")).toBe("# Roadmap\n");
    expect(planRemove(root)).toEqual([]);
  });

  it("deletes files that held nothing but Progressor's entries", () => {
    init(npx);
    applyChanges(planRemove(root));
    for (const f of [".mcp.json", ".claude/settings.json", "CLAUDE.md", "AGENTS.md"]) expect(existsSync(join(root, f))).toBe(false);
  });
});
