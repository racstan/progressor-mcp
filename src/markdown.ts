// A lossless, line-based model of a Progressor markdown file.
//
// Every line becomes part of a block. Top-level list lines (with their indented
// children) are items; `#` headings are headings; everything else is kept as
// text. Each item and heading remembers the lines it was parsed from and the
// canonical form it had at parse time, so serialising an untouched block gives
// back the original bytes, and only blocks that were changed are rewritten.

export type Marker = " " | "/" | "x" | "-";

export type Child = { key: string; value: string } | { raw: string };

export interface ItemBlock {
  type: "item";
  /** Checkbox marker, or undefined for a plain list line. */
  marker: Marker | undefined;
  text: string;
  id: string | undefined;
  children: Child[];
  /** 1-based line number of the item line in the parsed file; 0 for new items. */
  line: number;
  section: string | undefined;
  raw: string[] | undefined;
  parsedAs: string | undefined;
}

export interface HeadingBlock {
  type: "heading";
  level: number;
  text: string;
  id: string | undefined;
  line: number;
  raw: string[] | undefined;
  parsedAs: string | undefined;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export type Block = ItemBlock | HeadingBlock | TextBlock;

export interface MarkdownDoc {
  eol: "\n" | "\r\n";
  finalNewline: boolean;
  blocks: Block[];
}

const HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const ITEM = /^[-*+]\s+(?:\[([ xX/-])\]\s+)?(.*)$/;
const ID_SUFFIX = /\s+\^([A-Za-z0-9][\w-]*)\s*$/;
const DETAIL = /^\s+[-*+]\s+([a-z][a-z ]*?):\s*(.*?)\s*$/;
const FENCE = /^\s*(```|~~~)/;

function splitId(text: string): { text: string; id: string | undefined } {
  const m = ID_SUFFIX.exec(text);
  if (!m) return { text: text.trim(), id: undefined };
  return { text: text.slice(0, m.index).trim(), id: m[1] };
}

export function parseMarkdown(source: string): MarkdownDoc {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(eol);
  const finalNewline = lines.length > 1 && lines[lines.length - 1] === "";
  if (finalNewline) lines.pop();
  if (lines.length === 1 && lines[0] === "") lines.pop();

  const blocks: Block[] = [];
  let section: string | undefined;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (inFence || FENCE.test(line)) {
      if (FENCE.test(line)) inFence = !inFence;
      blocks.push({ type: "text", text: line });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const { text, id } = splitId(h[2]!);
      const block: HeadingBlock = {
        type: "heading",
        level: h[1]!.length,
        text,
        id,
        line: i + 1,
        raw: [line],
        parsedAs: undefined,
      };
      block.parsedAs = formatHeading(block).join("\n");
      if (block.level === 2) section = text;
      blocks.push(block);
      continue;
    }
    const m = ITEM.exec(line);
    if (m) {
      const { text, id } = splitId(m[2]!);
      const marker = m[1] === undefined ? undefined : (m[1].toLowerCase() as Marker);
      const raw = [line];
      const children: Child[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]!) && !FENCE.test(lines[i + 1]!)) {
        const child = lines[++i]!;
        raw.push(child);
        const d = DETAIL.exec(child);
        children.push(d ? { key: d[1]!, value: d[2]! } : { raw: child });
      }
      const block: ItemBlock = {
        type: "item",
        marker,
        text,
        id,
        children,
        line: i + 2 - raw.length,
        section,
        raw,
        parsedAs: undefined,
      };
      block.parsedAs = formatItem(block).join("\n");
      blocks.push(block);
      continue;
    }
    blocks.push({ type: "text", text: line });
  }
  return { eol, finalNewline, blocks };
}

function formatHeading(b: HeadingBlock): string[] {
  return [`${"#".repeat(b.level)} ${b.text}${b.id ? ` ^${b.id}` : ""}`];
}

function formatItem(b: ItemBlock): string[] {
  const box = b.marker === undefined ? "" : `[${b.marker}] `;
  return [
    `- ${box}${b.text}${b.id ? ` ^${b.id}` : ""}`,
    ...b.children.map((c) => ("raw" in c ? c.raw : `  - ${c.key}: ${c.value}`)),
  ];
}

function blockLines(b: Block): string[] {
  if (b.type === "text") return [b.text];
  const canonical = b.type === "item" ? formatItem(b) : formatHeading(b);
  return b.raw && canonical.join("\n") === b.parsedAs ? b.raw : canonical;
}

export function serialiseMarkdown(doc: MarkdownDoc): string {
  const lines = doc.blocks.flatMap(blockLines);
  return lines.join(doc.eol) + (doc.finalNewline && lines.length > 0 ? doc.eol : "");
}

export function newItem(fields: Pick<ItemBlock, "marker" | "text" | "id"> & { children?: Child[] }): ItemBlock {
  return {
    type: "item",
    marker: fields.marker,
    text: fields.text,
    id: fields.id,
    children: fields.children ?? [],
    line: 0,
    section: undefined,
    raw: undefined,
    parsedAs: undefined,
  };
}

export function newHeading(level: number, text: string, id?: string): HeadingBlock {
  return { type: "heading", level, text, id, line: 0, raw: undefined, parsedAs: undefined };
}

export function getDetail(item: ItemBlock, key: string): string | undefined {
  for (const c of item.children) if ("key" in c && c.key === key) return c.value;
  return undefined;
}

export function getDetails(item: ItemBlock, key: string): string[] {
  return item.children.flatMap((c) => ("key" in c && c.key === key ? [c.value] : []));
}

/** Sets a detail, replacing an existing one with the same key, or removes it when value is undefined. */
export function setDetail(item: ItemBlock, key: string, value: string | undefined): void {
  const at = item.children.findIndex((c) => "key" in c && c.key === key);
  if (value === undefined) {
    if (at >= 0) item.children.splice(at, 1);
  } else if (at >= 0) {
    item.children[at] = { key, value };
  } else {
    item.children.push({ key, value });
  }
}

export function addDetail(item: ItemBlock, key: string, value: string): void {
  item.children.push({ key, value });
}

/** Index range [start, end) of the blocks belonging to a level-2 section, excluding its heading. */
function sectionRange(doc: MarkdownDoc, headingIndex: number): [number, number] {
  let end = headingIndex + 1;
  while (end < doc.blocks.length) {
    const b = doc.blocks[end]!;
    if (b.type === "heading" && b.level <= 2) break;
    end++;
  }
  return [headingIndex + 1, end];
}

export function findSection(doc: MarkdownDoc, name: string): number {
  return doc.blocks.findIndex((b) => b.type === "heading" && b.level === 2 && b.text === name);
}

function isBlank(b: Block | undefined): boolean {
  return b !== undefined && b.type === "text" && b.text.trim() === "";
}

/** Appends a new level-2 section (heading, blank line, body) at the end of the file. */
export function appendSection(doc: MarkdownDoc, heading: HeadingBlock, body: Block[]): void {
  while (doc.blocks.length > 0 && isBlank(doc.blocks[doc.blocks.length - 1])) doc.blocks.pop();
  if (doc.blocks.length > 0) doc.blocks.push({ type: "text", text: "" });
  doc.blocks.push(heading, { type: "text", text: "" }, ...body);
  doc.finalNewline = true;
}

/** Inserts a new level-2 section (heading, blank line, items, blank line) right before a heading. */
export function insertSectionBefore(doc: MarkdownDoc, before: HeadingBlock, heading: HeadingBlock, items: ItemBlock[]): void {
  for (const item of items) item.section = heading.text;
  doc.blocks.splice(doc.blocks.indexOf(before), 0, heading, { type: "text", text: "" }, ...items, { type: "text", text: "" });
}

/** Appends items to the end of a section's list, creating the section when it is missing. */
export function appendToSection(doc: MarkdownDoc, name: string, items: ItemBlock[]): void {
  for (const item of items) item.section = name;
  const h = findSection(doc, name);
  if (h < 0) {
    appendSection(doc, newHeading(2, name), items);
    return;
  }
  appendAt(doc, h, items);
}

/**
 * Appends items to the list under one particular heading. Two sections can share a name (two
 * Detours with the same title), so this goes by the heading itself rather than its text.
 */
export function appendUnder(doc: MarkdownDoc, heading: HeadingBlock, items: ItemBlock[]): void {
  for (const item of items) item.section = heading.text;
  appendAt(doc, doc.blocks.indexOf(heading), items);
}

function appendAt(doc: MarkdownDoc, h: number, items: ItemBlock[]): void {
  const [start, end] = sectionRange(doc, h);
  let lastItem = -1;
  for (let i = start; i < end; i++) if (doc.blocks[i]!.type === "item") lastItem = i;
  if (lastItem >= 0) {
    doc.blocks.splice(lastItem + 1, 0, ...items);
    return;
  }
  // Empty section: keep one blank line after the heading, and one before the next heading.
  const insert: Block[] = isBlank(doc.blocks[start]) ? items : [{ type: "text", text: "" }, ...items];
  const at = isBlank(doc.blocks[start]) ? start + 1 : start;
  if (at >= end && end < doc.blocks.length) insert.push({ type: "text", text: "" });
  doc.blocks.splice(at, 0, ...insert);
  if (end >= doc.blocks.length - insert.length) doc.finalNewline = true;
}

/** The items in the section under one particular heading (see appendUnder). */
export function itemsUnder(doc: MarkdownDoc, heading: HeadingBlock): ItemBlock[] {
  const h = doc.blocks.indexOf(heading);
  if (h < 0) return [];
  const [start, end] = sectionRange(doc, h);
  return doc.blocks.slice(start, end).filter((b): b is ItemBlock => b.type === "item");
}

export function itemsIn(doc: MarkdownDoc, section: string): ItemBlock[] {
  return doc.blocks.filter((b): b is ItemBlock => b.type === "item" && b.section === section);
}

/** The next free ID with the given prefix: one more than the highest number already used. */
export function nextId(ids: (string | undefined)[], prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of ids) {
    const m = id ? re.exec(id) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}
