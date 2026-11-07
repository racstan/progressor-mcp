// The Calendar: everything in a project's plan that has a date, as one list of events for the
// dashboard's month, week and day views. Past events come from what the plan recorded (steps finished,
// goals added and finished, hand tests marked, handoffs written); future ones from the schedule (steps
// planned next, when each open goal should finish) and from routines (when each comes back).
// Nothing here is typed in by the Developer: the calendar fills itself as the AI works.
import type { HandoffSummary } from "./handoff.js";
import type { HandTest, Task } from "./planFile.js";
import type { Goal } from "./roadmap.js";
import { type Routine, nextAfter, nextDue, parseEvery } from "./routines.js";
import type { Schedule } from "./schedule.js";

export type CalendarKind =
  | "step" // a step finished
  | "goal-done" // a goal finished
  | "release" // a release goal finished
  | "goal-added" // a goal added
  | "hotfix" // a hotfix added
  | "planned" // a step the schedule runs now or next
  | "due" // when an open goal should be finished
  | "hand-test" // the Developer marked a hand test
  | "handoff" // a handoff written
  | "routine"; // a goal that comes back is due

export interface CalendarEvent {
  /** Unique within the list, stable between loads. */
  id: string;
  kind: CalendarKind;
  title: string;
  /** ISO times; `end` only when the event has a length (a step worked on from start to finish). */
  start: string;
  end?: string;
  /** The goal it belongs to, to open from the calendar. */
  goal?: string;
  goalTitle?: string;
  /** One more line, in words. */
  detail?: string;
}

export interface CalendarInput {
  goals: { goal: Goal; tasks: Task[]; handTests: HandTest[] }[];
  schedule: Schedule | undefined;
  routines: Routine[];
  handoffs: HandoffSummary[];
  now: Date;
  /** How far ahead routines are repeated, in days. */
  horizonDays?: number;
}

const MINUTE = 60_000;
/** A step with a start further back than this before its finish is shown at its finish only. */
const LONGEST_BLOCK = 24 * 60 * MINUTE;
/** At most this many future turns of one routine. */
const MAX_TURNS = 60;

const valid = (iso: string | undefined): iso is string => !!iso && !Number.isNaN(Date.parse(iso));
const iso = (ms: number) => new Date(ms).toISOString();

/** Every dated thing in the plan, sorted by start. */
export function calendarEvents(input: CalendarInput): CalendarEvent[] {
  const { now } = input;
  const out: CalendarEvent[] = [];
  const titles = new Map(input.goals.map(({ goal }) => [goal.id, goal.title]));

  for (const { goal, tasks, handTests } of input.goals) {
    const of = { goal: goal.id, goalTitle: goal.title };
    if (valid(goal.added?.at)) {
      out.push({
        id: `added:${goal.id}`,
        kind: goal.hotfix ? "hotfix" : "goal-added",
        title: goal.hotfix ? `Hotfix: ${goal.title}` : `New goal: ${goal.title}`,
        start: goal.added!.at,
        ...of,
        detail: goal.added!.by === "Developer" ? "Added by you" : "Added by your AI",
      });
    }
    let lastFinish: string | undefined;
    for (const t of tasks) {
      if ((t.status !== "done" && t.status !== "released") || !valid(t.finishedAt)) continue;
      if (!lastFinish || t.finishedAt > lastFinish) lastFinish = t.finishedAt;
      const finish = Date.parse(t.finishedAt);
      const began = valid(t.startedAt) ? Date.parse(t.startedAt) : undefined;
      const block = began !== undefined && began < finish && finish - began <= LONGEST_BLOCK;
      out.push({
        id: `step:${goal.id}:${t.id ?? t.title}`,
        kind: "step",
        title: t.title,
        start: block ? iso(began!) : t.finishedAt,
        ...(block ? { end: t.finishedAt } : {}),
        ...of,
        detail: t.status === "released" ? "Handed over" : "Step finished",
      });
    }
    if (goal.status === "done") {
      const at = lastFinish ?? (valid(goal.updated?.at) ? goal.updated!.at : undefined);
      if (at) {
        out.push({
          id: `done:${goal.id}`,
          kind: goal.release ? "release" : "goal-done",
          title: goal.release ? `Released ${goal.release}: ${goal.title}` : `Finished: ${goal.title}`,
          start: at,
          ...of,
        });
      }
    }
    for (const h of handTests) {
      if (h.result === "pending" || !valid(h.markedAt)) continue;
      out.push({
        id: `test:${goal.id}:${h.id ?? h.text}`,
        kind: "hand-test",
        title: h.text,
        start: h.markedAt,
        ...of,
        detail: h.result === "works" ? "You tried it: it works" : h.result === "doesn't work" ? "You tried it: it doesn't work" : "You won't test it",
      });
    }
  }

  const s = input.schedule;
  if (s?.estimated) {
    const at = (minutes: number) => iso(now.getTime() + minutes * MINUTE);
    for (const t of [...s.running, ...s.next]) {
      if (t.left === undefined || t.end <= t.start) continue;
      out.push({
        id: `planned:${t.goal}:${t.id}`,
        kind: "planned",
        title: t.title,
        start: at(t.start),
        end: at(t.end),
        goal: t.goal,
        goalTitle: titles.get(t.goal),
        detail: t.status === "pending" ? "Planned next" : "Being worked on",
      });
    }
    for (const g of s.goals) {
      if (!(g.finish > 0)) continue;
      out.push({
        id: `due:${g.id}`,
        kind: "due",
        title: `Should be done: ${g.title}`,
        start: at(g.finish),
        goal: g.id,
        goalTitle: g.title,
        detail: g.unknown ? `Expected finish; ${g.unknown} step${g.unknown === 1 ? "" : "s"} without an estimate not counted` : "Expected finish, from the estimates",
      });
    }
  }

  const horizon = now.getTime() + (input.horizonDays ?? 120) * 24 * 60 * MINUTE;
  for (const r of input.routines) {
    const every = parseEvery(r.every);
    if (r.paused || !every || !valid(r.next)) continue;
    const turn = (at: Date, i: number) =>
      out.push({ id: `routine:${r.id}:${i}`, kind: "routine", title: r.title, start: at.toISOString(), detail: "Comes back by itself", ...(r.lastGoal ? { goal: r.lastGoal, goalTitle: titles.get(r.lastGoal) } : {}) });
    let at = new Date(r.next);
    let i = 0;
    // A turn whose time has come (its goal not made yet) still shows, on its own date; then the turns after now.
    if (at.getTime() <= now.getTime()) {
      turn(at, i++);
      at = nextAfter(every, at, now);
    }
    for (; i < MAX_TURNS && at.getTime() <= horizon; i++) {
      turn(at, i);
      at = nextDue(every, at);
    }
  }

  for (const h of input.handoffs) {
    if (!valid(h.written)) continue;
    out.push({ id: `handoff:${h.file}`, kind: "handoff", title: `Handoff: ${h.title}`, start: h.written, ...(h.range ? { detail: `Covers ${h.range}` } : {}) });
  }

  // At the same moment, a goal's last step comes before the goal finishing.
  const rank = (e: CalendarEvent) => (e.kind === "goal-done" || e.kind === "release" ? 1 : 0);
  return out.sort((a, b) => a.start.localeCompare(b.start) || rank(a) - rank(b) || a.id.localeCompare(b.id));
}
