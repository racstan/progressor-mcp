import { describe, expect, it } from "vitest";
import { chooseRoot, unsafeRoot } from "../src/root.js";

const posix = { home: "/home/dev", systemRoot: undefined, platform: "linux" as const };
const win = { home: String.raw`C:\Users\dev`, systemRoot: String.raw`C:\WINDOWS`, platform: "win32" as const };

describe("chooseRoot", () => {
  it("takes PROGRESSOR_ROOT over everything", () => {
    expect(chooseRoot({ env: { PROGRESSOR_ROOT: "/p", CLAUDE_PROJECT_DIR: "/c" }, roots: ["file:///r"], cwd: "/cwd", platform: "linux" })).toBe("/p");
  });

  it("then the first folder the app reports", () => {
    expect(chooseRoot({ env: { CLAUDE_PROJECT_DIR: "/c" }, roots: ["file:///home/dev/shop", "file:///home/dev/other"], cwd: "/cwd", platform: "linux" })).toBe(
      "/home/dev/shop",
    );
  });

  it("skips reported roots that are not folders on this computer", () => {
    expect(chooseRoot({ env: {}, roots: ["https://example.com/repo", "file:///home/dev/shop"], cwd: "/cwd", platform: "linux" })).toBe("/home/dev/shop");
  });

  it("then CLAUDE_PROJECT_DIR, then the start folder", () => {
    expect(chooseRoot({ env: { CLAUDE_PROJECT_DIR: "/c" }, roots: [], cwd: "/cwd", platform: "linux" })).toBe("/c");
    expect(chooseRoot({ env: {}, roots: undefined, cwd: "/cwd", platform: "linux" })).toBe("/cwd");
  });
});

describe("unsafeRoot", () => {
  it("names the home folder, a drive or disk root, and the Windows folder", () => {
    expect(unsafeRoot("/home/dev", posix)).toMatch(/home folder/);
    expect(unsafeRoot("/home/dev/", posix)).toMatch(/home folder/);
    expect(unsafeRoot("/", posix)).toMatch(/top of a drive/);
    expect(unsafeRoot(String.raw`C:\Users\Dev`, win)).toMatch(/home folder/);
    expect(unsafeRoot("C:\\", win)).toMatch(/top of a drive/);
    expect(unsafeRoot(String.raw`C:\Windows\System32`, win)).toMatch(/Windows folder/);
  });

  it("lets a project folder through", () => {
    expect(unsafeRoot("/home/dev/shop", posix)).toBeUndefined();
    expect(unsafeRoot(String.raw`C:\Users\dev\code\shop`, win)).toBeUndefined();
  });
});
