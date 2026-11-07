import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyChanges,
  desktopConfigs,
  launchFor,
  pickTargets,
  planDesktop,
  planDesktopRemove,
  planInit,
  planRemove,
} from "../src/init.js";
import { checkServer } from "../src/initCommand.js";
import { tempDir } from "./tmp.js";

let root: string;
const global = launchFor({ viaNpx: false, platform: "linux" });
const npx = launchFor({ viaNpx: true, platform: "linux" });
const windows = launchFor({ viaNpx: false, platform: "win32" });

const read = (path: string) => readFileSync(join(root, path), "utf8");
const write = (path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
const dir = (path: string) => mkdirSync(join(root, path), { recursive: true });

beforeEach(() => {
  root = tempDir("progressor-setup-");
});

describe("the note's markers", () => {
  const START = "<!-- progressor:start -->";
  const END = "<!-- progressor:end -->";

  it("refuses to set up or remove when the start marker has no end marker, and keeps the file", () => {
    const text = `# Mine\n\n${START}\n## Progressor\nhalf a note\n\nMy own rules below.\n`;
    write("CLAUDE.md", text);
    expect(() => planInit(root, global)).toThrow(/CLAUDE\.md.*progressor:start/s);
    expect(() => planRemove(root)).toThrow(/CLAUDE\.md.*progressor:start/s);
    expect(read("CLAUDE.md")).toBe(text);
  });

  it("refuses when the note appears twice, or an end marker has no start", () => {
    applyChanges(planInit(root, global));
    const once = read("CLAUDE.md");
    write("CLAUDE.md", `${once}\n${once}`);
    expect(() => planInit(root, global)).toThrow(/more than once/);
    expect(() => planRemove(root)).toThrow(/more than once/);
    write("CLAUDE.md", `text\n${END}\n`);
    expect(() => planRemove(root)).toThrow(/CLAUDE\.md/);
  });

  it("uses the file's own line ending, so a Windows file stays Windows", () => {
    write("CLAUDE.md", "# Mine\r\n\r\nUse tabs.\r\n");
    applyChanges(planInit(root, global));
    const text = read("CLAUDE.md");
    expect(text.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(text).toMatch(/^# Mine\r\n\r\nUse tabs\.\r\n\r\n<!-- progressor:start -->\r\n## Progressor\r\n/);
    expect(planInit(root, global).map((c) => c.file)).not.toContain("CLAUDE.md");
    applyChanges(planRemove(root));
    expect(read("CLAUDE.md")).toBe("# Mine\r\n\r\nUse tabs.\r\n");
  });
});

describe("finding Claude Desktop's config", () => {
  const env = () => ({ APPDATA: join(root, "Roaming"), LOCALAPPDATA: join(root, "Local") });

  it("finds the normal Windows folder and the Microsoft Store one", () => {
    expect(desktopConfigs({ env: env(), platform: "win32", home: root })).toEqual([]);
    dir("Roaming/Claude");
    dir("Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude");
    dir("Local/Packages/Other_abc/LocalCache/Roaming/Claude");
    expect(desktopConfigs({ env: env(), platform: "win32", home: root })).toEqual([
      join(root, "Roaming", "Claude", "claude_desktop_config.json"),
      join(root, "Local", "Packages", "Claude_pzs8sxrjxfjjc", "LocalCache", "Roaming", "Claude", "claude_desktop_config.json"),
    ]);
  });

  it("counts a Store package without its Claude folder yet as installed", () => {
    dir("Local/Packages/Claude_abc");
    expect(desktopConfigs({ env: env(), platform: "win32", home: root })).toEqual([
      join(root, "Local", "Packages", "Claude_abc", "LocalCache", "Roaming", "Claude", "claude_desktop_config.json"),
    ]);
  });

  it("finds macOS and Linux", () => {
    dir("Library/Application Support/Claude");
    expect(desktopConfigs({ env: {}, platform: "darwin", home: root })).toEqual([
      join(root, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    ]);
    expect(desktopConfigs({ env: {}, platform: "linux", home: root })).toEqual([]);
    dir(".config/Claude");
    expect(desktopConfigs({ env: {}, platform: "linux", home: root })).toEqual([join(root, ".config", "Claude", "claude_desktop_config.json")]);
  });
});

describe("Claude Desktop setup", () => {
  let config: string;
  beforeEach(() => {
    config = join(root, "Claude", "claude_desktop_config.json");
  });
  const desktop = () => JSON.parse(readFileSync(config, "utf8"));

  it("adds the server with the project folder, creating the file", () => {
    const c = planDesktop(root, global, config)!;
    expect(c.path).toBe(config);
    applyChanges([c]);
    expect(desktop()).toEqual({ mcpServers: { progressor: { command: "progressor-mcp", args: [], env: { PROGRESSOR_ROOT: root } } } });
    expect(planDesktop(root, global, config)).toBeUndefined();
  });

  it("leaves Desktop on another project unless asked to switch it", () => {
    applyChanges([planDesktop("C:/first", global, config)!]);
    expect(planDesktop(root, global, config, { switchProject: false })).toBeUndefined();
    expect(desktop().mcpServers.progressor.env.PROGRESSOR_ROOT).toBe("C:/first");
    applyChanges([planDesktop(root, global, config, { switchProject: true })!]);
    expect(desktop().mcpServers.progressor.env.PROGRESSOR_ROOT).toBe(root);
  });

  it("uses cmd /c on Windows, because Claude Desktop starts the command without a shell", () => {
    applyChanges([planDesktop(root, windows, config)!]);
    expect(desktop().mcpServers.progressor).toEqual({ command: "cmd", args: ["/c", "progressor-mcp"], env: { PROGRESSOR_ROOT: root } });
  });

  it("keeps the other servers and keys, and updates its own entry in place", () => {
    mkdirSync(join(root, "Claude"), { recursive: true });
    writeFileSync(
      config,
      JSON.stringify({ globalShortcut: "Ctrl+Space", mcpServers: { github: { command: "gh" }, progressor: { command: "old", args: [] }, z: {} } }),
    );
    const c = planDesktop(root, npx, config)!;
    expect(c.what).toMatch(/^update/);
    applyChanges([c]);
    expect(desktop()).toEqual({
      globalShortcut: "Ctrl+Space",
      mcpServers: { github: { command: "gh" }, progressor: { command: "npx", args: ["-y", "progressor-mcp"], env: { PROGRESSOR_ROOT: root } }, z: {} },
    });
    expect(Object.keys(desktop().mcpServers)).toEqual(["github", "progressor", "z"]);
  });

  it("refuses a config it cannot read", () => {
    mkdirSync(join(root, "Claude"), { recursive: true });
    writeFileSync(config, "{ nope");
    expect(() => planDesktop(root, global, config)).toThrow(/claude_desktop_config\.json is not valid JSON/);
  });

  it("removes only its entry and never deletes the app's config file", () => {
    mkdirSync(join(root, "Claude"), { recursive: true });
    writeFileSync(config, JSON.stringify({ theme: "dark", mcpServers: { github: { command: "gh" } } }));
    applyChanges([planDesktop(root, global, config)!]);
    applyChanges([planDesktopRemove(config)!]);
    expect(desktop()).toEqual({ theme: "dark", mcpServers: { github: { command: "gh" } } });
    expect(planDesktopRemove(config)).toBeUndefined();

    writeFileSync(config, "{}");
    applyChanges([planDesktop(root, global, config)!]);
    applyChanges([planDesktopRemove(config)!]);
    expect(desktop()).toEqual({});
    expect(planDesktopRemove(join(root, "none.json"))).toBeUndefined();
  });
});

describe("what one command sets up", () => {
  const found = ["/x/claude_desktop_config.json"];
  it("sets up the project, plus Desktop when it is installed, by default", () => {
    expect(pickTargets([], found)).toEqual({ code: true, desktop: found });
    expect(pickTargets([], [])).toEqual({ code: true, desktop: [] });
  });
  it("lets flags choose", () => {
    expect(pickTargets(["--code"], found)).toEqual({ code: true, desktop: [] });
    expect(pickTargets(["--desktop"], found)).toEqual({ code: false, desktop: found });
    expect(pickTargets(["--all"], found)).toEqual({ code: true, desktop: found });
    expect(pickTargets(["--code", "--desktop"], found)).toEqual({ code: true, desktop: found });
  });
});

describe("the final check", () => {
  it("says the server starts when --version works, and reports a failure plainly", () => {
    const calls: string[][] = [];
    const ok = (cmd: string, args: string[]) => (calls.push([cmd, ...args]), { status: 0, stdout: "1.3.0\n" });
    expect(checkServer(windows, ok)).toEqual({ ok: true, version: "1.3.0" });
    expect(calls).toEqual([["cmd", "/c", "progressor-mcp", "--version"]]);
    expect(checkServer(global, () => ({ status: 1, stdout: "" })).ok).toBe(false);
    expect(checkServer(global, () => ({ status: null, stdout: "", error: new Error("ENOENT") })).ok).toBe(false);
  });
});
