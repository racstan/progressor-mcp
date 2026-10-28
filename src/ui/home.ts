// What the home page and the sidebar group together, and the few words that say why. Pure, so it is
// tested; the components only lay it out.

/** What a goal waits on the person for: a question from the AI, steps to check, things to try. */
export interface Needs {
  openQuestions?: number;
  untriedTests?: number;
  waitingSteps?: number;
}

interface GoalLike extends Needs {
  id: string;
  title: string;
  status: string;
  done: number;
  total: number;
  waitingOnYou: boolean;
  updatedAt?: number | undefined;
}

interface ProjectLike<G extends GoalLike> {
  id: string;
  name: string;
  root: string;
  goals: G[];
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Why a goal needs the person, after what they put off; empty when it no longer does. */
export function needsWhy(g: GoalLike, putOff?: number): { why: string; canPutOff: boolean } {
  const left = stillNeeds(g, putOff);
  return left.needs ? { why: needsWords(left) || "Waiting on you", canPutOff: (left.untriedTests ?? 0) > 0 } : { why: "", canPutOff: false };
}

/** "A question for you · 1 step to check · 2 things to try"; empty when nothing waits. */
export function needsWords(n: Needs): string {
  const q = n.openQuestions ?? 0;
  const s = n.waitingSteps ?? 0;
  const t = n.untriedTests ?? 0;
  return [
    q === 1 ? "A question for you" : q > 1 ? `${q} questions for you` : "",
    s > 0 ? count(s, "step to check", "steps to check") : "",
    t > 0 ? count(t, "thing to try", "things to try") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "3 of 7 steps", or "No steps yet". */
export const progressWords = (g: { done: number; total: number }) => (g.total ? `${g.done} of ${count(g.total, "step", "steps")}` : "No steps yet");

/**
 * Things to try that the person put off with "Not now", by goal: how many were untried then. Kept in
 * this browser only; the plan is unchanged. A goal comes back once more are untried than were put off.
 */
export type PutOff = Record<string, number>;

/** What still needs the person, with things to try left out once put off. */
function stillNeeds(g: GoalLike, putOff: number | undefined): Needs & { needs: boolean } {
  const untried = g.untriedTests ?? 0;
  const left = { openQuestions: g.openQuestions ?? 0, waitingSteps: g.waitingSteps ?? 0, untriedTests: putOff !== undefined && untried <= putOff ? 0 : untried };
  // An older Progressor sends no reasons: trust its waitingOnYou.
  const noReasons = !g.openQuestions && !g.waitingSteps && !g.untriedTests;
  const needs = g.waitingOnYou && open(g) && (noReasons || left.openQuestions > 0 || left.waitingSteps > 0 || left.untriedTests > 0);
  return { ...left, needs };
}

const open = (g: GoalLike) => g.status === "active" || g.status === "paused" || g.status === "planned";
const newestFirst = (a: { goal: GoalLike }, b: { goal: GoalLike }) => (b.goal.updatedAt ?? 0) - (a.goal.updatedAt ?? 0);

/** The home page: what needs the person, what is being worked on, and every project with its counts. */
export function homeSections<G extends GoalLike, P extends ProjectLike<G>>(projects: P[], putOff: PutOff = {}) {
  const all = projects.flatMap((project) =>
    project.goals.map((goal) => ({ project, goal, left: stillNeeds(goal, putOff[`${project.id}/${goal.id}`]) })),
  );
  const needsYou = all
    .filter(({ left }) => left.needs)
    .map(({ project, goal, left }) => ({ project, goal, why: needsWords(left) || "Waiting on you", canPutOff: (left.untriedTests ?? 0) > 0 }))
    .sort(newestFirst);
  const inProgress = all
    .filter(({ goal, left }) => goal.status === "active" && !left.needs)
    .map(({ project, goal }) => ({ project, goal }))
    .sort(newestFirst);
  const summary =
    projects.length === 0
      ? "No projects yet"
      : [
          needsYou.length > 0 ? count(needsYou.length, "goal needs you", "goals need you") : "",
          inProgress.length > 0 ? `${inProgress.length} in progress` : "",
          count(projects.length, "project", "projects"),
        ]
          .filter(Boolean)
          .join(" · ");
  return {
    summary,
    needsYou,
    inProgress,
    projects: projects.map((p) => ({ ...p, open: p.goals.filter(open).length, finished: p.goals.filter((g) => g.status === "done").length })),
  };
}

/** The sidebar's groups of goals still open, each left out when empty. putOff is keyed by goal ID. */
export function sidebarSections<G extends GoalLike>(goals: G[], putOff: PutOff = {}): { label: string; goals: G[] }[] {
  const needs = goals.filter((g) => stillNeeds(g, putOff[g.id]).needs);
  const rest = goals.filter((g) => !needs.includes(g));
  return [
    { label: "Needs you", goals: needs },
    { label: "In progress", goals: rest.filter((g) => g.status === "active") },
    { label: "Up next", goals: rest.filter((g) => g.status === "planned" || g.status === "paused") },
  ].filter((s) => s.goals.length > 0);
}
