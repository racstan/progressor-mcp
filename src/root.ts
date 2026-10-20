// Which folder is the project. An app that starts Progressor for every project (Claude Desktop, a
// user-wide Cursor or VS Code setting) may start it in the home folder or the app's own folder, so
// the start folder alone would put .progressor/ in the wrong place.
import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The project folder: PROGRESSOR_ROOT when set, then the first folder the app reports as an MCP
 * root, then CLAUDE_PROJECT_DIR (Claude Code), then the folder the server was started in.
 */
export function chooseRoot(input: {
  env: Record<string, string | undefined>;
  /** The URIs of the app's MCP roots, if it reported any. */
  roots: string[] | undefined;
  cwd: string;
  platform?: NodeJS.Platform;
}): string {
  if (input.env.PROGRESSOR_ROOT) return input.env.PROGRESSOR_ROOT;
  const windows = (input.platform ?? process.platform) === "win32";
  for (const uri of input.roots ?? []) {
    if (!uri.startsWith("file:")) continue;
    try {
      return fileURLToPath(uri, { windows });
    } catch {
      // not a path on this computer; try the next one
    }
  }
  return input.env.CLAUDE_PROJECT_DIR || input.cwd;
}

/**
 * Why a folder is the wrong place to start a progress record, or undefined when it is fine: the
 * home folder, the top of a drive, or the Windows folder are where a server lands when the app did
 * not start it in the project.
 */
export function unsafeRoot(
  root: string,
  system: { home: string; systemRoot: string | undefined; platform: NodeJS.Platform },
): string | undefined {
  const path = system.platform === "win32" ? win32 : posix;
  const key = (p: string) => {
    const r = path.resolve(p);
    const trimmed = r.length > path.parse(r).root.length ? r.replace(/[\\/]+$/, "") : r;
    return system.platform === "win32" ? trimmed.toLowerCase() : trimmed;
  };
  const r = key(root);
  if (r === key(path.parse(r).root)) return "it is the top of a drive";
  if (r === key(system.home)) return "it is your home folder";
  if (system.systemRoot) {
    const sys = key(system.systemRoot);
    if (r === sys || r.startsWith(sys + path.sep)) return "it is inside the Windows folder";
  }
  return undefined;
}
