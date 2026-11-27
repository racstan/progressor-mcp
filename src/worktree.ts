// Tells whether a folder is a linked git worktree (what Claude desktop makes for each helper chat) and
// which project it belongs to. Reads a few small files, never runs git, and never throws: anything
// unexpected answers undefined, as if the folder were an ordinary one.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface WorktreeInfo {
  /** The folder of the main checkout, which holds the project's plan. */
  mainRoot: string;
  /** The worktree folder itself. */
  folder: string;
  /** The branch checked out there; undefined on a detached HEAD. */
  branch: string | undefined;
}

function read(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

/** A linked worktree's `.git` is a file reading `gitdir: <main>/.git/worktrees/<name>`; a main checkout's is a folder. */
export function worktreeOf(folder: string): WorktreeInfo | undefined {
  try {
    const dotGit = join(folder, ".git");
    if (!statSync(dotGit).isFile()) return undefined;
    const pointer = /^gitdir:\s*(.+)$/m.exec(read(dotGit) ?? "")?.[1]?.trim();
    if (!pointer) return undefined;
    const gitdir = resolve(folder, pointer);
    if (!existsSync(gitdir)) return undefined;
    // `commondir` is relative to the worktree's gitdir and points at the main `.git`.
    const common = read(join(gitdir, "commondir"));
    if (!common) return undefined;
    const mainGit = isAbsolute(common) ? common : resolve(gitdir, common);
    if (!existsSync(mainGit)) return undefined;
    const head = /^ref:\s*refs\/heads\/(.+)$/m.exec(read(join(gitdir, "HEAD")) ?? "")?.[1]?.trim();
    return { mainRoot: dirname(mainGit), folder, branch: head || undefined };
  } catch {
    return undefined;
  }
}

/**
 * Where a chat started in `folder` should keep its plan: the main checkout when `folder` is a linked
 * worktree whose main checkout has a plan, so a helper chat shares the project's plan. Otherwise the
 * folder as it is.
 */
export function planRootFor(folder: string): { root: string; worktree?: string; branch?: string } {
  const wt = worktreeOf(folder);
  if (!wt || !existsSync(join(wt.mainRoot, ".progressor"))) return { root: folder };
  return { root: wt.mainRoot, worktree: wt.folder, ...(wt.branch ? { branch: wt.branch } : {}) };
}
