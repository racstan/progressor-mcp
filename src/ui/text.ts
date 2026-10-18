// Inline code in Task summaries: Agents write file names and commands in backticks, as in markdown.

export interface TextSegment {
  code: boolean;
  text: string;
}

const CODE_SPAN = /`([^`]+)`/g;

/** Splits text into plain and code segments; an unmatched or empty pair of backticks stays plain text. */
export function inlineCode(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    if (match.index > last) segments.push({ code: false, text: text.slice(last, match.index) });
    segments.push({ code: true, text: match[1] ?? "" });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ code: false, text: text.slice(last) });
  return segments;
}

/** The same text without the backticks around code spans, for places that can only show plain text. */
export function plainText(text: string): string {
  return text.replace(CODE_SPAN, "$1");
}
