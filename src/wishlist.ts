/**
 * The Developer's wishlist: what they want from the project as a whole, apart from Goals and Tasks.
 * Kept in .progressor/wishlist.md as a checklist, one wish per line:
 *
 *   # Wishlist
 *
 *   - [ ] Dark mode on phones ^w1
 *   - [x] Export to PDF ^w2
 *
 * Only the Developer changes it, from the dashboard; the Agent reads it and may suggest Goals from it.
 */

export const WISHLIST_FILE = "wishlist.md";
/** A wish is one short line; longer thoughts belong in a message to the AI. */
export const MAX_WISH_LENGTH = 300;
const HEADING = "# Wishlist";

export interface Wish {
  /** Such as `w3`. */
  id: string;
  text: string;
  /** Ticked off by the Developer: they have what they wished for. */
  granted: boolean;
}

const ITEM = /^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.*?)\s*$/;
const ID = /^(.*?)\s+\^(w\d+)$/;

const idNumber = (id: string) => Number(id.slice(1));

/** The wishes in a wishlist file; a line written by hand without an ID gets the next free one. */
export function parseWishlist(text: string): Wish[] {
  const items: { id?: string; text: string; granted: boolean }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = ITEM.exec(line);
    if (!m || !m[2]) continue;
    const id = ID.exec(m[2]);
    items.push({ id: id?.[2], text: id ? id[1]! : m[2], granted: m[1] !== undefined && m[1] !== " " });
  }
  let next = Math.max(0, ...items.flatMap((w) => (w.id ? [idNumber(w.id)] : []))) + 1;
  const seen = new Set<string>();
  return items.map((w) => {
    // A repeated ID, from a line copied by hand, would make two wishes one; give the copy its own.
    const id = w.id && !seen.has(w.id) ? w.id : `w${next++}`;
    seen.add(id);
    return { id, text: w.text, granted: w.granted };
  });
}

export function formatWishlist(wishes: Wish[]): string {
  if (wishes.length === 0) return `${HEADING}\n`;
  return `${HEADING}\n\n${wishes.map((w) => `- [${w.granted ? "x" : " "}] ${w.text} ^${w.id}`).join("\n")}\n`;
}

/** The next wish's ID: one past the highest in use. */
export function nextWishId(wishes: Wish[]): string {
  return `w${Math.max(0, ...wishes.map((w) => idNumber(w.id))) + 1}`;
}

/** A wish's words as one trimmed line, or an error a person can act on. */
export function wishText(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) throw new Error("Write the wish first.");
  if (one.length > MAX_WISH_LENGTH)
    throw new Error(`The wish is too long: ${one.length} characters, and the limit is ${MAX_WISH_LENGTH}. Keep it to one short line.`);
  return one;
}
