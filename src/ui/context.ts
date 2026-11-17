// The Important context page: its place in the address, and its free text split into readable blocks.
import { PAGE_HASH } from "./route.js";

/** The address (hash) of the page, next to `#/goal/<id>` for a Goal. */
export const CONTEXT_HASH = PAGE_HASH.context;

export const contextFromHash = (hash: string) => hash === CONTEXT_HASH;


export type ContextBlock = { kind: "paragraph"; text: string } | { kind: "list"; ordered: boolean; items: string[] };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/** Splits the text at blank lines; a block whose lines are all "- item" or "1. item" becomes a list, anything else a paragraph. */
export function contextBlocks(text: string): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;
    if (lines.every((l) => BULLET.test(l))) {
      blocks.push({ kind: "list", ordered: NUMBERED.test(lines[0]!), items: lines.map((l) => BULLET.exec(l)![1]!.trim()) });
    } else {
      blocks.push({ kind: "paragraph", text: lines.map((l) => l.trim()).join(" ") });
    }
  }
  return blocks;
}

// --- copying the rules and context for everything into one project (Project notes) ---

const sameWords = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The rules for everything this project does not have in its own rules yet. */
export function rulesToCopy<R extends { text: string }>(global: readonly R[], project: readonly { text: string }[]): R[] {
  const have = new Set(project.map((r) => sameWords(r.text)));
  return global.filter((r) => !have.has(sameWords(r.text)));
}

/**
 * The project's context with parts of the context for everything added at the end, each under its
 * title; a part already in it, or empty, is skipped. `fits` is false when the result is over `max`.
 */
export function contextWithCopied(context: string, parts: readonly { title: string; text: string }[], max: number): { text: string; added: number; fits: boolean } {
  let text = context.trim();
  let added = 0;
  for (const p of parts) {
    const body = p.text.trim();
    if (!body || text.includes(body)) continue;
    text = `${text ? `${text}\n\n` : ""}${p.title}:\n${body}`;
    added += 1;
  }
  return { text, added, fits: text.length <= max };
}
