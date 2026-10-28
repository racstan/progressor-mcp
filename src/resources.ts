// Locks on shared resources. Sessions (and the helpers an Agent starts) that work on one project at
// the same time can trip over one thing only one of them may use: a dev window that allows a single
// instance, the desktop shell, a port. A lock names the resource, who holds it and why, so the
// next one asks first and is told who has it instead of silently breaking the other's run.
//
// Locks are runtime state, not plan: they are one small JSON file in the system's temp folder named
// after the project folder (like the plan hold in lock.ts), so they never appear in the plan files or
// in a git diff, and every Session on this machine sees the same locks. The tools read and write it
// while holding the plan (withLock), and the file is written whole and renamed into place.
//
// A lock counts as held only while its holder may still be running (the same test a Goal's Claim
// uses, see claimMayBeLive) and its time is not up: it lasts `minutes` (30 unless asked, at most 4
// hours) from the last claim, and claiming again refreshes it. Anything else is free.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathKey } from "./dashboard/registry.js";
import { minutesSince, sayDuration } from "./estimate.js";

export const DEFAULT_MINUTES = 30;
export const MAX_MINUTES = 240;
const MAX_NAME = 60;
const MAX_TEXT = 300;

export interface ResourceLock {
  /** The resource's name, lowercase with dashes ("dev-window"). */
  resource: string;
  /** The Session that claimed it, and its process. */
  session: string;
  pid: number;
  /** Who it is held for inside that Session, such as "helper: media run"; the Session itself when absent. */
  label: string | undefined;
  reason: string;
  /** The Goal ID and Task ID it is for, when given, as "goal/task" parts of free text. */
  task: string | undefined;
  /** When it was first claimed and last refreshed, as ISO times. */
  since: string;
  refreshed: string;
  /** How long it lasts from the last refresh, in minutes. */
  minutes: number;
}

export interface ClaimOptions {
  reason: string;
  label?: string | undefined;
  task?: string | undefined;
  minutes?: number | undefined;
}

export const resourcesFile = (root: string, dir = tmpdir()) =>
  join(dir, `progressor-${createHash("sha1").update(pathKey(root)).digest("hex").slice(0, 16)}.resources.json`);

/** "Dev Window" and "dev-window" are the same resource. */
export function normalizeResource(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, MAX_NAME);
  if (!n) throw new Error("Give the resource a name, such as dev-window.");
  return n;
}

const clean = (text: string | undefined, max = MAX_TEXT): string | undefined => {
  const t = text?.replace(/\s+/g, " ").trim().slice(0, max);
  return t ? t : undefined;
};

const clampMinutes = (m: number | undefined) => Math.min(MAX_MINUTES, Math.max(1, Math.round(m ?? DEFAULT_MINUTES)));

const left = (lock: ResourceLock, now: Date) => Math.max(0, lock.minutes - minutesSince(lock.refreshed, now));
const ago = (iso: string, now: Date) => sayDuration(Math.max(1, Math.round(minutesSince(iso, now))));

/** Who holds it, for a sentence: "helper: media run (Session s-a)", or "Session s-a". */
export const holderText = (l: Pick<ResourceLock, "label" | "session">) => (l.label ? `${l.label} (Session ${l.session})` : `Session ${l.session}`);

/** One lock in get_status and list_resources. */
export function resourceLine(l: ResourceLock, now: Date): string {
  const why = `${l.reason}${l.task ? ` (task ${l.task})` : ""}`;
  return `${l.resource}: ${holderText(l)} for ${ago(l.since, now)}: ${why}; free again in ${sayDuration(Math.max(1, Math.round(left(l, now))))} unless refreshed`;
}

export interface ResourceOptions {
  root: string;
  /** This Session. Absent for a reader that is not a Session (the dashboard). */
  self?: { id: string; pid: number };
  /** Whether the holder of a lock may still be running. */
  mayBeLive: (holder: { session: string; pid: number }) => boolean;
  now: () => Date;
  /** The folder of the file; the system's temp folder unless set. */
  dir?: string;
}

export class ResourceLocks {
  private readonly file: string;
  constructor(private readonly o: ResourceOptions) {
    this.file = resourcesFile(o.root, o.dir);
  }

  private read(): ResourceLock[] {
    try {
      const data: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      return Array.isArray(data)
        ? (data as ResourceLock[]).filter((l) => l && typeof l.resource === "string" && typeof l.session === "string" && typeof l.pid === "number" && !Number.isNaN(Date.parse(l.refreshed)))
        : [];
    } catch {
      return []; // no file yet, or one that cannot be read: nothing is held
    }
  }

  private write(locks: ResourceLock[]): void {
    if (locks.length === 0) {
      rmSync(this.file, { force: true });
      return;
    }
    mkdirSync(join(this.file, ".."), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(locks, null, 1));
    renameSync(tmp, this.file);
  }

  private held(l: ResourceLock): boolean {
    return left(l, this.o.now()) > 0 && this.o.mayBeLive(l);
  }

  private mine(l: Pick<ResourceLock, "session" | "label">, label: string | undefined): boolean {
    return l.session === this.o.self?.id && (l.label ?? undefined) === label;
  }

  /** The locks held now, oldest first. A lock whose time is up or whose Session has ended is not listed. */
  list(): ResourceLock[] {
    return this.read().filter((l) => this.held(l));
  }

  /** Claims a resource, or refreshes this holder's own claim. Refused, naming the holder, when another holds it. */
  claim(name: string, options: ClaimOptions): { lock: ResourceLock; refreshed: boolean } {
    const self = this.o.self;
    if (!self) throw new Error("Only a Session can claim a resource.");
    const resource = normalizeResource(name);
    const reason = clean(options.reason);
    if (!reason) throw new Error("Say why you need it (reason), in a few words, so whoever asks next can tell.");
    const label = clean(options.label, 100);
    const now = this.o.now();
    const all = this.read().filter((l) => this.held(l));
    const other = all.find((l) => l.resource === resource);
    if (other && !this.mine(other, label)) {
      const remaining = sayDuration(Math.max(1, Math.round(left(other, now))));
      throw new Error(
        `${resource} is in use by ${holderText(other)} since ${ago(other.since, now)} ago. Reason: ${other.reason}${other.task ? ` (task ${other.task})` : ""}. ` +
          `It is free again in ${remaining} at the latest. Do not start what needs it now: do something else and try again later, or ask the Developer. ` +
          `Only if the Developer says the holder is gone, release it with force.`,
      );
    }
    const lock: ResourceLock = {
      resource,
      session: self.id,
      pid: self.pid,
      label,
      reason,
      task: clean(options.task, 40),
      since: other ? other.since : now.toISOString(),
      refreshed: now.toISOString(),
      minutes: clampMinutes(options.minutes),
    };
    this.write([...all.filter((l) => l.resource !== resource), lock]);
    return { lock, refreshed: other !== undefined };
  }

  /**
   * Releases a resource this holder holds. Returns false when nothing was held. Another holder's lock
   * is refused unless `force`.
   */
  release(name: string, options: { label?: string | undefined; force?: boolean | undefined }): boolean {
    const resource = normalizeResource(name);
    const all = this.read().filter((l) => this.held(l));
    const lock = all.find((l) => l.resource === resource);
    if (!lock) {
      this.write(all);
      return false;
    }
    if (!options.force && !this.mine(lock, clean(options.label, 100)))
      throw new Error(`${resource} is held by ${holderText(lock)}, not by you. Release it with that label, or with force only if the Developer says the holder is gone.`);
    this.write(all.filter((l) => l !== lock));
    return true;
  }

  /** Frees every lock this Session holds, as it ends. */
  releaseAll(): void {
    const self = this.o.self;
    if (!self) return;
    const all = this.read();
    const rest = all.filter((l) => l.session !== self.id && this.held(l));
    if (rest.length !== all.length) this.write(rest);
  }
}
