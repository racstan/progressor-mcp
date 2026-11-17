// What the home page and the sidebar group together, and the few words that say why. Pure, so it is
// tested; the components only lay it out.

import { type UntriedSummary, summarizeUntried } from "../untried.js";

/** What a goal waits on the person for: a question from the AI, steps to check, things to try. */
export interface Needs {
  openQuestions?: number;
  untriedTests?: number;
  waitingSteps?: number;
}

interface GoalLike extends Needs {
  /** When the goal's oldest untried thing to try was added (an ISO time). */
  oldestUntried?: string | undefined;
  id: string;
  title: string;
  status: string;
  done: number;
  total: number;
  waitingOnYou: boolean;
  updatedAt?: number | undefined;
}

/** A serious risk nothing is reducing (risks.ts): it shows in Needs you beside the goals. */
export interface RiskLine {
  id: string;
  title: string;
}

/** What Needs you says under a risk. */
export const RISK_WHY = "A serious risk has nothing reducing it";

/** What Needs you says under a goal whose latest CI checks failed (ci.ts). */
export const CHECKS_WHY = "Checks failed on its latest work";

interface ProjectLike<G extends GoalLike> {
  id: string;
  name: string;
  root: string;
  goals: G[];
  /** Missing from a server older than the Risks page. */
  seriousRisks?: RiskLine[] | undefined;
  /** Open goals whose latest CI checks failed (ci.ts); missing from a server older than that. */
  failedChecks?: { id: string; title: string }[] | undefined;
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

/** The untried things to try across these goals: how many, in how many goals, and when the oldest was added. */
export function untriedAcross(goals: readonly Pick<GoalLike, "id" | "untriedTests" | "oldestUntried">[]): UntriedSummary {
  const mine = goals.filter((g) => (g.untriedTests ?? 0) > 0);
  const summary = summarizeUntried(mine.flatMap((g) => Array.from({ length: g.untriedTests! }, () => ({ goal: g.id }))));
  const dates = mine.flatMap((g) => (g.oldestUntried ? [g.oldestUntried] : [])).sort((a, b) => Date.parse(a) - Date.parse(b));
  return { ...summary, ...(dates[0] ? { oldestAt: dates[0] } : {}) };
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

const open = (g: GoalLike) => g.status === "active" || g.status === "paused" || g.status === "testing" || g.status === "planned";
const newestFirst = (a: { goal: GoalLike }, b: { goal: GoalLike }) => (b.goal.updatedAt ?? 0) - (a.goal.updatedAt ?? 0);

/** The home page: what needs the person, what is being worked on, and every project with its counts. */
export function homeSections<G extends GoalLike, P extends ProjectLike<G>>(projects: P[], putOff: PutOff = {}) {
  const all = projects.flatMap((project) =>
    project.goals.map((goal) => ({ project, goal, left: stillNeeds(goal, putOff[`${project.id}/${goal.id}`]) })),
  );
  const failed = new Set(projects.flatMap((p) => (p.failedChecks ?? []).map((f) => `${p.id}/${f.id}`)));
  const needsYou = all
    .filter(({ left }) => left.needs)
    // In each project's plan order: the AI puts what to check first at the top (move_goal).
    .map(({ project, goal, left }) => ({
      project,
      goal,
      why: [needsWords(left) || "Waiting on you", failed.has(`${project.id}/${goal.id}`) ? CHECKS_WHY : ""].filter(Boolean).join(" · "),
      canPutOff: (left.untriedTests ?? 0) > 0,
    }));
  // A goal already in Needs you for something else says it there instead.
  const failedChecks = all
    .filter(({ project, goal, left }) => !left.needs && failed.has(`${project.id}/${goal.id}`))
    .map(({ project, goal }) => ({ project, goal }));
  const seriousRisks = projects.flatMap((project) => (project.seriousRisks ?? []).map((risk) => ({ project, risk })));
  const inProgress = all
    .filter(({ project, goal, left }) => goal.status === "active" && !left.needs && !failed.has(`${project.id}/${goal.id}`))
    .map(({ project, goal }) => ({ project, goal }))
    .sort(newestFirst);
  const summary =
    projects.length === 0
      ? "No projects yet"
      : [
          needsYou.length > 0 ? count(needsYou.length, "goal needs you", "goals need you") : "",
          seriousRisks.length > 0 ? count(seriousRisks.length, "serious risk", "serious risks") : "",
          failedChecks.length > 0 ? count(failedChecks.length, "goal with failed checks", "goals with failed checks") : "",
          inProgress.length > 0 ? `${inProgress.length} in progress` : "",
          count(projects.length, "project", "projects"),
        ]
          .filter(Boolean)
          .join(" · ");
  return {
    summary,
    needsYou,
    seriousRisks,
    failedChecks,
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
    { label: "Up next", goals: rest.filter((g) => g.status === "planned" || g.status === "paused" || g.status === "testing") },
  ].filter((s) => s.goals.length > 0);
}

/** How tall Home's Needs you box is before it scrolls inside (Settings › Home page). */
export type NeedsBox = "short" | "medium" | "tall";
export const NEEDS_BOX_PX: Record<NeedsBox, number> = { short: 280, medium: 440, tall: 680 };
export const NEEDS_BOX_DEFAULT: NeedsBox = "medium";
/** Where this browser keeps the choice. */
export const NEEDS_BOX_KEY = "progressor.needs-box";
export const isNeedsBox = (v: unknown): v is NeedsBox => typeof v === "string" && v in NEEDS_BOX_PX;

/** One thing in Needs you: a goal (with why), a goal whose checks failed, or a serious risk. */
export interface NeedsItem {
  kind: "goal" | "checks" | "risk";
  key: string;
  /** The goal, or the risk's ID. */
  id: string;
  title: string;
  why: string;
  goal?: GoalLike & { untriedTests?: number };
  canPutOff?: boolean;
}

/** Needs you grouped by project, in the projects' order, each with how many things wait; projects with none are left out. */
export function needsByProject<P extends { id: string; name: string }>(s: {
  needsYou: { project: P; goal: GoalLike; why: string; canPutOff: boolean }[];
  failedChecks: { project: P; goal: GoalLike }[];
  seriousRisks: { project: P; risk: RiskLine }[];
}): { project: P; count: number; items: NeedsItem[] }[] {
  const groups = new Map<string, { project: P; items: NeedsItem[] }>();
  const into = (project: P, item: NeedsItem) => {
    const g = groups.get(project.id) ?? { project, items: [] };
    g.items.push(item);
    groups.set(project.id, g);
  };
  for (const { project, goal, why, canPutOff } of s.needsYou)
    into(project, { kind: "goal", key: `${project.id}/${goal.id}`, id: goal.id, title: goal.title, why, goal, canPutOff });
  for (const { project, goal } of s.failedChecks) into(project, { kind: "checks", key: `checks/${project.id}/${goal.id}`, id: goal.id, title: goal.title, why: CHECKS_WHY, goal });
  for (const { project, risk } of s.seriousRisks) into(project, { kind: "risk", key: `risk/${project.id}/${risk.id}`, id: risk.id, title: risk.title, why: RISK_WHY });
  // Map keeps the order projects first came up in, which is the projects' own order for goals; a
  // project with only a failed check or a risk comes after, in the order it came up.
  return [...groups.values()].map((g) => ({ ...g, count: g.items.length }));
}

/** What a project's card on Home says: finished goals out of those not cancelled, what the AI is on now, and its last change. */
export function projectFacts(goals: readonly (GoalLike & { currentStep?: string | undefined })[]): {
  finished: number;
  of: number;
  working: { id: string; title: string; step?: string }[];
  lastChange?: number;
} {
  const counted = goals.filter((g) => g.status !== "dropped");
  const last = Math.max(0, ...goals.map((g) => g.updatedAt ?? 0));
  return {
    finished: counted.filter((g) => g.status === "done").length,
    of: counted.length,
    working: goals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.title, ...(g.currentStep ? { step: g.currentStep } : {}) })),
    ...(last > 0 ? { lastChange: last } : {}),
  };
}

/** "Now: Write the tests · 1 of 4 steps", or only how far it is when no step is started. */
export const workingWords = (g: { done: number; total: number; currentStep?: string | undefined }): string =>
  g.currentStep ? `Now: ${g.currentStep} · ${progressWords(g)}` : progressWords(g);

/** A project's letter tile in the sidebar: the first letters of its first two words, else its first letter. */
export function projectInitials(name: string): string {
  const words = name.trim().split(/[\s\-_.]+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** For each project in the sidebar: how many things in Needs you are its, and whether the AI is working on it. */
export function sidebarFacts<G extends GoalLike, P extends ProjectLike<G>>(
  projects: readonly P[],
  sections: Parameters<typeof needsByProject<P>>[0],
): Map<string, { needs: number; working: boolean }> {
  const needs = new Map(needsByProject(sections).map((n) => [n.project.id, n.count]));
  return new Map(projects.map((p) => [p.id, { needs: needs.get(p.id) ?? 0, working: p.goals.some((goal) => goal.status === "active") }]));
}

/** The parts of Home a person can hide in Settings › Home page; Needs you always shows. */
export const HOME_PARTS = [
  { id: "working", label: "Working now", hint: "What your AI is on right now, at the top" },
  { id: "waiting", label: "Waiting on someone else", hint: "Goals held up by a person or another team" },
  { id: "projects", label: "Projects", hint: "A card for each project: how far it is, what's happening, Ready to launch?" },
  { id: "stats", label: "Dashboard for all your projects", hint: "Numbers across every project" },
  { id: "rules", label: "Rules and context for everything", hint: "Rules your AI follows in every project" },
] as const;
export type HomePart = (typeof HOME_PARTS)[number]["id"];
/** Where this browser keeps the hidden parts, as "stats,rules". */
export const HOME_HIDDEN_KEY = "progressor.home-hidden";

/** The parts hidden, from what this browser kept; anything unknown is left out. */
export function hiddenParts(kept: string | undefined): Set<HomePart> {
  const known = new Set<string>(HOME_PARTS.map((p) => p.id));
  return new Set((kept ?? "").split(",").filter((id): id is HomePart => known.has(id)));
}

/** What to keep after showing or hiding one part; undefined once nothing is hidden. */
export function showPart(kept: string | undefined, id: HomePart, show: boolean): string | undefined {
  const hidden = hiddenParts(kept);
  if (show) hidden.delete(id);
  else hidden.add(id);
  return hidden.size > 0 ? [...hidden].join(",") : undefined;
}
