// A short hold on one project's plan while a tool reads and rewrites it, so two Progressor
// processes changing the same plan at once (a Session in the project and an Agent in another
// project changing it from there) take turns instead of one overwriting the other's change. Every
// file is still written whole and renamed into place, so a reader never sees half a file.
//
// The hold is a file in the system's temp folder, named after the project folder, so nothing is
// added to the project. It holds the pid of the process that made it: a hold whose process has
// ended, or that is older than a few seconds, is stale and taken over.
import { createHash, randomBytes } from "node:crypto";
import { closeSync, openSync, readFileSync, rmSync, statSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathKey } from "./dashboard/registry.js";

export interface LockOptions {
  /** How long to wait for another process's hold before giving up. */
  timeoutMs?: number;
  /** A hold older than this is stale: its process hung or was stopped half-way. */
  staleMs?: number;
  isAlive?: (pid: number) => boolean;
  /** The folder the hold files go in; the system's temp folder unless set. */
  dir?: string;
}

/** The roots this process holds, so a tool that calls another one does not wait for itself. */
const held = new Set<string>();

export const lockFile = (root: string, dir = tmpdir()) =>
  join(dir, `progressor-${createHash("sha1").update(pathKey(root)).digest("hex").slice(0, 16)}.lock`);

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function isStale(file: string, staleMs: number, isAlive: (pid: number) => boolean): boolean {
  try {
    const pid = Number(readFileSync(file, "utf8").split(" ")[0]);
    if (Number.isInteger(pid) && pid > 0 && !isAlive(pid)) return true;
    return Date.now() - statSync(file).mtimeMs > staleMs;
  } catch {
    return false; // just released, or being written; try again
  }
}

/**
 * Runs `body` while holding the project's plan. Waits for another process's hold, and fails with a
 * plain message if it is not released in time. When the temp folder cannot be written, `body` runs
 * without a hold rather than not at all.
 */
export function withLock<T>(root: string, body: () => T, options: LockOptions = {}): T {
  const key = pathKey(root);
  if (held.has(key)) return body();
  const file = lockFile(root, options.dir);
  const isAlive = options.isAlive ?? alive;
  const deadline = Date.now() + (options.timeoutMs ?? 5000);
  const token = `${process.pid} ${randomBytes(6).toString("hex")}`;
  let mine = false;
  while (!mine) {
    try {
      const fd = openSync(file, "wx");
      try {
        writeSync(fd, token);
      } finally {
        closeSync(fd);
      }
      mine = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") break;
      if (isStale(file, options.staleMs ?? 15_000, isAlive)) {
        rmSync(file, { force: true });
        continue;
      }
      if (Date.now() > deadline)
        throw new Error(`The plan in ${root} is busy: another Progressor is changing it. Try again in a moment.`);
      pause(15);
    }
  }
  held.add(key);
  try {
    return body();
  } finally {
    held.delete(key);
    if (mine) {
      try {
        if (readFileSync(file, "utf8") === token) rmSync(file, { force: true });
      } catch {
        // already gone
      }
    }
  }
}
