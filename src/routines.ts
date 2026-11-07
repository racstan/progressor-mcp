// Recurring goals: a routine in the Roadmap's `## Routines` section brings a goal back on a set pace
// (every day, week, two weeks, month, or on a weekday). When it is due, the AI's next get_status (or
// the dashboard's timer) adds a fresh goal from it, without anyone being asked. It never stacks: while
// the goal it made last is still open, no new one is added, and missed turns are skipped, not piled up.
//
// This module is pure (no files), so the dashboard's page can use the words too. Writing routines is
// in roadmap.ts (the section) and project.ts (running them under the plan's lock).
import type { Goal } from "./roadmap.js";

/** How often a routine comes back: every n days (a week is 7), every n months, or on a weekday (0 Sunday … 6 Saturday). */
export type Every = { kind: "days"; n: number } | { kind: "months"; n: number } | { kind: "weekday"; day: number };

/** A routine as the Roadmap has it. */
export interface Routine {
  id: string;
  ref: string;
  title: string;
  /** How often, as written: 1d, 1w, 2w, 1mo, monday. */
  every: string;
  /** When the next goal is due (ISO). */
  next: string | undefined;
  outcome: string | undefined;
  /** The steps each goal gets, as written: "Run npm audit (30m)". */
  steps: string[];
  /** The goal it made last, by ID. */
  lastGoal: string | undefined;
  paused: boolean;
  line: number;
}

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ALIASES: Record<string, string> = { daily: "1d", weekly: "1w", fortnightly: "2w", monthly: "1mo" };
const PACE = /^(\d{1,3})\s*(d|days?|w|weeks?|mo|months?)$/;

/** Reads how often a routine comes back; undefined when it can't be read. */
export function parseEvery(text: string): Every | undefined {
  let t = text.trim().toLowerCase().replace(/^every\s+/, "");
  if (t in ALIASES) t = ALIASES[t]!;
  const day = WEEKDAYS.findIndex((d) => d === t || (t.length >= 3 && d.startsWith(t)));
  if (t && day >= 0) return { kind: "weekday", day };
  const m = PACE.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (n < 1) return undefined;
  const unit = m[2]!;
  if (unit.startsWith("mo")) return { kind: "months", n };
  return { kind: "days", n: unit.startsWith("w") ? n * 7 : n };
}

/** The usual way to write a pace: 1d, 2w, 1mo, monday. */
export function formatEvery(e: Every): string {
  if (e.kind === "weekday") return WEEKDAYS[e.day]!;
  if (e.kind === "months") return `${e.n}mo`;
  return e.n % 7 === 0 ? `${e.n / 7}w` : `${e.n}d`;
}

/** A pace in plain words: "every week", "every 2 weeks", "every Monday". */
export function everyWords(text: string): string {
  const e = parseEvery(text);
  if (!e) return text;
  if (e.kind === "weekday") return `every ${WEEKDAYS[e.day]![0]!.toUpperCase()}${WEEKDAYS[e.day]!.slice(1)}`;
  const [n, unit] = e.kind === "months" ? [e.n, "month"] : e.n % 7 === 0 ? [e.n / 7, "week"] : [e.n, "day"];
  return n === 1 ? `every ${unit}` : `every ${n} ${unit}s`;
}

/**
 * When a routine is next due after `from`, in this computer's local time, so it keeps its time of day
 * across a clock change: n days or months later at the same time (a month's end stays in the next
 * month), or the start of the next named weekday.
 */
export function nextDue(e: Every, from: Date): Date {
  const d = new Date(from.getTime());
  if (e.kind === "days") {
    d.setDate(d.getDate() + e.n);
    return d;
  }
  if (e.kind === "months") {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + e.n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d;
  }
  const ahead = (e.day - d.getDay() + 7) % 7 || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + ahead);
}

/** The first due time after `now`, stepping on from `next`: missed turns are skipped, not piled up. */
export function nextAfter(e: Every, next: Date, now: Date): Date {
  let at = next;
  for (let i = 0; i < 100_000 && at.getTime() <= now.getTime(); i++) at = nextDue(e, at);
  return at;
}

const isOpen = (g: Goal | undefined) => !!g && g.status !== "done" && g.status !== "dropped";

/**
 * The routines due now: not paused, their time has come, and no goal they made is still open (a
 * routine never stacks). A routine whose pace or time can't be read is never due.
 */
export function dueRoutines(roadmap: { routines: Routine[]; goals: Goal[] }, now: Date): Routine[] {
  const goals = roadmap.goals;
  return roadmap.routines.filter((r) => {
    if (r.paused || !parseEvery(r.every) || !r.next) return false;
    const at = Date.parse(r.next);
    if (Number.isNaN(at) || at > now.getTime()) return false;
    return !goals.some((g) => isOpen(g) && (g.id === r.lastGoal || g.fromRoutine === r.id));
  });
}

const STEP = /^(.*?)\s*\((\d[^()]*)\)\s*$/;
/** A routine's step line split into its title and estimate text: "Run npm audit (30m)". */
export function splitStep(step: string): { title: string; estimate?: string } {
  const m = STEP.exec(step);
  return m ? { title: m[1]!, estimate: m[2]! } : { title: step.trim() };
}
