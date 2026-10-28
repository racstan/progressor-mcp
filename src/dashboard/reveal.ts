// "Show in folder": opens the system's file manager at a file of the project, such as a goal's plan
// file. The dashboard asks the hub (a guarded POST, http.ts), which runs the one command the system
// has for it. Only something that exists inside the project can be shown.
import { spawn } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export interface RevealCommand {
  command: string;
  args: string[];
}

/** Runs a reveal command; tests pass their own. */
export type RevealRunner = (command: RevealCommand) => void;

/** The file manager command: Explorer and Finder select the file; on Linux its folder is opened. */
export function revealCommand(platform: NodeJS.Platform, path: string, isDir: boolean): RevealCommand {
  if (platform === "win32") return { command: "explorer.exe", args: [isDir ? path : `/select,${path}`] };
  if (platform === "darwin") return { command: "open", args: isDir ? [path] : ["-R", path] };
  return { command: "xdg-open", args: [isDir ? path : dirname(path)] };
}

/**
 * A path from the dashboard (relative to the project, maybe with ":line" after it, as steps list
 * their files) as a real file or folder inside the project; undefined for anything else.
 */
export function insideProject(root: string, wanted: string): { path: string; isDir: boolean } | undefined {
  const plain = wanted.replace(/:\d+$/, "").trim();
  if (!plain) return undefined;
  try {
    const top = realpathSync(root);
    const path = realpathSync(resolve(root, plain));
    const rel = relative(top, path);
    if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
    return { path: resolve(root, plain), isDir: statSync(path).isDirectory() };
  } catch {
    return undefined;
  }
}

/** Starts the file manager and lets it run on its own; a failure to start is not the dashboard's error. */
export const runReveal: RevealRunner = ({ command, args }) => {
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // no file manager here (a server without a desktop): nothing to show
  }
};
