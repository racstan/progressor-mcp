/**
 * Merging two versions of a plan, goal by goal and step by step (plan sync).
 *
 * A plan file is split into sections (at `## ` headings) and each section into blocks (a `- ` item with
 * its indented lines). Each unit is merged three ways against the version both sides last agreed on, so
 * two computers that changed different goals or steps both keep their changes. Where both changed the
 * same unit, the newer one is kept and the other is reported as a conflict so it is not lost silently.
 * Pure text in, text out: nothing here touches git or the disk.
 */

export interface MergeConflict {
  /** The section's title (`Tasks`), or "" for the text above the first `## ` heading. */
  section: string;
  /** The block's ID (`t1`), its first line when it has none, or "" for a whole section or file. */
  id: string;
  kept: "ours" | "theirs";
  /** The text of the version that lost; "" when the other side deleted it. */
  lost: string;
}

export interface MergeOptions {
  /** When the caller's version of the file last changed (ms since 1970); breaks ties when no block carries a time. */
  oursTime?: number;
  theirsTime?: number;
}

interface Block {
  key: string;
  id: string;
  lines: string[];
}

interface Section {
  /** The `## ` line, or undefined for the header above the first heading. */
  heading: string | undefined;
  /** Lines between the heading and the first item (or all of the body when there are no items). */
  pre: string[];
  blocks: Block[];
  /** Blank lines that end the section (for the last section, the file's final newline). */
  tail: string[];
}

const ITEM = /^- /;
const ID_AT_END = /\^([A-Za-z0-9_-]+)\s*$/;
const TIME_LINE = /^\s+- [^:\n]+:\s*(\d{4}-\d{2}-\d{2}T[0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)/;
const blank = (line: string): boolean => /^\s*$/.test(line);

function splitBody(body: string[], heading: string | undefined): Section {
  let end = body.length;
  while (end > 0 && blank(body[end - 1]!)) end--;
  const tail = body.slice(end);
  const used = body.slice(0, end);
  const starts: number[] = [];
  used.forEach((line, i) => {
    if (ITEM.test(line)) starts.push(i);
  });
  const pre = used.slice(0, starts[0] ?? used.length);
  const seen = new Map<string, number>();
  const blocks: Block[] = starts.map((s, i) => {
    const lines = used.slice(s, starts[i + 1] ?? used.length);
    const first = lines[0]!;
    const found = ID_AT_END.exec(first)?.[1];
    const id = found ?? first;
    let key = found ? `id:${found}` : `line:${first}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) key += `#${n}`;
    return { key, id, lines };
  });
  return { heading, pre, blocks, tail };
}

function parse(text: string): Section[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let heading: string | undefined;
  let body: string[] = [];
  const flush = (): void => {
    sections.push(splitBody(body, heading));
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line;
      body = [];
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
}

function sectionLines(s: Section): string[] {
  return [...(s.heading === undefined ? [] : [s.heading]), ...s.pre, ...s.blocks.flatMap((b) => b.lines), ...s.tail];
}

function serialise(sections: Section[]): string {
  return sections.flatMap(sectionLines).join("\n");
}

const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The latest time written on a `  - key: <ISO time>` line, in ms; undefined when there is none. */
function latestTime(lines: string[]): number | undefined {
  let best: number | undefined;
  for (const line of lines) {
    const m = TIME_LINE.exec(line);
    if (!m) continue;
    const t = Date.parse(m[1]!);
    if (!Number.isNaN(t) && (best === undefined || t > best)) best = t;
  }
  return best;
}

function newer(o: string[], t: string[], opts: MergeOptions): "ours" | "theirs" {
  const ot = latestTime(o);
  const tt = latestTime(t);
  if (ot !== undefined && tt === undefined) return "ours";
  if (ot === undefined && tt !== undefined) return "theirs";
  if (ot !== undefined && tt !== undefined && ot !== tt) return ot > tt ? "ours" : "theirs";
  if (opts.oursTime !== undefined && opts.theirsTime !== undefined && opts.oursTime !== opts.theirsTime) {
    return opts.theirsTime > opts.oursTime ? "theirs" : "ours";
  }
  return "ours";
}

/** Three-way merge of one chunk of lines; `base` undefined means nobody had it before. */
function mergeLines(base: string[] | undefined, o: string[], t: string[], opts: MergeOptions, onConflict?: (kept: "ours" | "theirs", lost: string[]) => void): string[] {
  if (same(o, t)) return o;
  if (base && same(o, base)) return t;
  if (base && same(t, base)) return o;
  const kept = newer(o, t, opts);
  onConflict?.(kept, kept === "ours" ? t : o);
  return kept === "ours" ? o : t;
}

interface Item<V> {
  key: string;
  val: V;
}

/**
 * Merge two ordered lists of keyed units against a base. Ours' order wins; a unit only theirs has goes
 * right after the unit that precedes it in theirs.
 */
function mergeOrdered<V>(
  base: Item<V>[],
  ours: Item<V>[],
  theirs: Item<V>[],
  eq: (a: V, b: V) => boolean,
  both: (b: V | undefined, o: V, t: V) => V,
  oneSideChanged: (key: string, kept: "ours" | "theirs") => void,
): Item<V>[] {
  const bm = new Map(base.map((i) => [i.key, i.val]));
  const om = new Map(ours.map((i) => [i.key, i.val]));
  const tm = new Map(theirs.map((i) => [i.key, i.val]));
  const result: Item<V>[] = [];
  for (const o of ours) {
    const t = tm.get(o.key);
    const b = bm.get(o.key);
    if (t === undefined) {
      if (b !== undefined && eq(o.val, b)) continue; // deleted by theirs, unchanged here
      if (b !== undefined) oneSideChanged(o.key, "ours"); // deleted by theirs, changed here
      result.push(o);
    } else if (eq(o.val, t)) result.push(o);
    else if (b !== undefined && eq(o.val, b)) result.push({ key: o.key, val: t });
    else if (b !== undefined && eq(t, b)) result.push(o);
    else result.push({ key: o.key, val: both(b, o.val, t) });
  }
  theirs.forEach((t, i) => {
    if (om.has(t.key)) return;
    const b = bm.get(t.key);
    if (b !== undefined) {
      if (eq(t.val, b)) return; // deleted by ours, unchanged there
      oneSideChanged(t.key, "theirs");
    }
    let at = 0;
    for (let j = i - 1; j >= 0 && at === 0; j--) {
      const idx = result.findIndex((r) => r.key === theirs[j]!.key);
      if (idx >= 0) at = idx + 1;
    }
    result.splice(at, 0, t);
  });
  return result;
}

const nameOf = (s: Section): string => (s.heading === undefined ? "" : s.heading.replace(/^##\s+/, "").trim());
const EMPTY = (heading: string | undefined): Section => ({ heading, pre: [], blocks: [], tail: [] });

function mergeSection(base: Section | undefined, o: Section, t: Section, opts: MergeOptions, conflicts: MergeConflict[]): Section {
  const name = nameOf(o);
  const b = base ?? EMPTY(o.heading);
  const pre = mergeLines(b.pre, o.pre, t.pre, opts, (kept, lost) => conflicts.push({ section: name, id: "(intro)", kept, lost: lost.join("\n") }));
  const tail = mergeLines(b.tail, o.tail, t.tail, opts);
  const blocks = mergeOrdered<Block>(
    b.blocks.map((x) => ({ key: x.key, val: x })),
    o.blocks.map((x) => ({ key: x.key, val: x })),
    t.blocks.map((x) => ({ key: x.key, val: x })),
    (x, y) => same(x.lines, y.lines),
    (_b, x, y) => {
      const kept = newer(x.lines, y.lines, opts);
      conflicts.push({ section: name, id: x.id, kept, lost: (kept === "ours" ? y : x).lines.join("\n") });
      return kept === "ours" ? x : y;
    },
    (key, kept) => {
      const src = (kept === "ours" ? o : t).blocks.find((x) => x.key === key)!;
      conflicts.push({ section: name, id: src.id, kept, lost: "" });
    },
  ).map((i) => i.val);
  return { heading: o.heading, pre, blocks, tail };
}

/**
 * Merge one plan file (roadmap.md, a goal's file, wishlist.md or context.md). `base` is the version both
 * sides last agreed on; without one, only blocks both sides have and differ on are conflicts.
 */
export function mergePlanFile(base: string | undefined, ours: string, theirs: string, opts: MergeOptions = {}): { text: string; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const bs = base === undefined ? [] : parse(base);
  const os = parse(ours);
  const ts = parse(theirs);
  const bHead = bs[0];
  const header = mergeSection(bHead, os[0]!, ts[0]!, opts, conflicts);
  const sectionItems = (list: Section[]): Item<Section>[] => list.slice(1).map((s) => ({ key: s.heading!.trim(), val: s }));
  const rest = mergeOrdered<Section>(
    sectionItems(bs),
    sectionItems(os),
    sectionItems(ts),
    (x, y) => same(sectionLines(x), sectionLines(y)),
    (b, x, y) => mergeSection(b, x, y, opts, conflicts),
    (key, kept) => conflicts.push({ section: key.replace(/^##\s+/, "").trim(), id: "", kept, lost: "" }),
  ).map((i) => i.val);
  return { text: serialise([header, ...rest]), conflicts };
}

export interface FolderTimes {
  oursTimes?: Map<string, number>;
  theirsTimes?: Map<string, number>;
}

/** Merge every plan file in a project's plan folder, keyed by path inside it (`roadmap.md`, `goals/x.md`). */
export function mergePlanFolder(
  base: Map<string, string>,
  ours: Map<string, string>,
  theirs: Map<string, string>,
  times: FolderTimes = {},
): { files: Map<string, string>; conflicts: (MergeConflict & { file: string })[] } {
  const files = new Map<string, string>();
  const conflicts: (MergeConflict & { file: string })[] = [];
  const paths = new Set([...ours.keys(), ...theirs.keys()]);
  for (const file of [...paths].sort()) {
    const b = base.get(file);
    const o = ours.get(file);
    const t = theirs.get(file);
    if (o !== undefined && t !== undefined) {
      const r = mergePlanFile(b, o, t, { oursTime: times.oursTimes?.get(file), theirsTime: times.theirsTimes?.get(file) });
      files.set(file, r.text);
      for (const c of r.conflicts) conflicts.push({ file, ...c });
      continue;
    }
    const only = (o ?? t)!;
    const kept = o !== undefined ? "ours" : "theirs";
    if (b === undefined) files.set(file, only); // added on one side
    else if (b.replace(/\r\n/g, "\n") === only.replace(/\r\n/g, "\n")) continue; // deleted on one side, unchanged on the other
    else {
      files.set(file, only); // deleted on one side, changed on the other: keep it
      conflicts.push({ file, section: "", id: "", kept, lost: "" });
    }
  }
  return { files, conflicts };
}
