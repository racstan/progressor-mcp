// The Important context page: its place in the address, and its free text split into readable blocks.

/** The address (hash) of the page, next to `#/goal/<id>` for a Goal. */
export const CONTEXT_HASH = "#/context";

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
