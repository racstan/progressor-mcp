// Dates on everything: when a Goal, step, decision, note or hand test was added and when it last
// changed, and by whom. They are `added` and `updated` lines in the plan files, written when the
// Project saves (see stampDates), never by the tools one by one.
import { type ItemBlock, getDetail, itemsIn, parseMarkdown, serialiseMarkdown } from "./markdown.js";

/** Who made a change: the AI, or the Developer on the dashboard. */
export type Actor = "AI" | "Developer";

/** When something happened and who did it. */
export interface Stamp {
  at: string;
  by: Actor;
}

/** The two lines, last in an item's attribute block. */
export const ADDED = "added";
export const UPDATED = "updated";

const STAMP = /^(\S+)\s+by\s+(AI|Developer)$/;

/** Reads an `added` or `updated` value: `2026-10-28T10:00:00.000Z by AI`; undefined when it is not one. */
export function parseStamp(value: string | undefined): Stamp | undefined {
  const m = value ? STAMP.exec(value.trim()) : null;
  return m && !Number.isNaN(Date.parse(m[1]!)) ? { at: m[1]!, by: m[2] as Actor } : undefined;
}

export function formatStamp(stamp: Stamp): string {
  return `${stamp.at} by ${stamp.by}`;
}

/** The `added` and `updated` of an item, each left out when the item has no such line. */
export function withDates(b: ItemBlock): { added?: Stamp; updated?: Stamp } {
  const added = parseStamp(getDetail(b, ADDED));
  const updated = parseStamp(getDetail(b, UPDATED));
  return { ...(added ? { added } : {}), ...(updated ? { updated } : {}) };
}

/** Which items of a file are dated, and which detail lines are not a change to the item. */
export interface DateScope {
  sections: string[];
  /** Whether the item counts (the Roadmap's Goals are the ones with a checkbox and an ID). */
  counts?: (b: ItemBlock) => boolean;
  /** Detail lines that change without the item changing (a Claim, the Agent seeing a mark). */
  ignore: string[];
}

const key = (section: string, id: string) => `${section}:${id}`;

/** What an item says, apart from its dates and the lines in `ignore`. */
function content(b: ItemBlock, ignore: string[]): string {
  const skip = [ADDED, UPDATED, ...ignore];
  return JSON.stringify([b.marker, b.text, b.children.filter((c) => !("key" in c) || !skip.includes(c.key))]);
}

function arranged(b: ItemBlock, set?: { name: string; value: string }): ItemBlock["children"] {
  const dated = [ADDED, UPDATED].flatMap((name) => {
    const had = b.children.find((c) => "key" in c && c.key === name) as { value: string } | undefined;
    const value = set?.name === name ? set.value : had?.value;
    return value === undefined ? [] : [{ key: name, value }];
  });
  return [...b.children.filter((c) => !("key" in c) || (c.key !== ADDED && c.key !== UPDATED)), ...dated];
}

/** Puts `added` and then `updated` last in the item's attribute lines, with `set` as the new value of one of them. */
function setLast(b: ItemBlock, name: string, value: string): void {
  b.children = arranged(b, { name, value });
}

/** Whether the item's `added` and `updated` lines are already the last ones, in that order. */
function datesAreLast(b: ItemBlock): boolean {
  return JSON.stringify(arranged(b)) === JSON.stringify(b.children);
}

/**
 * Dates what is about to be saved, by comparing it with the file as it is on disk (by ID): an item
 * that is new gets `added`; one whose content changed gets `updated`; an item that did not change
 * is left as it is, byte for byte. Returns the text to write.
 */
export function stampDates(text: string, before: string | undefined, scope: DateScope, now: Date, by: Actor): string {
  const doc = parseMarkdown(text);
  const old = new Map<string, string>();
  const oldNoId = new Map<string, string>();
  if (before !== undefined) {
    const oldDoc = parseMarkdown(before);
    for (const section of scope.sections)
      for (const b of itemsIn(oldDoc, section)) {
        if (scope.counts && !scope.counts(b)) continue;
        if (b.id) old.set(key(section, b.id), content(b, scope.ignore));
        else oldNoId.set(key(section, b.text), content(b, scope.ignore));
      }
  }
  const stamp = formatStamp({ at: now.toISOString(), by });
  let changed = false;
  for (const section of scope.sections)
    for (const b of itemsIn(doc, section)) {
      if (scope.counts && !scope.counts(b)) continue;
      const was = (b.id ? old.get(key(section, b.id)) : undefined) ?? oldNoId.get(key(section, b.text));
      if (was === undefined) {
        if (getDetail(b, ADDED) === undefined) {
          setLast(b, ADDED, stamp);
          changed = true;
        }
      } else if (was !== content(b, scope.ignore)) {
        setLast(b, UPDATED, stamp);
        changed = true;
      } else if (!datesAreLast(b)) {
        b.children = arranged(b);
        changed = true;
      }
    }
  return changed ? serialiseMarkdown(doc) : text;
}
