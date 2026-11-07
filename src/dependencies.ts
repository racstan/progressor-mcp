// Goals that wait on other goals: a goal's `waits on` lines name goals in this project (`login`) or in
// another one (`api/ship-v2`, by the project's name or ID on the dashboard). Waiting is worked out from
// those goals' state each time, never stored, and it never stops anyone: the AI is told, the schedule
// starts the goal after the ones it waits on, and the dashboard shows it waiting.
import type { GoalStatus } from "./roadmap.js";

export interface WaitRef {
  /** The other project, when the goal is not in this one. */
  project?: string;
  goal: string;
  /** As written: `login` or `api/ship-v2`. */
  raw: string;
}

/** What a waited-on goal is now: finished (done or cancelled), still open, or not found. */
export type WaitState = "finished" | "open" | "unknown";

export interface Waiting {
  ref: WaitRef;
  state: WaitState;
  title?: string;
}

/** Looks up a goal in another project; undefined when the project or goal is unknown. */
export type GoalLookup = (project: string, goal: string) => { title: string; status: GoalStatus } | undefined;

export function parseWaitRef(text: string): WaitRef {
  const raw = text.trim();
  const slash = raw.lastIndexOf("/");
  if (slash <= 0) return { goal: raw, raw };
  return { project: raw.slice(0, slash).trim(), goal: raw.slice(slash + 1).trim(), raw };
}

/** A goal is finished for those waiting on it once it is done, or cancelled (it will never finish). */
export const finishedState = (status: GoalStatus): WaitState => (status === "done" || status === "dropped" ? "finished" : "open");

/**
 * The loop `goal` would be in if it waited on `wanted` (goals in this project), as the path from it
 * back to itself; undefined when there is none.
 */
export function waitCycle(goal: string, wanted: string[], waitsOf: (id: string) => string[]): string[] | undefined {
  const seen = new Set<string>();
  const walk = (id: string, path: string[]): string[] | undefined => {
    if (id === goal) return [...path, id];
    if (seen.has(id)) return undefined;
    seen.add(id);
    for (const next of waitsOf(id)) {
      const found = walk(next, [...path, id]);
      if (found) return found;
    }
    return undefined;
  };
  for (const w of wanted) {
    const found = walk(w, [goal]);
    if (found) return found;
  }
  return undefined;
}

/** The plain words for a goal's open waits, for the AI: "waits on login, api/ship-v2 (not finished)". */
export function waitsText(waiting: Waiting[]): string | undefined {
  const open = waiting.filter((w) => w.state === "open").map((w) => w.ref.raw);
  return open.length > 0 ? `waits on ${open.join(", ")} (not finished)` : undefined;
}
