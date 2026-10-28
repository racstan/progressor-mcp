import { type FSWatcher, existsSync, readdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { PROGRESSOR_DIR } from "../project.js";

/**
 * Calls `onChange` with the changed files (relative to .progressor/) shortly after anything under
 * `<root>/.progressor` changes. Bursts are batched, and the folder is waited for if it does not exist
 * yet (or is deleted). Returns a function that stops watching.
 *
 * Each folder is watched on its own rather than with `recursive: true`: on Linux, Node's recursive
 * watcher loses a file once it is replaced by a rename, and every save is a write-then-rename, so
 * only the first save of a Plan File was ever reported. A folder's own watcher sees every rename.
 */
export function watchProgress(root: string, onChange: (files: string[]) => void, debounceMs = 80): () => void {
  const dir = join(root, PROGRESSOR_DIR);
  const watchers = new Map<string, FSWatcher>();
  let poll: NodeJS.Timeout | undefined;
  let flush: NodeJS.Timeout | undefined;
  let stopped = false;
  const pending = new Set<string>();

  const notify = (file: string) => {
    if (file.endsWith(".tmp")) return; // the write-then-rename of a save; the rename is reported too
    pending.add(file.replace(/\\/g, "/"));
    clearTimeout(flush);
    flush = setTimeout(() => {
      const files = [...pending];
      pending.clear();
      onChange(files);
    }, debounceMs);
  };

  const isDir = (path: string) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  };

  /** Watches a folder (`sub` is its path inside .progressor/, "" for .progressor/ itself) and every folder in it. */
  const add = (sub: string) => {
    const path = sub ? join(dir, sub) : dir;
    if (watchers.has(sub) || !isDir(path)) return;
    const w = watch(path, (_event, name) => {
      if (!existsSync(dir)) return restart(); // .progressor/ itself was removed
      const file = name ? String(name) : "";
      const rel = sub && file ? `${sub}/${file}` : sub || file;
      // a folder made inside, such as goals/ in a new project, is watched too
      if (file && !file.endsWith(".tmp") && isDir(join(path, file))) add(rel);
      notify(rel);
    });
    w.on("error", restart);
    watchers.set(sub, w);
    for (const entry of readdirSync(path, { withFileTypes: true })) if (entry.isDirectory()) add(sub ? `${sub}/${entry.name}` : entry.name);
  };

  const closeAll = () => {
    for (const w of watchers.values()) w.close();
    watchers.clear();
  };

  const start = () => {
    if (stopped) return;
    if (!existsSync(dir)) {
      poll = setTimeout(start, 1000);
      return;
    }
    try {
      add("");
      notify(""); // the folder may have just appeared
    } catch {
      closeAll();
      poll = setTimeout(start, 1000);
    }
  };
  // A watched folder that is deleted or fails: start over once the folder is back.
  function restart() {
    closeAll();
    if (!stopped) poll = setTimeout(start, 1000);
  }

  start();
  return () => {
    stopped = true;
    closeAll();
    clearTimeout(poll);
    clearTimeout(flush);
  };
}
