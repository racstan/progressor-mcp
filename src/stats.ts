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

/** Every project's statistics added up, for Home. */
export interface AllStats extends Omit<ProjectStats, "longest" | "perGoal"> {
  longest: (ProjectStats["longest"][number] & { project: string; projectId: string })[];
  /** One line per project, the busiest of the last two weeks first. */
  perProject: { id: string; name: string; done: number; open: number; goalsFinished: number; goalsOpen: number; spent: number; sideTrips: number; lastTwoWeeks: number }[];
}

export function combineStats(projects: { id: string; name: string; stats: ProjectStats }[]): AllStats {
  const sum = (f: (s: ProjectStats) => number) => projects.reduce((n, p) => n + f(p.stats), 0);
  const days = new Map<string, number>();
  for (const p of projects) for (const d of p.stats.perDay) days.set(d.day, (days.get(d.day) ?? 0) + d.count);
  const endings: Record<DetourStatus, number> = { "merged back": 0, returned: 0, recalibrated: 0, open: 0 };
  for (const p of projects) for (const k of Object.keys(endings) as DetourStatus[]) endings[k] += p.stats.drift.endings[k];
  return {
    goals: { finished: sum((s) => s.goals.finished), open: sum((s) => s.goals.open), cancelled: sum((s) => s.goals.cancelled) },
    steps: { done: sum((s) => s.steps.done), open: sum((s) => s.steps.open), cancelled: sum((s) => s.steps.cancelled) },
    time: {
      spent: sum((s) => s.time.spent),
      compared: {
        steps: sum((s) => s.time.compared.steps),
        estimated: sum((s) => s.time.compared.estimated),
        spent: sum((s) => s.time.compared.spent),
        withinEstimate: sum((s) => s.time.compared.withinEstimate),
      },
    },
    drift: {
      sideTrips: sum((s) => s.drift.sideTrips),
      goalsWithSideTrips: sum((s) => s.drift.goalsWithSideTrips),
      goals: sum((s) => s.drift.goals),
      endings,
      stepsAdded: sum((s) => s.drift.stepsAdded),
      stepsCancelled: sum((s) => s.drift.stepsCancelled),
    },
    perDay: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
    longest: projects
      .flatMap((p) => p.stats.longest.map((l) => ({ ...l, project: p.name, projectId: p.id })))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, LONGEST),
    perProject: projects
      .map(({ id, name, stats: s }) => ({
        id,
        name,
        done: s.steps.done,
        open: s.steps.open,
        goalsFinished: s.goals.finished,
        goalsOpen: s.goals.open,
        spent: s.time.spent,
        sideTrips: s.drift.sideTrips,
        lastTwoWeeks: s.perDay.reduce((n, d) => n + d.count, 0),
      }))
      .sort((a, b) => b.lastTwoWeeks - a.lastTwoWeeks || b.done - a.done),
  };
}
