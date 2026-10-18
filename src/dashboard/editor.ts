// Builds the links behind "Open in file". Runs in the browser as well as in Node, so it uses plain
// string handling rather than node:path.

/** Editors that open `<scheme>://file/<absolute path>:<line>`. */
const FILE_SCHEMES = ["vscode", "vscode-insiders", "vscodium", "cursor", "windsurf", "zed"];

/** JetBrains IDEs, opened through JetBrains Toolbox. `jetbrains` means IntelliJ IDEA. */
const JETBRAINS = ["idea", "webstorm", "pycharm", "phpstorm", "goland", "rider", "rubymine", "clion", "rustrover"];

export const EDITORS = [...FILE_SCHEMES, "jetbrains", ...JETBRAINS];
export const DEFAULT_EDITOR = "vscode";

export interface EditorTarget {
  /** An editor name from EDITORS, or a URL template with {path}, {line}, {relPath} and {project}. */
  editor?: string;
  /** The project folder. */
  root: string;
  /** A path relative to the project folder, or an absolute path. */
  path: string;
  line?: number;
}

const slashes = (p: string) => p.replace(/\\/g, "/");
const isAbsolute = (p: string) => p.startsWith("/") || /^[A-Za-z]:\//.test(p);
const trimSlashes = (p: string) => p.replace(/\/+$/, "");

/** Encodes each path segment, keeping the slashes and a drive letter's colon. */
const encodePath = (p: string) =>
  p
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ":"))
    .join("/");

export function editorUrl({ editor = DEFAULT_EDITOR, root, path, line }: EditorTarget): string {
  const rootPath = trimSlashes(slashes(root));
  const rel = slashes(path).replace(/^\.\//, "");
  const absolute = isAbsolute(rel) ? rel : `${rootPath}/${rel}`;
  const relPath = isAbsolute(rel) && absolute.startsWith(`${rootPath}/`) ? absolute.slice(rootPath.length + 1) : rel;
  const project = rootPath.split("/").pop() ?? "";

  if (editor.includes("{")) {
    return editor
      .replace(/\{path\}/g, encodeURIComponent(absolute))
      .replace(/\{relPath\}/g, encodeURIComponent(relPath))
      .replace(/\{project\}/g, encodeURIComponent(project))
      .replace(/\{line\}/g, String(line ?? 1));
  }
  const name = editor.toLowerCase();
  if (name === "jetbrains" || JETBRAINS.includes(name)) {
    const product = name === "jetbrains" ? "idea" : name;
    const target = line ? `${relPath}:${line}` : relPath;
    return `jetbrains://${product}/navigate/reference?project=${encodeURIComponent(project)}&path=${encodeURIComponent(target)}`;
  }
  const scheme = FILE_SCHEMES.includes(name) ? name : DEFAULT_EDITOR;
  const filePath = absolute.startsWith("/") ? absolute.slice(1) : absolute;
  return `${scheme}://file/${encodePath(filePath)}${line ? `:${line}` : ""}`;
}

/** Splits a Task's code reference (`src/a.ts:42`, optionally `:42:7`) into a path and a line. */
export function parseCodeRef(ref: string): { path: string; line: number | undefined } {
  const m = /^(.+?)(?::(\d+)(?::\d+)?)?$/.exec(ref.trim());
  return { path: m?.[1] ?? ref, line: m?.[2] ? Number(m[2]) : undefined };
}
