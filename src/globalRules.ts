// Rules and context for every project: the Developer's lasting rules that hold in all their projects
// ("in all my projects, ..."), and one short text of background that holds everywhere. They live in
// one file for the user beside the project list (`~/.progressor/global.json`, or next to the file
// PROGRESSOR_REGISTRY names), not in any project's .progressor/, so every project on this computer
// sees the same ones. get_status and get_rules show them before the project's own rules.
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

export interface GlobalNotes {
  /** In the order they were added; show them with hardFirst. */
  rules: GlobalRule[];
  /** The context for every project; empty when there is none. */
  context: string;
}

/** `global.json` next to the project list. */
export function globalFileFor(registryFile: string): string {
  return join(dirname(registryFile), "global.json");
}

export const defaultGlobalFile = () => globalFileFor(defaultRegistryFile());

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const RULE_ID = /^g(\d+)$/;

/** The rules and context for every project; none when the file is missing or unreadable. */
export function readGlobal(file = defaultGlobalFile()): GlobalNotes {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { rules?: unknown; context?: unknown };
    const rules = Array.isArray(data.rules)
      ? data.rules
          .filter((r): r is GlobalRule => typeof r?.id === "string" && RULE_ID.test(r.id) && typeof r?.text === "string" && r.text.trim() !== "")
          .map((r) => ({ id: r.id, text: oneLine(r.text), hard: r.hard === true }))
      : [];
    return { rules, context: typeof data.context === "string" ? data.context.trim() : "" };
  } catch {
    return { rules: [], context: "" };
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

/** Adds a rule for every project. */
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
 * Rewords a rule for every project, or makes it hard (or a preference again); an empty text removes
 * it, and then undefined is given back.
 */
export function updateGlobalRule(file: string, id: string, changes: { text?: string; hard?: boolean }): GlobalRule | undefined {
  return change(file, (notes) => {
    const at = notes.rules.findIndex((r) => r.id === id.trim().toLowerCase());
    if (at < 0) throw new Error(`No rule ${id} for every project. The IDs (g1, g2...) are in get_status.`);
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

/** Replaces the context for every project; an empty text clears it. Gives the text saved. */
export function setGlobalContext(file: string, text: string): string {
  const context = text.trim();
  if (context.length > MAX_CONTEXT_LENGTH)
    throw new Error(`The context for every project is too long: ${context.length} characters, and the limit is ${MAX_CONTEXT_LENGTH}. Make it shorter.`);
  return change(file, (notes) => {
    notes.context = context;
    return context;
  });
}

/** A global rule as the AI reads it in a list: `g1 text`, or `HARD RULE g2: text`. */
export const globalRuleText = (r: GlobalRule) => (r.hard ? `HARD RULE ${r.id}: ${r.text}` : `${r.id} ${r.text}`);

/** What get_status shows of the rules and context for every project, before the project's own; nothing when there are none. */
export function globalStatusLines(notes: GlobalNotes | undefined): string[] {
  if (!notes) return [];
  const rules = hardFirst(notes.rules);
  return [
    ...(rules.length > 0
      ? [
          `Rules for every project (the Developer's, they apply in all their projects${rules.some((r) => r.hard) ? "; a HARD RULE must never be broken" : ""}):`,
          ...rules.map((r) => `- ${globalRuleText(r)}`),
        ]
      : []),
    ...(notes.context ? ["Context for every project:", notes.context] : []),
  ];
}
