// "Since you last looked": a readable feed of what happened in a project, worked out from the dates
// the plan already keeps (when a step was finished, a decision or hand test added, a question asked
// or answered, a goal finished), not from the history entries: the dates are on the items
// themselves, so the feed works even with History turned off. Pure, so the page and the server
// share it and it is easy to test.
import { ago } from "./ui/words.js";

type Who = "AI" | "Developer";
interface Stamped {
  at: string;
  by: Who;
}

/** The parts of a goal's plan the feed reads. */
export interface FeedGoal {
  id: string;
  title: string;
  status: string;
  updated?: Stamped | undefined;
  tasks: { id?: string | undefined; title: string; status: string; finishedAt?: string | undefined; updated?: Stamped | undefined }[];
  decisions: { id?: string | undefined; text: string; added?: Stamped | undefined }[];
  handTests: { id?: string | undefined; text: string; result: string; added?: Stamped | undefined; markedAt?: string | undefined }[];
  questions: { id?: string | undefined; text: string; state: string; askedAt?: string | undefined; answeredAt?: string | undefined }[];
}

export type FeedKind = "step" | "goal" | "decision" | "question" | "handTest" | "answered" | "tried";

export interface FeedItem {
  /** Stable for this one happening. */
  key: string;
  at: string;
  kind: FeedKind;
  /** Who did it: the AI working in a chat, or the Developer on the dashboard. */
  by: Who;
  /** In plain words, after the actor: "finished step t3 Fix callback". */
  text: string;
  goalId: string;
  goalTitle: string;
  /** Still waiting for the Developer (an open question, a thing not yet tried). */
  open?: boolean;
  isNew?: boolean;
}

const valid = (iso: string | undefined): iso is string => iso !== undefined && !Number.isNaN(Date.parse(iso));

/** Every dated happening in the goals, newest first, at most `limit` of them. */
export function buildFeed(goals: FeedGoal[], limit = 200): FeedItem[] {
  const items: FeedItem[] = [];
  for (const g of goals) {
    const base = { goalId: g.id, goalTitle: g.title };
    const add = (kind: FeedKind, key: string, at: string | undefined, by: Who, text: string, open?: boolean) => {
      if (valid(at)) items.push({ ...base, kind, key: `${kind}/${g.id}/${key}`, at, by, text, ...(open === undefined ? {} : { open }) });
    };
    if (g.status === "done") add("goal", "done", g.updated?.at, g.updated?.by ?? "AI", `finished goal ${g.title}`);
    g.tasks.forEach((t, i) => {
      if (t.status === "done" || t.status === "released") add("step", t.id ?? String(i), t.finishedAt, t.updated?.by ?? "AI", `finished step ${t.id ? `${t.id} ` : ""}${t.title}`);
    });
    g.decisions.forEach((d, i) => add("decision", d.id ?? String(i), d.added?.at, d.added?.by ?? "AI", "added a decision"));
    g.handTests.forEach((h, i) => {
      const id = h.id ?? String(i);
      add("handTest", id, h.added?.at, h.added?.by ?? "AI", "added something to try", h.result === "pending");
      add("tried", id, h.markedAt, "Developer", "tried something");
    });
    g.questions.forEach((q, i) => {
      const id = q.id ?? String(i);
      add("question", id, q.askedAt, "AI", "asked you a question", q.state === "open");
      add("answered", id, q.answeredAt, "Developer", "answered a question");
    });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key)).slice(0, limit);
}

/** Marks what the AI did after `since` (ms) as new. Your own changes are never new to you; with no `since` (a first look) nothing is. */
export function markNew(items: FeedItem[], since: number | undefined): FeedItem[] {
  return items.map((i) => ({ ...i, isNew: since !== undefined && i.by === "AI" && Date.parse(i.at) > since }));
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The one-line digest of what is new. */
/** What the digest says on the first look at a project in this browser: there is no "last time" to compare with. */
export const FIRST_LOOK = "This is your first look here: below is everything your AI has done, newest first. Next time, this line says what is new since now.";

export function digestLines(items: FeedItem[], since: number | undefined, now = Date.now()): string {
  if (since === undefined) return items.length > 0 ? FIRST_LOOK : "Nothing has happened in this project yet.";
  const fresh = items.filter((i) => i.isNew);
  if (fresh.length === 0) return "Nothing new since you last looked.";
  const of = (k: FeedKind, onlyOpen = false) => fresh.filter((i) => i.kind === k && (!onlyOpen || i.open));
  const parts: string[] = [];
  const steps = of("step").length;
  if (steps) parts.push(`${count(steps, "step")} finished`);
  const goals = of("goal");
  if (goals.length === 1) parts.push(`goal ${goals[0]!.goalTitle} finished`);
  else if (goals.length) parts.push(`${count(goals.length, "goal")} finished`);
  const decisions = of("decision").length;
  if (decisions) parts.push(count(decisions, "decision") + " added");
  const questions = of("question", true).length;
  if (questions) parts.push(`${count(questions, "question")} waiting for you`);
  const tests = of("handTest", true).length;
  if (tests) parts.push(`${count(tests, "thing")} to try`);
  if (parts.length === 0) return "Nothing new since you last looked.";
  return `Since you last looked (${ago(since, now)}): ${parts.join(", ")}`;
}
