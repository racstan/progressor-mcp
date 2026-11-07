// The plan's history: one entry per change (a tool call, a click on the dashboard), so any change
// can be undone. An entry keeps the text each plan file had just before the change (its
// "before-image"; null when the file did not exist), so going back to before entry k is putting back,
// for every file touched by k or anything after it, the before-image of the oldest of those entries.
//
// Entries live in `.progressor/history/`, kept out of git: one `<id>.json` file each, and
// `index.json` listing them (who, when, what, which files, size), so a change never lists the folder.
// Only the plan itself is kept: the Roadmap, the Goals' Plan Files, the Important context, the
// wishlist and handoffs. Talk, pictures and attachments are not: going back never takes back what
// the Developer and the AI said to each other.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Actor } from "./dates.js";
import type { Settings } from "./settings.js";

export const HISTORY_DIR = "history";
const INDEX_FILE = "index.json";

export type HistorySettings = Settings["history"];

/** One change, as the index lists it. */
export interface HistoryItem {
  id: string;
  /** When it was made (ISO). */
  at: string;
  actor: Actor;
  /** What was done: the tool's name, or what the Developer did on the dashboard. */
  label: string;
  /** The plan files it changed, relative to .progressor/. */
  files: string[];
  /** The size of its file, for the size limit. */
  bytes: number;
  /** For a going-back: the entry it went back to before. */
  restores?: string;
}

/** One change with the text its files had before it. */
export interface HistoryEntry extends Omit<HistoryItem, "files" | "bytes"> {
  files: Record<string, string | null>;
}

/** Whether a file (relative to .progressor/) is part of the plan the history keeps. */
export function tracked(rel: string): boolean {
  return (
    rel === "roadmap.md" ||
    rel === "context.md" ||
    rel === "wishlist.md" ||
    /^goals\/[^/\\]+\.md$/.test(rel) ||
    /^handoffs\/[^/\\]+\.md$/.test(rel)
  ) && !rel.split("/").some((part) => part === ".." || part === "." || part === "");
}

/** An entry's ID: when it was made, to the millisecond, and a number in case two share it. Sorts by time. */
const stamp = (at: Date) => at.toISOString().replace(/[-:.]/g, "");
const ENTRY_ID = /^\d{8}T\d{9}Z-\d+$/;
export const isEntryId = (id: string) => ENTRY_ID.test(id);

function writeWhole(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
    rmSync(tmp, { force: true });
  }
}

/** The entries, oldest first. Rebuilt from the entry files only when the index is missing or damaged. */
export function listHistory(dir: string): HistoryItem[] {
  if (!existsSync(dir)) return [];
  try {
    const data = JSON.parse(readFileSync(join(dir, INDEX_FILE), "utf8")) as { entries?: unknown };
    if (Array.isArray(data.entries)) return data.entries as HistoryItem[];
  } catch {
    // missing or damaged: rebuilt below
  }
  return rebuildIndex(dir);
}

function rebuildIndex(dir: string): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const name of readdirSync(dir).sort()) {
    const id = name.replace(/\.json$/, "");
    if (!isEntryId(id)) continue;
    const entry = readEntry(dir, id);
    if (!entry) continue;
    const bytes = Buffer.byteLength(readFileSync(join(dir, name)));
    items.push(itemOf(entry, bytes));
  }
  return items;
}

const itemOf = (entry: HistoryEntry, bytes: number): HistoryItem => ({
  id: entry.id,
  at: entry.at,
  actor: entry.actor,
  label: entry.label,
  files: Object.keys(entry.files),
  bytes,
  ...(entry.restores ? { restores: entry.restores } : {}),
});

/** One entry with its before-images; undefined when there is no such entry. */
export function readEntry(dir: string, id: string): HistoryEntry | undefined {
  if (!isEntryId(id)) return undefined;
  try {
    const entry = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as HistoryEntry;
    return entry && typeof entry.files === "object" ? entry : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The entries to keep, oldest first: at most `maxEntries`, none older than `keepDays`, and no more
 * than `maxMB` in all, dropping the oldest first. The newest is always kept, so the last change can
 * always be undone.
 */
export function prune(items: HistoryItem[], settings: HistorySettings, now: Date): { keep: HistoryItem[]; drop: HistoryItem[] } {
  const oldest = now.getTime() - settings.keepDays * 86_400_000;
  const maxBytes = settings.maxMB * 1024 * 1024;
  let bytes = items.reduce((n, i) => n + i.bytes, 0);
  let start = 0;
  while (
    start < items.length - 1 &&
    (items.length - start > settings.maxEntries || Date.parse(items[start]!.at) < oldest || bytes > maxBytes)
  ) {
    bytes -= items[start]!.bytes;
    start++;
  }
  return { keep: items.slice(start), drop: items.slice(0, start) };
}

/** Saves one change as a new entry, then drops what the settings no longer keep. */
export function recordEntry(
  dir: string,
  change: { at: Date; actor: Actor; label: string; files: Record<string, string | null>; restores?: string },
  settings: HistorySettings,
): HistoryItem {
  mkdirSync(dir, { recursive: true });
  const items = listHistory(dir);
  const base = stamp(change.at);
  let n = 1;
  while (items.some((i) => i.id === `${base}-${n}`) || existsSync(join(dir, `${base}-${n}.json`))) n++;
  const entry: HistoryEntry = {
    id: `${base}-${n}`,
    at: change.at.toISOString(),
    actor: change.actor,
    label: change.label,
    files: change.files,
    ...(change.restores ? { restores: change.restores } : {}),
  };
  const text = JSON.stringify(entry);
  writeFileSync(join(dir, `${entry.id}.json`), text);
  const item = itemOf(entry, Buffer.byteLength(text));
  const { keep, drop } = prune([...items, item], settings, change.at);
  writeWhole(join(dir, INDEX_FILE), JSON.stringify({ entries: keep }));
  for (const old of drop) rmSync(join(dir, `${old.id}.json`), { force: true });
  return item;
}

/**
 * What going back to before entry `id` puts back: for every file touched by it or a later entry, the
 * before-image of the oldest of them (null: the file did not exist). Throws when there is no such entry.
 */
export function restorePlan(dir: string, id: string): { item: HistoryItem; undone: HistoryItem[]; files: Map<string, string | null> } {
  const items = listHistory(dir);
  const k = items.findIndex((i) => i.id === id);
  if (k < 0) throw new Error(`No change ${id} in the plan's history; plan_history lists them.`);
  const undone = items.slice(k);
  const files = new Map<string, string | null>();
  for (const item of [...undone].reverse()) {
    const entry = readEntry(dir, item.id);
    if (!entry) throw new Error(`The history entry ${item.id} could not be read, so nothing was changed.`);
    for (const [file, before] of Object.entries(entry.files)) if (tracked(file)) files.set(file, before);
  }
  return { item: items[k]!, undone, files };
}

/** One line of a file's change: kept, added or removed. */
export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** A file's change in one entry, as lines; unchanged runs longer than a few lines are cut to `{ kind: "same", text: "…" }`. */
export interface FileChange {
  file: string;
  /** The file was made, or removed, by this change. */
  made: boolean;
  removed: boolean;
  lines: DiffLine[];
}

/** The lines that changed from `before` to `after`, with `context` unchanged lines around each change. */
export function lineDiff(before: string, after: string, context = 3): DiffLine[] {
  // a file's last line break ends its last line; it does not start an empty one
  const lines = (text: string) => (text === "" ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/));
  const a = lines(before);
  const b = lines(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const middle: DiffLine[] = [];
  if (midA.length * midB.length > 4_000_000) {
    middle.push(...midA.map((text) => ({ kind: "del" as const, text })), ...midB.map((text) => ({ kind: "add" as const, text })));
  } else {
    // longest common subsequence, then walk it
    const n = midA.length;
    const m = midB.length;
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) lcs[i]![j] = midA[i] === midB[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        middle.push({ kind: "same", text: midA[i]! });
        i++;
        j++;
      } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) middle.push({ kind: "del", text: midA[i++]! });
      else middle.push({ kind: "add", text: midB[j++]! });
    }
  }
  const all: DiffLine[] = [
    ...a.slice(0, head).map((text) => ({ kind: "same" as const, text })),
    ...middle,
    ...a.slice(a.length - tail).map((text) => ({ kind: "same" as const, text })),
  ];
  // keep only `context` unchanged lines around each change
  const near = all.map(() => false);
  all.forEach((line, i) => {
    if (line.kind === "same") return;
    for (let d = Math.max(0, i - context); d <= Math.min(all.length - 1, i + context); d++) near[d] = true;
  });
  const out: DiffLine[] = [];
  all.forEach((line, i) => {
    if (near[i]) out.push(line);
    else if (out.at(-1)?.text !== "…" || out.at(-1)?.kind !== "same") out.push({ kind: "same", text: "…" });
  });
  return out;
}

/**
 * What one entry changed, file by file: from its before-image to what the file was right after it
 * (the next entry's before-image of that file, or the file as it is now when no later entry touched it).
 */
export function entryChanges(dir: string, id: string, current: (file: string) => string | undefined): { item: HistoryItem; files: FileChange[] } | undefined {
  const items = listHistory(dir);
  const k = items.findIndex((i) => i.id === id);
  const entry = k < 0 ? undefined : readEntry(dir, id);
  if (!entry) return undefined;
  const later = items.slice(k + 1);
  const files = Object.entries(entry.files).map(([file, before]) => {
    let after: string | null | undefined;
    const next = later.find((i) => i.files.includes(file));
    if (next) after = readEntry(dir, next.id)?.files[file];
    if (after === undefined) after = next ? null : (current(file) ?? null);
    return { file, made: before === null, removed: after === null, lines: lineDiff(before ?? "", after ?? "") };
  });
  return { item: items[k]!, files };
}
