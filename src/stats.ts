import type { DetourStatus, TaskStatus } from "./planFile.js";
import type { GoalStatus } from "./roadmap.js";

/** What the statistics need of a Task. */
export interface StatsTask {
  id: string | undefined;
  title: string;
  status: TaskStatus;
  estimate?: number;
  spent: number;
  timingSince?: string;
  finishedAt?: string;
  updated?: { at: string };
  /** The Detour that added it, or that dropped it. */
  addedBy?: string;
  droppedBy?: string;
}

export interface StatsGoal {
  id: string;
  title: string;
  status: GoalStatus;
  tasks: StatsTask[];
  detours: { status: DetourStatus }[];
}

export interface ProjectStats {
  goals: { finished: number; open: number; cancelled: number };
  steps: { done: number; open: number; cancelled: number };
  time: {
    /** Minutes worked on every step, a step still running counted up to now. */
    spent: number;
    /** The finished steps that have both an estimate and a time: their sums, and how many took no longer than estimated. */
    compared: { steps: number; estimated: number; spent: number; withinEstimate: number };
  };
  /** Over the goals that were not cancelled. */
  drift: { sideTrips: number; goalsWithSideTrips: number; goals: number; endings: Record<DetourStatus, number>; stepsAdded: number; stepsCancelled: number };
  /** Steps finished on each of the last 14 days, oldest first; `day` is the local date. */
  perDay: { day: string; count: number }[];
  /** The finished steps that took longest, longest first. */
  longest: { goal: string; goalTitle: string; id: string | undefined; title: string; spent: number; estimate: number | undefined }[];
  /** One line per goal that was not cancelled, in plan order. */
  perGoal: { id: string; title: string; status: GoalStatus; done: number; total: number; spent: number; estimate: number | undefined; sideTrips: number }[];
}

const DAYS = 14;
const LONGEST = 5;
const FINISHED: TaskStatus[] = ["done", "released"];

const two = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** Minutes worked on a step, a stretch still running counted up to now. */
const worked = (t: StatsTask, now: Date) => {
  const since = t.timingSince ? Date.parse(t.timingSince) : NaN;
  return t.spent + (Number.isNaN(since) ? 0 : Math.max(0, Math.round((now.getTime() - since) / 60_000)));
};

/**
 * Statistics worked out from the plan: how long steps take against their estimates, how often work
 * drifts, what was finished day by day, the longest steps and a line per goal. Reads only.
 */
export function projectStats(goals: StatsGoal[], now: Date): ProjectStats {
  const tasks = goals.flatMap((g) => g.tasks.map((t) => ({ goal: g, t })));
  const kept = goals.filter((g) => g.status !== "dropped");
  const isDone = (t: StatsTask) => FINISHED.includes(t.status);

  const compared = tasks.filter(({ t }) => isDone(t) && t.estimate !== undefined && t.spent > 0);
  const endings: Record<DetourStatus, number> = { "merged back": 0, returned: 0, recalibrated: 0, open: 0 };
  for (const g of kept) for (const d of g.detours) endings[d.status]++;

  const days = Array.from({ length: DAYS }, (_, i) => dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i))));
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const { t } of tasks) {
    const at = isDone(t) ? (t.finishedAt ?? t.updated?.at) : undefined;
    const when = at ? new Date(at) : undefined;
    if (!when || Number.isNaN(when.getTime())) continue;
    const day = dayOf(when);
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
  }

  return {
    goals: {
      finished: goals.filter((g) => g.status === "done").length,
      open: goals.filter((g) => g.status !== "done" && g.status !== "dropped").length,
      cancelled: goals.filter((g) => g.status === "dropped").length,
    },
    steps: {
      done: tasks.filter(({ t }) => isDone(t)).length,
      open: tasks.filter(({ t }) => !isDone(t) && t.status !== "dropped").length,
      cancelled: tasks.filter(({ t }) => t.status === "dropped").length,
    },
    time: {
      spent: tasks.reduce((n, { t }) => n + worked(t, now), 0),
      compared: {
        steps: compared.length,
        estimated: compared.reduce((n, { t }) => n + t.estimate!, 0),
        spent: compared.reduce((n, { t }) => n + t.spent, 0),
        withinEstimate: compared.filter(({ t }) => t.spent <= t.estimate!).length,
      },
    },
    drift: {
      sideTrips: kept.reduce((n, g) => n + g.detours.length, 0),
      goalsWithSideTrips: kept.filter((g) => g.detours.length > 0).length,
      goals: kept.length,
      endings,
      stepsAdded: tasks.filter(({ t }) => t.addedBy).length,
      stepsCancelled: tasks.filter(({ t }) => t.status === "dropped").length,
    },
    perDay: days.map((day) => ({ day, count: perDay.get(day)! })),
    longest: tasks
      .filter(({ t }) => isDone(t) && t.spent > 0)
      .sort((a, b) => b.t.spent - a.t.spent)
      .slice(0, LONGEST)
      .map(({ goal, t }) => ({ goal: goal.id, goalTitle: goal.title, id: t.id, title: t.title, spent: t.spent, estimate: t.estimate })),
    perGoal: kept.map((g) => {
      const live = g.tasks.filter((t) => t.status !== "dropped");
      const estimates = live.filter((t) => t.estimate !== undefined);
      return {
        id: g.id,
        title: g.title,
        status: g.status,
        done: live.filter(isDone).length,
        total: live.length,
        spent: g.tasks.reduce((n, t) => n + worked(t, now), 0),
        estimate: estimates.length > 0 ? estimates.reduce((n, t) => n + t.estimate!, 0) : undefined,
        sideTrips: g.detours.length,
      };
    }),
  };
}
