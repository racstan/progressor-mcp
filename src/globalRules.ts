// Rules and context for everything: the Developer's lasting rules that hold in all their projects
// and anywhere the AI uses Progressor on this computer ("in all my projects, ..."), and two short texts
// of background: about this computer (setup facts) and about the Developer and how they work. They
// live in one file for the user beside the project list (`~/.progressor/global.json`, or next to the
// file PROGRESSOR_REGISTRY names), not in any project's .progressor/, so the same ones hold
// everywhere. The server's instructions (sent when an app connects), get_status and get_rules show
// them before a project's own rules, even in a folder with no plan yet.
//
// Global rules have IDs g1, g2... (project rules are s1, s2...) and a hard flag like a project's
// Standing Instructions. The file is read fresh each time; writes are whole-file, temp file then
// rename, under the same hold on the folder as the settings (lock.ts).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultRegistryFile } from "./dashboard/registry.js";
import { withLock } from "./lock.js";
import { MAX_CONTEXT_LENGTH } from "./project.js";
import { hardFirst } from "./roadmap.js";

export interface GlobalRule {
  /** g1, g2...: never given out again while a higher one exists. */
  id: string;
  text: string;
  /** A hard rule must never be broken; any other is a preference. */
  hard: boolean;
}

/** The two parts of the context for everything. */
export type ContextPart = "computer" | "me";
export const CONTEXT_PARTS: ContextPart[] = ["computer", "me"];
/** Each part's heading, as the AI and the Developer read it. */
export const PART_TITLE: Record<ContextPart, string> = { computer: "About this computer", me: "About me and how I work" };

export interface GlobalNotes {
  /** In the order they were added; show them with hardFirst. */
  rules: GlobalRule[];
  /** Setup facts: the operating system, tools, where CI runs, hardware. Empty when there are none. */
  computer: string;
  /** The Developer's preferences and how they work. Empty when there are none. */
  me: string;
}

const EMPTY = (): GlobalNotes => ({ rules: [], computer: "", me: "" });

/** `global.json` next to the project list. */
export function globalFileFor(registryFile: string): string {
  return join(dirname(registryFile), "global.json");
}

export const defaultGlobalFile = () => globalFileFor(defaultRegistryFile());

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const RULE_ID = /^g(\d+)$/;

/** The rules and context for everything; none when the file is missing or unreadable. */
export function readGlobal(file = defaultGlobalFile()): GlobalNotes {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { rules?: unknown; computer?: unknown; me?: unknown };
    const rules = Array.isArray(data.rules)
      ? data.rules
          .filter((r): r is GlobalRule => typeof r?.id === "string" && RULE_ID.test(r.id) && typeof r?.text === "string" && r.text.trim() !== "")
          .map((r) => ({ id: r.id, text: oneLine(r.text), hard: r.hard === true }))
      : [];
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return { rules, computer: text(data.computer), me: text(data.me) };
  } catch {
    return EMPTY();
  }
}

function write(file: string, notes: GlobalNotes): void {
  mkdirSync(dirname(file), { recursive: true });
  const text = `${JSON.stringify(notes, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
  }
}

/** Reads, changes and saves the file while holding the folder's lock. */
function change<T>(file: string, body: (notes: GlobalNotes) => T): T {
  return withLock(dirname(file), () => {
    const notes = readGlobal(file);
    const result = body(notes);
    write(file, notes);
    return result;
  });
}

/** Adds a rule for everything. */
export function addGlobalRule(file: string, text: string, hard = false): GlobalRule {
  const clean = oneLine(text);
  if (!clean) throw new Error("Write the rule first.");
  return change(file, (notes) => {
    const top = Math.max(0, ...notes.rules.map((r) => Number(RULE_ID.exec(r.id)![1])));
    const rule = { id: `g${top + 1}`, text: clean, hard };
    notes.rules.push(rule);
    return rule;
  });
}

/**
 * Rewords a rule for everything, or makes it hard (or a preference again); an empty text removes
 * it, and then undefined is given back.
 */
export function updateGlobalRule(file: string, id: string, changes: { text?: string; hard?: boolean }): GlobalRule | undefined {
  return change(file, (notes) => {
    const at = notes.rules.findIndex((r) => r.id === id.trim().toLowerCase());
    if (at < 0) throw new Error(`No rule ${id} for everything. The IDs (g1, g2...) are in get_status.`);
    if (changes.text !== undefined && !oneLine(changes.text)) {
      notes.rules.splice(at, 1);
      return undefined;
    }
    const rule = notes.rules[at]!;
    if (changes.text !== undefined) rule.text = oneLine(changes.text);
    if (changes.hard !== undefined) rule.hard = changes.hard;
    return { ...rule };
  });
}

/** Replaces one part of the context for everything; an empty text clears it. Gives the text saved. */
export function setGlobalContext(file: string, part: ContextPart, text: string): string {
  if (!CONTEXT_PARTS.includes(part)) throw new Error(`Say which part: ${CONTEXT_PARTS.map((p) => `"${p}"`).join(" or ")}.`);
  const context = text.trim();
  if (context.length > MAX_CONTEXT_LENGTH)
    throw new Error(`"${PART_TITLE[part]}" is too long: ${context.length} characters, and the limit is ${MAX_CONTEXT_LENGTH}. Make it shorter.`);
  return change(file, (notes) => {
    notes[part] = context;
    return context;
  });
}

/** A global rule as the AI reads it in a list: `g1 text`, or `HARD RULE g2: text`. */
export const globalRuleText = (r: GlobalRule) => (r.hard ? `HARD RULE ${r.id}: ${r.text}` : `${r.id} ${r.text}`);

const RULES_HEADING = (hard: boolean) =>
  `Rules for everything (the Developer's: they apply in every project and anywhere you use Progressor on this computer${hard ? "; a HARD RULE must never be broken" : ""}):`;

/** The two context parts that have text, each under its heading. */
export function contextLines(notes: GlobalNotes, cut?: number): string[] {
  return CONTEXT_PARTS.flatMap((part) => {
    const text = notes[part];
    if (!text) return [];
    const shown = cut !== undefined && text.length > cut ? `${text.slice(0, cut).trimEnd()}… (get_rules has all of it)` : text;
    return [`${PART_TITLE[part]} (for everything):`, shown];
  });
}

/** What get_status shows of the rules and context for everything, before a project's own; nothing when there are none. */
export function globalStatusLines(notes: GlobalNotes | undefined): string[] {
  if (!notes) return [];
  const rules = hardFirst(notes.rules);
  return [
    ...(rules.length > 0 ? [RULES_HEADING(rules.some((r) => r.hard)), ...rules.map((r) => `- ${globalRuleText(r)}`)] : []),
    ...contextLines(notes),
  ];
}

/** How many rules that are not hard the server's instructions list before saying how many more there are. */
export const INSTRUCTION_RULES = 10;
/** How much of each context part the server's instructions quote. */
export const INSTRUCTION_CONTEXT = 600;

/**
 * The rules and context for everything as the server's instructions end with them, sent when an app
 * connects, so they hold even in a folder with no plan: every hard rule, the others up to
 * INSTRUCTION_RULES, and each context part up to INSTRUCTION_CONTEXT characters. Empty when there are none.
 */
export function globalInstructions(notes: GlobalNotes): string {
  const hard = notes.rules.filter((r) => r.hard);
  const other = notes.rules.filter((r) => !r.hard);
  const shown = other.slice(0, INSTRUCTION_RULES);
  const more = other.length - shown.length;
  const lines = [
    ...(notes.rules.length > 0 ? [RULES_HEADING(hard.length > 0), ...[...hard, ...shown].map((r) => `- ${globalRuleText(r)}`)] : []),
    ...(more > 0 ? [`- and ${more} more; get_rules lists them all.`] : []),
    ...contextLines(notes, INSTRUCTION_CONTEXT),
  ];
  return lines.join("\n");
}
