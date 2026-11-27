// Waiting time per step: each stretch a step waited on the Developer or on someone (CI, a provider, a
// person), kept on the step as one `waited` line and shown as totals by who. Spent time (planFile.ts)
// is not touched; this is only a record of where the waiting went.
import { formatDuration, minutesSince, parseDuration, sayDuration } from "./estimate.js";

/** Who a step waits on when it waits on the Developer. */
export const DEVELOPER = "the Developer";
/** The newest this many stretches are kept on a step. */
export const MAX_WAITS = 20;
/** A stretch shorter than this many minutes is not worth keeping. */
export const MIN_WAIT = 0.5;

/** One stretch of waiting: on whom, when it began (ISO) and for how many minutes. */
export interface Wait {
  who: string;
  at: string;
  minutes: number;
  /** Set only on a stretch still running, counted up to now when shown. */
  open?: boolean;
}

/** What a step carries: the stretches that ended (newest first) and the one still running. */
export interface WaitingTask {
  waits?: Wait[] | undefined;
  waitingSince?: { who: string; at: string } | undefined;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").replace(/;/g, ",").trim();

/** The `waited` line: `CI <time> 45m; the Developer <time> 20m`, newest first, at most 20. */
export function formatWaited(waits: readonly Wait[]): string {
  return waits
    .slice(0, MAX_WAITS)
    .map((w) => `${oneLine(w.who)} ${w.at} ${formatDuration(w.minutes)}`)
    .join("; ");
}

/** The stretches in a `waited` line; what cannot be read is skipped. */
export function parseWaited(text: string): Wait[] {
  const out: Wait[] = [];
  for (const part of text.split(";")) {
    const m = /^\s*(.+?) (\d{4}-\d{2}-\d{2}T[\d:.]+Z) (.+?)\s*$/.exec(part);
    const minutes = m ? parseDuration(m[3]!) : undefined;
    if (m && minutes !== undefined && !Number.isNaN(Date.parse(m[2]!))) out.push({ who: m[1]!, at: m[2]!, minutes });
  }
  return out.slice(0, MAX_WAITS);
}

/** The running stretch of a step, counted up to `now`. */
export function openWait(task: WaitingTask, now: Date): Wait | undefined {
  const o = task.waitingSince;
  return o ? { who: o.who, at: o.at, minutes: Math.max(0, minutesSince(o.at, now)), open: true } : undefined;
}

/** A step's stretches: the running one first, then the ended ones, newest first. */
export function stepWaits(task: WaitingTask, now: Date): Wait[] {
  const open = openWait(task, now);
  return [...(open ? [open] : []), ...(task.waits ?? [])];
}

export interface WaitTotal {
  who: string;
  minutes: number;
  /** The part of it that falls today (since local midnight). */
  today: number;
}

/** Waiting by who across steps, the biggest first; a running stretch counts up to `now`. */
export function waitTotals(tasks: readonly WaitingTask[], now: Date): WaitTotal[] {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const by = new Map<string, WaitTotal & { key: string }>();
  for (const task of tasks) {
    for (const w of stepWaits(task, now)) {
      const key = w.who.toLowerCase();
      const total = by.get(key) ?? { key, who: w.who, minutes: 0, today: 0 };
      const start = Date.parse(w.at);
      const end = start + w.minutes * 60_000;
      total.minutes += w.minutes;
      total.today += Math.max(0, (Math.min(end, now.getTime()) - Math.max(start, startOfDay)) / 60_000);
      by.set(key, total);
    }
  }
  return [...by.values()]
    .map(({ key: _key, ...t }) => ({ ...t, minutes: Math.round(t.minutes), today: Math.round(t.today) }))
    .filter((t) => t.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.who.localeCompare(b.who));
}

/** `Waited: 3 h 50 m on CI (1 h 10 m today), 20 m on the Developer`; undefined when there was no waiting. */
export function waitLine(totals: readonly WaitTotal[]): string | undefined {
  if (totals.length === 0) return undefined;
  return `Waited: ${totals.map((t) => `${sayDuration(t.minutes)} on ${t.who}${t.today > 0 ? ` (${sayDuration(t.today)} today)` : ""}`).join(", ")}`;
}

/** One stretch in plain words: "Waited on CI for 45 m", or "Waiting on CI for 45 m so far" while it runs. */
export function stepWaitLine(w: Wait): string {
  return w.open ? `Waiting on ${w.who} for ${sayDuration(w.minutes)} so far` : `Waited on ${w.who} for ${sayDuration(w.minutes)}`;
}
