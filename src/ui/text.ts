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
  return text.replace(CODE_SPAN, "$1").replace(/\s*\(progressor:\/\/[^)\s]*\)/g, "");
}

// Highlights: what to look at in the AI's words, found by itself (see highlights below).

export type HighlightKind = "plain" | "code" | "label" | "path" | "file";

export interface Highlight {
  kind: HighlightKind;
  /** For a label, the words inside the quotes. */
  text: string;
}

/** Something to click or type, in straight or curly double quotes: short, on one line. */
const LABEL = /["“]([^"“”\n]{1,60})["”]/g;
/** A run of text with menu-path arrows in it; menuPath trims its ends to the path itself. */
const PATH_RUN = /(?:[^›\n]*›)+[^›\n]*/g;
const EXTENSIONS =
  "ps1|psm1|sh|bash|bat|cmd|js|mjs|cjs|ts|tsx|jsx|json|jsonc|md|txt|yml|yaml|toml|html|css|scss|py|rb|rs|go|java|kt|cs|cpp|sql|env|lock|png|jpg|jpeg|gif|svg|webp|mp4|pdf|csv|xml|ini|cfg|conf|log|exe|msi|zip|dll|vue|svelte";
/** A file name with a known ending (start.ps1, src/ui/App.tsx) or a dotfile (.env), with any folders before it. */
const FILE = new RegExp(
  String.raw`(?<![\w./-])(?:[\w.-]+/)*(?:[\w-]+(?:\.[\w-]+)*\.(?:${EXTENSIONS})|\.(?:env|gitignore|gitattributes|npmrc|editorconfig|prettierrc|eslintrc)[\w.-]*)(?![\w/-])`,
  "g",
);
/** Words that end a menu path: "Settings › Help and click" is the path Settings › Help. */
const JOINING = new Set(["and", "or", "then", "to", "at", "in", "on", "for", "with", "from", "if", "when", "while", "so", "but"]);
const PUNCTUATION = /[.,;:!?()"“”]/;
const MAX_PATH_WORDS = 4;

type Found = { start: number; end: number; kind: HighlightKind; text: string };

/** The menu path inside a run like "go to Settings › Notifications › Desktop pop-ups. Follow", as offsets in the run. */
function menuPath(run: string): { start: number; end: number } | undefined {
  const parts = run.split("›");
  if (!parts.at(-1)!.trim()) parts.pop();
  if (parts.length < 2 || parts.slice(1, -1).some((p) => !p.trim())) return undefined;
  // The first part: the capitalised words just before the first arrow, or else the one word there.
  const before = parts[0]!.trimEnd().split(" ");
  let first = 0;
  while (first < MAX_PATH_WORDS && first < before.length) {
    const w = before[before.length - 1 - first]!;
    if (!/^[A-Z0-9]/.test(w) || PUNCTUATION.test(w)) break;
    first++;
  }
  if (first === 0) {
    const w = before.at(-1)!;
    if (!w || PUNCTUATION.test(w)) return undefined;
    first = 1;
  }
  const firstText = before.slice(-first).join(" ");
  const start = parts[0]!.trimEnd().length - firstText.length;
  // The last part: words up to punctuation or a joining word.
  const last = parts.at(-1)!;
  const lead = last.length - last.trimStart().length;
  const taken: string[] = [];
  for (const w of last.trimStart().split(" ")) {
    if (!w || JOINING.has(w) || taken.length === MAX_PATH_WORDS) break;
    const cut = PUNCTUATION.exec(w);
    if (cut) {
      if (cut.index > 0) taken.push(w.slice(0, cut.index));
      break;
    }
    taken.push(w);
  }
  if (taken.length === 0) return undefined;
  const lastStart = parts.slice(0, -1).reduce((n, p) => n + p.length + 1, 0);
  return { start, end: lastStart + lead + taken.join(" ").length };
}

/** Labels, menu paths and file names in text without code, in order, the earlier one winning where two overlap. */
function findIn(text: string): Found[] {
  const found: Found[] = [];
  for (const m of text.matchAll(LABEL)) found.push({ start: m.index, end: m.index + m[0].length, kind: "label", text: m[1]! });
  for (const m of text.matchAll(PATH_RUN)) {
    const p = menuPath(m[0]);
    if (p) found.push({ start: m.index + p.start, end: m.index + p.end, kind: "path", text: text.slice(m.index + p.start, m.index + p.end) });
  }
  for (const m of text.matchAll(FILE)) found.push({ start: m.index, end: m.index + m[0].length, kind: "file", text: m[0] });
  const order: HighlightKind[] = ["label", "path", "file"];
  found.sort((a, b) => a.start - b.start || order.indexOf(a.kind) - order.indexOf(b.kind));
  const kept: Found[] = [];
  for (const f of found) if (!kept.length || f.start >= kept.at(-1)!.end) kept.push(f);
  return kept;
}

/**
 * Splits the AI's words into plain text and what is worth looking at: `code`, things to click in
 * "quotes", menu paths (Settings › Notifications) and file names (start.ps1), so the dashboard can
 * make them stand out. Nothing is found inside code.
 */
export function highlights(text: string): Highlight[] {
  const out: Highlight[] = [];
  const plain = (s: string) => s && out.push({ kind: "plain", text: s });
  for (const seg of inlineCode(text)) {
    if (seg.code) {
      out.push({ kind: "code", text: seg.text });
      continue;
    }
    let at = 0;
    for (const f of findIn(seg.text)) {
      plain(seg.text.slice(at, f.start));
      out.push({ kind: f.kind, text: f.text });
      at = f.end;
    }
    plain(seg.text.slice(at));
  }
  // Neighbouring plain pieces (around a backtick pair that stayed plain) read as one.
  return out.reduce<Highlight[]>((all, h) => {
    const prev = all.at(-1);
    if (prev?.kind === "plain" && h.kind === "plain") prev.text += h.text;
    else all.push({ ...h });
    return all;
  }, []);
}
