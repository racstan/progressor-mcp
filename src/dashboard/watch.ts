import { type FSWatcher, existsSync, watch } from "node:fs";
import { join } from "node:path";
import { PROGRESSOR_DIR } from "../project.js";

/**
 * Calls `onChange` with the changed files (relative to .progressor/) shortly after anything under
 * `<root>/.progressor` changes. Bursts are batched, and the folder is waited for if it does not exist
 * yet (or is deleted). Returns a function that stops watching.
 */
export function watchProgress(root: string, onChange: (files: string[]) => void, debounceMs = 80): () => void {
  const dir = join(root, PROGRESSOR_DIR);
  let watcher: FSWatcher | undefined;
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

  const start = () => {
    if (stopped) return;
    if (!existsSync(dir)) {
      poll = setTimeout(start, 1000);
      return;
    }
    try {
      watcher = watch(dir, { recursive: true }, (_event, file) => notify(file ? String(file) : ""));
      watcher.on("error", restart);
      notify(""); // the folder may have just appeared
    } catch {
      poll = setTimeout(start, 1000);
    }
  };
  const restart = () => {
    watcher?.close();
    watcher = undefined;
    if (!stopped) poll = setTimeout(start, 1000);
  };

  start();
  return () => {
    stopped = true;
    watcher?.close();
    clearTimeout(poll);
    clearTimeout(flush);
  };
}
