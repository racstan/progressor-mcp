// A rough schedule of the open work: what runs now, what comes next, and when each open Goal and the
// whole Roadmap should be done. Pure, so the server and the dashboard page share it.
//
// The rules, kept simple on purpose (a greedy list schedule):
// - The work is the open Tasks of every planned, started or paused Goal, in Roadmap order, then in
//   each Goal's Task order. A Goal with no open Tasks but an estimate of its own is one piece of work.
// - A Task takes its estimate minus the time already spent on it (never below zero). A Goal's own
//   estimate covers its open Tasks that have none: what the estimated ones leave of it is split evenly
//   between them. Any other Task without an estimate is unknown: it counts as no time, and is counted
//   so the finish can say how many steps it leaves out, instead of guessing.
// - Tasks in progress or with a helper are running now. Tasks waiting on the Developer or checked add
//   no time: they wait on someone, not on work.
// - At most `capacity` Tasks run at once: the project's helper limit, or without one as many as run
//   now (at least one). Each next Task starts as soon as a slot is free, in order.

import { timeSpent, type Task, type TaskStatus } from "./planFile.js";
import type { Goal } from "./roadmap.js";

export interface ScheduledTask {
  goal: string;
  id: string;
  title: string;
  status: TaskStatus;
  /** Minutes of work left; undefined when it is not known (no estimate). */
  left: number | undefined;
  /** Minutes from now until it should start and be done. */
  start: number;
  end: number;
  /** Time spent is already past the estimate. */
  over: boolean;
}

export interface GoalSchedule {
  id: string;
  title: string;
  /** Minutes from now until all of the Goal's known work should be done. */
  finish: number;
  /** Open Tasks without an estimate, left out of `finish`. */
  unknown: number;
  /** Minutes of known work left. */
  left: number;
  /** The Goal's estimate: its own, or the sum of its open Tasks' (undefined when there is neither). */
  estimate: number | undefined;
  /** Whether `estimate` was set on the Goal itself. */
  estimateSet: boolean;
}

export interface Schedule {
  /** The project's helper limit, if one is set. */
  limit: number | undefined;
  /** How many Tasks the schedule runs at once. */
  capacity: number;
  /** Tasks with a helper now. */
  helpers: number;
  /** The Tasks running now (in progress or with a helper). */
  running: ScheduledTask[];
  /** The Tasks that start next, in order. */
  next: ScheduledTask[];
  goals: GoalSchedule[];
  /** Minutes from now until all known work on the Roadmap should be done. */
  finish: number;
  /** Open Tasks without an estimate, on the whole Roadmap. */
  unknown: number;
  /** Whether any open Task or Goal has an estimate: without one there is no schedule to speak of. */
  estimated: boolean;
}

/** One Goal of the Roadmap with its Tasks, as the schedule needs it. */
export interface PlannedGoal {
  goal: Pick<Goal, "id" | "title" | "status" | "estimate">;
  tasks: Pick<Task, "id" | "title" | "status" | "estimate" | "spent" | "timingSince">[];
}

const RUNNING: readonly TaskStatus[] = ["in progress", "with a helper"];
const WAITING: readonly TaskStatus[] = ["waiting on you", "checked"];
const OPEN_TASK = (s: TaskStatus) => s !== "done" && s !== "released" && s !== "dropped";
const OPEN_GOAL = (s: string) => s === "planned" || s === "active" || s === "paused";

export function computeSchedule(roadmap: PlannedGoal[], limit: number | undefined, now: Date): Schedule {
  const goals: GoalSchedule[] = [];
  const running: ScheduledTask[] = [];
  const queue: ScheduledTask[] = [];
  const waiting: ScheduledTask[] = [];
  let estimated = false;

  for (const { goal, tasks } of roadmap.filter((p) => OPEN_GOAL(p.goal.status))) {
    const open = tasks.filter((t) => OPEN_TASK(t.status) && t.id);
    const known = open.filter((t) => t.estimate !== undefined);
    const knownSum = known.reduce((sum, t) => sum + t.estimate!, 0);
    const without = open.length - known.length;
    // A Goal's own estimate covers its Tasks that have none, if the estimated ones leave any of it.
    const share = goal.estimate !== undefined && without > 0 && goal.estimate > knownSum ? (goal.estimate - knownSum) / without : undefined;
    if (goal.estimate !== undefined || known.length > 0) estimated = true;
    const items: ScheduledTask[] = open.map((t) => {
      const estimate = t.estimate ?? share;
      const spent = timeSpent(t, now);
      return {
        goal: goal.id,
        id: t.id!,
        title: t.title,
        status: t.status,
        left: WAITING.includes(t.status) ? 0 : estimate === undefined ? undefined : Math.max(0, estimate - spent),
        start: 0,
        end: 0,
        over: t.estimate !== undefined && spent > t.estimate,
      };
    });
    if (open.length === 0 && goal.estimate !== undefined)
      items.push({ goal: goal.id, id: "", title: goal.title, status: "pending", left: goal.estimate, start: 0, end: 0, over: false });
    for (const item of items) (RUNNING.includes(item.status) ? running : WAITING.includes(item.status) ? waiting : queue).push(item);
    goals.push({
      id: goal.id,
      title: goal.title,
      finish: 0,
      unknown: share === undefined ? without : 0,
      left: 0,
      estimate: goal.estimate ?? (known.length > 0 ? knownSum : undefined),
      estimateSet: goal.estimate !== undefined,
    });
  }

  const capacity = Math.max(1, limit ?? running.length);
  // The end times of the Tasks holding a slot, earliest first.
  const busy: number[] = [];
  const take = (item: ScheduledTask, at: number) => {
    item.start = at;
    item.end = at + (item.left ?? 0);
    busy.push(item.end);
    busy.sort((a, b) => a - b);
  };
  for (const item of running) take(item, 0);
  let t = 0;
  for (const item of queue) {
    while (busy.length >= capacity) t = Math.max(t, busy.shift()!);
    take(item, t);
  }

  const all = [...running, ...waiting, ...queue];
  for (const g of goals) {
    const mine = all.filter((i) => i.goal === g.id);
    g.finish = Math.max(0, ...mine.map((i) => i.end));
    g.left = mine.reduce((sum, i) => sum + (i.left ?? 0), 0);
  }
  return {
    limit,
    capacity,
    helpers: running.filter((i) => i.status === "with a helper").length,
    running,
    next: queue.slice(0, capacity),
    goals,
    finish: Math.max(0, ...all.map((i) => i.end)),
    unknown: goals.reduce((sum, g) => sum + g.unknown, 0),
    estimated,
  };
}
