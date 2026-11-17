// Who holds what: the steps waiting on someone other than the Developer, grouped by person.
// Pure, so it is tested; the components only lay it out.

import { type Person, findPerson } from "../people.js";

/** A step waiting on someone, with its goal. */
export interface WaitLine {
  goal: string;
  goalTitle: string;
  step: string;
  title: string;
  /** The person's name, as the step has it. */
  waitingFor?: string;
  /** What they need to do. */
  need?: string;
}

export interface PersonGroup {
  name: string;
  role?: string;
  steps: WaitLine[];
}

const NOBODY = "Someone";

/** The steps grouped by person: those in the people file first (in its order), then others by first appearance. */
export function groupByPerson(lines: readonly WaitLine[], people: readonly Person[]): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  for (const l of lines) {
    const known = l.waitingFor ? findPerson([...people], l.waitingFor) : undefined;
    const name = known?.name ?? (l.waitingFor?.trim() || NOBODY);
    const key = known ? known.id : `x:${name.toLowerCase()}`;
    const g = groups.get(key) ?? { name, ...(known?.role ? { role: known.role } : {}), steps: [] };
    g.steps.push(l);
    groups.set(key, g);
  }
  const order = (key: string) => {
    const at = people.findIndex((p) => p.id === key);
    return at < 0 ? people.length : at;
  };
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([, g]) => g);
}

/** "3 steps waiting on 2 people". */
export function othersWaitingWords(groups: readonly PersonGroup[]): string {
  const steps = groups.reduce((n, g) => n + g.steps.length, 0);
  return `${steps} ${steps === 1 ? "step" : "steps"} waiting on ${groups.length} ${groups.length === 1 ? "person" : "people"}`;
}

/** "Waiting on Priya: Sign and send back the contract". */
export function waitingLine(who: string | undefined, need: string | undefined): string {
  return `Waiting on ${who?.trim() || "someone"}${need?.trim() ? `: ${need.trim()}` : ""}`;
}
