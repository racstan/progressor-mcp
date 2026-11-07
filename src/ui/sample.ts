// The tour's sample project. While the tour runs, the page shows "Sample: Recipe box" instead of the
// person's projects, so every step has something to point at, even on a brand-new install. It lives
// only in the page: fixed answers (sampleData.ts, made by scripts/make-sample.mjs) given in place of
// the server's to the page's own reads (data.ts). The server never hears of it, so it is never saved,
// listed, searched or shown to the AI, and anything sent about it is refused.
import { useSyncExternalStore } from "react";
import { SAMPLE_SNAPSHOT } from "./sampleData.js";

export type SampleSnapshot = { takenAt: string; answers: Record<string, unknown> };

/** The sample's project ID, which no real project has. */
export const SAMPLE_ID = "progressor-sample";

/** What sampleAnswer gives for a read the sample leaves to the server. */
export const PASS: unique symbol = Symbol("pass");

let on = false;
const listeners = new Set<() => void>();

export const sampleOn = () => on;

/** Shows the sample instead of the person's projects, or stops; the page loads again on each change. */
export function setSample(value: boolean): void {
  if (on === value) return;
  on = value;
  for (const f of [...listeners]) f();
}

export function onSampleSwitch(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Whether the sample shows, for components: they draw again when it switches. */
export const useSample = () => useSyncExternalStore(onSampleSwitch, sampleOn);

type GoalLine = { id: string; status: string; untriedTests?: number };
const sampleGoals = (SAMPLE_SNAPSHOT.answers[`/api/projects/${SAMPLE_ID}/roadmap`] as { goals: GoalLine[] }).goals;
/** The sample goals the tour shows: the one being worked on, and the one waiting on you. */
export const SAMPLE_GOALS = {
  active: sampleGoals.find((g) => g.status === "active")!.id,
  needs: sampleGoals.find((g) => (g.untriedTests ?? 0) > 0)!.id,
};

const DAY = 86_400_000;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const PLAIN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A copy with every timestamp and plain date moved on by whole days, keeping times of day: ISO
 * strings, plain dates, and milliseconds in a field named like `updatedAt`.
 */
export function shiftDays<T>(value: T, days: number): T {
  if (typeof value === "string") {
    if (STAMP.test(value)) return new Date(Date.parse(value) + days * DAY).toISOString() as T;
    if (PLAIN.test(value)) return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10) as T;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDays(v, days)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, typeof v === "number" && /At$/.test(k) && v > 1e12 ? v + days * DAY : shiftDays(v, days)]),
    ) as T;
  return value;
}

/** Reads that would show the person's own projects: while the sample shows, it answers these itself. */
const OWN = ["/api/projects", "/api/workspaces", "/api/overview", "/api/stats"];

/**
 * The sample's answer to one of the page's reads, with its dates moved on to `now`'s day: undefined
 * when the sample has nothing there (the page then shows it as missing), PASS for reads that don't
 * depend on the projects shown (the version, settings, running servers, search), left to the server.
 */
export function sampleAnswer(path: string, now = Date.now(), snapshot: SampleSnapshot = SAMPLE_SNAPSHOT): unknown {
  const bare = path.split("?")[0]!;
  if (!OWN.includes(bare) && !bare.startsWith("/api/projects/")) return PASS;
  const answer = snapshot.answers[bare];
  if (answer === undefined) return undefined;
  // whole days on the calendar where the page is open, as the plain dates are
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  };
  return shiftDays(answer, day(now) - day(Date.parse(snapshot.takenAt)));
}
