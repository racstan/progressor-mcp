import { describe, expect, it } from "vitest";
import { editorUrl, parseCodeRef } from "../src/dashboard/editor.js";

const WIN = "C:\\Programming\\my app";
const POSIX = "/home/dev/my-app";

describe("Open in file links", () => {
  it("opens a project file at a line in VS Code by default", () => {
    expect(editorUrl({ root: WIN, path: ".progressor/goals/login.md", line: 12 })).toBe(
      "vscode://file/C:/Programming/my%20app/.progressor/goals/login.md:12",
    );
    expect(editorUrl({ root: POSIX, path: "src/a.ts" })).toBe("vscode://file/home/dev/my-app/src/a.ts");
  });

  it("speaks the URL scheme of Cursor, Windsurf and Zed", () => {
    expect(editorUrl({ editor: "cursor", root: POSIX, path: "src/a.ts", line: 3 })).toBe(
      "cursor://file/home/dev/my-app/src/a.ts:3",
    );
    expect(editorUrl({ editor: "windsurf", root: POSIX, path: "src/a.ts", line: 3 })).toBe(
      "windsurf://file/home/dev/my-app/src/a.ts:3",
    );
    expect(editorUrl({ editor: "zed", root: POSIX, path: "src/a.ts", line: 3 })).toBe(
      "zed://file/home/dev/my-app/src/a.ts:3",
    );
  });

  it("opens JetBrains IDEs through Toolbox, by project name and relative path", () => {
    expect(editorUrl({ editor: "webstorm", root: WIN, path: "src/auth/login.ts", line: 42 })).toBe(
      "jetbrains://webstorm/navigate/reference?project=my%20app&path=src%2Fauth%2Flogin.ts%3A42",
    );
    expect(editorUrl({ editor: "jetbrains", root: POSIX, path: "README.md" })).toBe(
      "jetbrains://idea/navigate/reference?project=my-app&path=README.md",
    );
  });

  it("fills in a custom URL template for any other editor", () => {
    expect(
      editorUrl({ editor: "myed://open?file={path}&line={line}&in={project}&rel={relPath}", root: POSIX, path: "src/a.ts", line: 9 }),
    ).toBe("myed://open?file=%2Fhome%2Fdev%2Fmy-app%2Fsrc%2Fa.ts&line=9&in=my-app&rel=src%2Fa.ts");
  });

  it("accepts absolute paths and falls back to VS Code for an unknown editor name", () => {
    expect(editorUrl({ editor: "notepad", root: POSIX, path: "/etc/hosts", line: 1 })).toBe("vscode://file/etc/hosts:1");
    expect(editorUrl({ root: WIN, path: "D:\\other\\x#1.ts" })).toBe("vscode://file/D:/other/x%231.ts");
  });

  it("splits a code reference into a path and an optional line", () => {
    expect(parseCodeRef("src/auth/session.ts:42")).toEqual({ path: "src/auth/session.ts", line: 42 });
    expect(parseCodeRef("src/auth/session.ts:42:7")).toEqual({ path: "src/auth/session.ts", line: 42 });
    expect(parseCodeRef("package.json")).toEqual({ path: "package.json", line: undefined });
    expect(parseCodeRef("C:/x/y.ts:3")).toEqual({ path: "C:/x/y.ts", line: 3 });
  });
});
