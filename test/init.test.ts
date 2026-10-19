import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type Launch, applyChanges, launchFor, planInit, planRemove } from "../src/init.js";
import { tempDir } from "./tmp.js";

let root: string;
const global: Launch = launchFor({ viaNpx: false, platform: "linux" });
const npx: Launch = launchFor({ viaNpx: true, platform: "linux" });

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
  it("uses the global command, or npx, wrapped in cmd /c on Windows for the server", () => {
    expect(global).toEqual({ server: { command: "progressor-mcp", args: [] }, hook: "progressor-mcp hook" });
    expect(npx).toEqual({ server: { command: "npx", args: ["-y", "progressor-mcp"] }, hook: "npx -y progressor-mcp hook" });
    expect(launchFor({ viaNpx: false, platform: "win32" }).server).toEqual({ command: "cmd", args: ["/c", "progressor-mcp"] });
  });
});

describe("init", () => {
  it("sets up a fresh project: server, hooks, a note for the Agent and an empty Roadmap", () => {
    const changes = planInit(root, global);
    expect(changes.map((c) => c.file)).toEqual([".mcp.json", ".claude/settings.json", "CLAUDE.md", ".progressor/roadmap.md"]);
    applyChanges(changes);

    expect(json(".mcp.json")).toEqual({ mcpServers: { progressor: { command: "progressor-mcp", args: [] } } });
    expect(json(".claude/settings.json")).toEqual({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "progressor-mcp hook session-start" }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "progressor-mcp hook prompt" }] }],
      },
    });
    expect(read("CLAUDE.md")).toMatch(/^<!-- progressor:start -->\n## Progressor\n[\s\S]*get_status[\s\S]*<!-- progressor:end -->\n$/);
    expect(read(".progressor/roadmap.md")).toBe("# Roadmap\n");
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
    init();
    applyChanges(planRemove(root));

    expect(json(".mcp.json")).toEqual({ mcpServers: { github: { command: "gh-mcp" } } });
    expect(existsSync(join(root, ".claude/settings.json"))).toBe(false);
    expect(read("CLAUDE.md")).toBe("# My project\n");
    expect(read(".progressor/roadmap.md")).toBe("# Roadmap\n");
    expect(planRemove(root)).toEqual([]);
  });

  it("deletes files that held nothing but Progressor's entries", () => {
    init(npx);
    applyChanges(planRemove(root));
    for (const f of [".mcp.json", ".claude/settings.json", "CLAUDE.md"]) expect(existsSync(join(root, f))).toBe(false);
  });
});
