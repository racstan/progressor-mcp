// A short hold on one project's plan while a tool reads and rewrites it, so two Progressor
// processes changing the same plan at once (a Session in the project and an Agent in another
// project changing it from there) take turns instead of one overwriting the other's change. Every
// file is still written whole and renamed into place, so a reader never sees half a file.
//
// The hold is a file in the system's temp folder, named after the project folder, so nothing is
// added to the project. It holds the pid of the process that made it: a hold whose process has
// ended, or that is older than a few seconds, is stale and taken over.
import { createHash, randomBytes } from "node:crypto";
import { closeSync, linkSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
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
  /** Opens the hold file; only tests change it, to act out a busy file system. */
  open?: (file: string, flags: string) => number;
}

/** Errors Windows gives while another process is creating, deleting or scanning the hold file: try again. */
const BUSY = new Set(["EEXIST", "EPERM", "EBUSY", "EACCES"]);

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

export const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** The text of a stale hold (its process ended, or it is too old), or undefined while it is live or gone. */
function staleHold(file: string, staleMs: number, isAlive: (pid: number) => boolean): string | undefined {
  try {
    const text = readFileSync(file, "utf8");
    const pid = Number(text.split(" ")[0]);
    if (Number.isInteger(pid) && pid > 0 && !isAlive(pid)) return text;
    return Date.now() - statSync(file).mtimeMs > staleMs ? text : undefined;
  } catch {
    return undefined; // just released, or being written; try again
  }
}

/**
 * Removes a stale hold whose text was `stale`. It is moved aside first, which only one process can
 * do, so two processes that both found it stale cannot each take over. If what was moved turns out
 * to be another process's fresh hold, made after the check, it is put back.
 */
function takeOver(file: string, stale: string): void {
  const aside = `${file}.${process.pid}-${randomBytes(4).toString("hex")}.stale`;
  try {
    renameSync(file, aside);
  } catch {
    return; // someone else moved or removed it first
  }
  try {
    if (readFileSync(aside, "utf8") !== stale) linkSync(aside, file);
  } catch {
    // a newer hold is already in place; the moved one was stale or its owner checks its token
  } finally {
    rmSync(aside, { force: true });
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
  const open = options.open ?? openSync;
  const deadline = Date.now() + (options.timeoutMs ?? 5000);
  const token = `${process.pid} ${randomBytes(6).toString("hex")}`;
  let mine = false;
  while (!mine) {
    try {
      const fd = open(file, "wx");
      try {
        writeSync(fd, token);
      } finally {
        closeSync(fd);
      }
      mine = true;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "";
      if (!BUSY.has(code)) break; // the temp folder cannot be used: run without a hold
      const stale = code === "EEXIST" ? staleHold(file, options.staleMs ?? 15_000, isAlive) : undefined;
      if (stale !== undefined) {
        takeOver(file, stale);
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
