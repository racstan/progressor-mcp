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

const open = (g: GoalLike) => g.status === "active" || g.status === "paused" || g.status === "planned";
const newestFirst = (a: { goal: GoalLike }, b: { goal: GoalLike }) => (b.goal.updatedAt ?? 0) - (a.goal.updatedAt ?? 0);

/** The home page: what needs the person, what is being worked on, and every project with its counts. */
export function homeSections<G extends GoalLike, P extends ProjectLike<G>>(projects: P[]) {
  const all = projects.flatMap((project) => project.goals.map((goal) => ({ project, goal })));
  const needsYou = all
    .filter(({ goal }) => goal.waitingOnYou && open(goal))
    .map((x) => ({ ...x, why: needsWords(x.goal) || "Waiting on you" }))
    .sort(newestFirst);
  const inProgress = all.filter(({ goal }) => goal.status === "active" && !goal.waitingOnYou).sort(newestFirst);
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

/** The sidebar's groups of goals still open, each left out when empty. */
export function sidebarSections<G extends GoalLike>(goals: G[]): { label: string; goals: G[] }[] {
  const needs = goals.filter((g) => g.waitingOnYou && open(g));
  const rest = goals.filter((g) => !needs.includes(g));
  return [
    { label: "Needs you", goals: needs },
    { label: "In progress", goals: rest.filter((g) => g.status === "active") },
    { label: "Up next", goals: rest.filter((g) => g.status === "planned" || g.status === "paused") },
  ].filter((s) => s.goals.length > 0);
}
