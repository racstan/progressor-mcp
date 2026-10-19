// The running Progressor processes, so the dashboard can list them and stop one. Each process (a
// Session's MCP server, or a `progressor-mcp dashboard` command) keeps a small record in
// `~/.progressor/servers/<pid>.json`, refreshes it while it runs and removes it when it exits.
// Stopping is cooperative: the dashboard drops a `<pid>.stop` file and the process exits by itself,
// so a pid that was reused by some other program can never be hit.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultRegistryFile } from "./dashboard/registry.js";
import { processIsAlive } from "./project.js";

export interface ServerRecord {
  pid: number;
  /** A Session's MCP server, or the `progressor-mcp dashboard` command. */
  kind: "session" | "dashboard";
  /** The project folder, or the Workspace folder for the dashboard command. */
  root: string;
  /** The Session ID, for a Session's server. */
  session?: string;
  version: string;
  startedAt: string;
  /** When the record was last refreshed. */
  beatAt: string;
  /** Resident memory in bytes, as of the last refresh. */
  memory: number;
}

export interface AnnounceOptions {
  /** Folder of the records; `servers/` beside the project registry unless set. */
  dir?: string;
  pid?: number;
  version: string;
  /** Called once when the dashboard asks this process to stop. */
  onStop: () => void;
  /** How often the record is refreshed. */
  beatMs?: number;
  /** How often a stop request is looked for. */
  pollMs?: number;
}

/** `~/.progressor/servers/`, beside the project registry. */
export const defaultServersDir = (registryFile = defaultRegistryFile()) => join(dirname(registryFile), "servers");

/** A record not refreshed for this long belongs to a process that hung or whose pid was reused. */
const STALE_MS = 60_000;

const recordFile = (dir: string, pid: number) => join(dir, `${pid}.json`);
const stopFile = (dir: string, pid: number) => join(dir, `${pid}.stop`);

function remove(file: string): void {
  rmSync(file, { force: true });
}

/** Writes this process's record and keeps it fresh until `close()`. */
export function announceServer(
  info: Pick<ServerRecord, "kind" | "root" | "session">,
  options: AnnounceOptions,
): { close(): void } {
  const dir = options.dir ?? defaultServersDir();
  const pid = options.pid ?? process.pid;
  const startedAt = new Date().toISOString();
  const write = () => {
    const record: ServerRecord = {
      pid,
      ...info,
      version: options.version,
      startedAt,
      beatAt: new Date().toISOString(),
      memory: process.memoryUsage.rss(),
    };
    const file = recordFile(dir, pid);
    const tmp = `${file}.tmp`;
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify(record));
      renameSync(tmp, file);
    } catch {
      // the record is only for the dashboard; a server keeps working without it
    }
  };
  remove(stopFile(dir, pid));
  write();
  const beat = setInterval(write, options.beatMs ?? 15_000);
  let stopped = false;
  const poll = setInterval(() => {
    if (stopped || !existsSync(stopFile(dir, pid))) return;
    stopped = true;
    remove(stopFile(dir, pid));
    options.onStop();
  }, options.pollMs ?? 1000);
  beat.unref();
  poll.unref();
  return {
    close() {
      clearInterval(beat);
      clearInterval(poll);
      remove(recordFile(dir, pid));
      remove(stopFile(dir, pid));
    },
  };
}

export interface ListOptions {
  isAlive?: (pid: number) => boolean;
  now?: () => Date;
}

/** The running servers, oldest first. Records of processes that have died are cleared. */
export function listServers(dir = defaultServersDir(), options: ListOptions = {}): ServerRecord[] {
  const isAlive = options.isAlive ?? processIsAlive;
  const now = (options.now ?? (() => new Date()))().getTime();
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => /^\d+\.json$/.test(n));
  } catch {
    return [];
  }
  const live: ServerRecord[] = [];
  for (const name of names) {
    let record: ServerRecord;
    try {
      record = JSON.parse(readFileSync(join(dir, name), "utf8")) as ServerRecord;
      if (typeof record.pid !== "number" || typeof record.root !== "string") continue;
    } catch {
      continue;
    }
    if (!isAlive(record.pid)) {
      remove(join(dir, name));
      remove(stopFile(dir, record.pid));
      continue;
    }
    if (now - Date.parse(record.beatAt) > STALE_MS) continue;
    live.push(record);
  }
  return live.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.pid - b.pid);
}

/** Asks a listed server to stop. False when no running server has that pid. */
export function requestStop(dir: string, pid: number, options: ListOptions = {}): boolean {
  if (!listServers(dir, options).some((s) => s.pid === pid)) return false;
  writeFileSync(stopFile(dir, pid), "");
  return true;
}
