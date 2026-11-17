// Ready to launch?: what still stands between the project and a launch or release, grouped by who it
// waits on (the AI, the Developer, other people), with serious risks nothing is reducing. Pure, so the
// dashboard page and the AI's answer (the launch_readiness tool) say the same thing.
//
// Which goals count, with nobody having to set anything up:
//   - an open release goal: the first one, the goals it bundles, and the goals marked for launch;
//   - else, once any goal is marked for launch: those goals;
//   - else: every open goal.
// Open hotfixes always count.
import type { GoalStatus } from "./roadmap.js";
import type { TaskStatus } from "./planFile.js";

export interface ReadinessGoal {
  id: string;
  title: string;
  status: GoalStatus;
  forLaunch?: boolean;
  release?: string;
  bundles?: string[];
  hotfix?: boolean;
}

export interface ReadinessStep {
  goal: string;
  step: string;
  title: string;
  status: TaskStatus;
  waitingFor?: string;
  need?: string;
}

export interface ReadinessInput {
  /** In roadmap order. */
  goals: ReadinessGoal[];
  steps: ReadinessStep[];
  /** Things to try by hand that are still untried. */
  untried: { goal: string; test: string; text: string }[];
  /** Open questions to the Developer. */
  questions: { goal: string; id: string; text: string }[];
  /** Serious risks nothing is reducing (risks.ts unreducedSeriousRisks). */
  risks: { id: string; title: string; score: number }[];
}

/** One thing left: an open step, a goal with no open steps, a thing to try or a question. */
export interface Blocker {
  kind: "step" | "goal" | "hand test" | "question";
  goal: string;
  goalTitle: string;
  /** The step, test or question ID; missing for a goal. */
  id?: string;
  title: string;
  need?: string;
}

export interface Readiness {
  scope: { kind: "release" | "marked" | "everything"; release?: string; goals: { id: string; title: string; status: GoalStatus }[] };
  ready: boolean;
  /** How many things are left, risks included. */
  left: number;
  verdict: string;
  ai: Blocker[];
  you: Blocker[];
  others: { person: string; items: Blocker[] }[];
  risks: ReadinessInput["risks"];
}

const OVER: readonly GoalStatus[] = ["done", "dropped"];
const isOpen = (g: ReadinessGoal) => !OVER.includes(g.status);
const FOR_AI: readonly TaskStatus[] = ["pending", "in progress", "with a helper", "checked"];
const FINISHED: readonly TaskStatus[] = ["done", "released", "dropped"];

function scopeOf(goals: ReadinessGoal[]): { kind: Readiness["scope"]["kind"]; release?: string; goals: ReadinessGoal[] } {
  const hotfixes = goals.filter((g) => g.hotfix && isOpen(g));
  const release = goals.find((g) => g.release && isOpen(g));
  const marked = goals.filter((g) => g.forLaunch && g.status !== "dropped");
  const pick = (ids: Set<string>) => goals.filter((g) => ids.has(g.id));
  if (release) {
    const ids = new Set([...(release.bundles ?? []), ...marked.map((g) => g.id), ...hotfixes.map((g) => g.id)]);
    // The release goal itself comes last: it is what ships them.
    return { kind: "release", release: release.release!, goals: [...pick(ids).filter((g) => g.id !== release.id), release] };
  }
  if (marked.length > 0) return { kind: "marked", goals: pick(new Set([...marked, ...hotfixes].map((g) => g.id))) };
  return { kind: "everything", goals: goals.filter(isOpen) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function readiness(input: ReadinessInput): Readiness {
  const scope = scopeOf(input.goals);
  const counted = new Map(scope.goals.map((g) => [g.id, g]));
  const ai: Blocker[] = [];
  const you: Blocker[] = [];
  const byPerson = new Map<string, Blocker[]>();
  for (const g of scope.goals) {
    if (!isOpen(g)) continue;
    const steps = input.steps.filter((s) => s.goal === g.id);
    for (const s of steps) {
      const b: Blocker = { kind: "step", goal: g.id, goalTitle: g.title, id: s.step, title: s.title, ...(s.need ? { need: s.need } : {}) };
      if (FOR_AI.includes(s.status)) ai.push(b);
      else if (s.status === "waiting on you") you.push(b);
      else if (s.status === "waiting on someone") {
        const who = s.waitingFor?.trim() || "Someone";
        byPerson.set(who, [...(byPerson.get(who) ?? []), b]);
      }
    }
    // A goal still being planned or worked on with no open step is work for the AI all the same.
    if (g.status !== "testing" && !steps.some((s) => !FINISHED.includes(s.status))) ai.push({ kind: "goal", goal: g.id, goalTitle: g.title, title: "Finish the goal" });
  }
  for (const q of input.questions) {
    const g = counted.get(q.goal);
    if (g && isOpen(g)) you.push({ kind: "question", goal: g.id, goalTitle: g.title, id: q.id, title: q.text });
  }
  // Things to try count even on a finished goal of a release: they are what makes it safe to ship.
  for (const u of input.untried) {
    const g = counted.get(u.goal);
    if (g && g.status !== "dropped") you.push({ kind: "hand test", goal: g.id, goalTitle: g.title, id: u.test, title: u.text });
  }
  const others = [...byPerson].map(([person, items]) => ({ person, items }));
  const waiting = others.reduce((n, o) => n + o.items.length, 0);
  const left = ai.length + you.length + waiting + input.risks.length;
  const parts = [
    ai.length ? `${plural(ai.length, "step", "steps")} for the AI` : "",
    you.length ? `${plural(you.length, "thing", "things")} for you` : "",
    waiting ? `${plural(waiting, "thing", "things")} waiting on others` : "",
    input.risks.length ? plural(input.risks.length, "serious risk", "serious risks") : "",
  ].filter(Boolean);
  return {
    scope: { kind: scope.kind, ...(scope.release ? { release: scope.release } : {}), goals: scope.goals.map(({ id, title, status }) => ({ id, title, status })) },
    ready: left === 0,
    left,
    verdict: left === 0 ? "Ready to launch: nothing is left." : `Not ready yet: ${parts.join(", ")}.`,
    ai,
    you,
    others,
    risks: input.risks,
  };
}

/** Which goals count, in one line. */
export function scopeLine(r: Readiness): string {
  const n = r.scope.goals.length;
  const names = n === 0 ? "none" : n > 5 ? `${n} goals` : r.scope.goals.map((g) => g.title).join(", ");
  if (r.scope.kind === "release") return `Counting: release ${r.scope.release} and the goals it ships (${names}).`;
  if (r.scope.kind === "marked") return `Counting: the goals marked for launch (${names}).`;
  return `Counting: every open goal (${names}).`;
}

const blockerLine = (b: Blocker): string =>
  b.kind === "goal"
    ? `${b.goalTitle}: ${b.title}`
    : b.kind === "hand test"
      ? `${b.goalTitle}: try by hand: ${b.title}`
      : b.kind === "question"
        ? `${b.goalTitle}: question: ${b.title}`
        : `${b.goalTitle}: ${b.id} ${b.title}${b.need ? ` (they need to: ${b.need})` : ""}`;

/** The same summary as the page, as text for the AI. */
export function readinessText(r: Readiness): string {
  const lines = [r.verdict, scopeLine(r)];
  if (r.ai.length) lines.push("For the AI:", ...r.ai.map((b) => `- ${blockerLine(b)}`));
  if (r.you.length) lines.push("For the Developer:", ...r.you.map((b) => `- ${blockerLine(b)}`));
  if (r.others.length) lines.push("Waiting on others:", ...r.others.flatMap((o) => o.items.map((b) => `- ${o.person}: ${blockerLine(b)}`)));
  if (r.risks.length) lines.push("Serious risks nothing is reducing:", ...r.risks.map((x) => `- ${x.id} ${x.title}`));
  return lines.join("\n");
}
