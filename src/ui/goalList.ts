// How the sidebar lists a Roadmap's Goals: the ones still in play, the finished ones in a Done group,
// and the ones the Developer hid. All of it is this browser's view; the plan files are never touched.

/** What happens to a Goal once it is done: wait for the Developer to look at it, or move to Done straight away. */
export type Finished = "review" | "auto";

interface GoalLike {
  id: string;
  status: string;
  done: number;
  total: number;
}

/** Which finished Goals this browser has seen, as the Goal's ID and its progress when it was seen. */
export type Seen = Record<string, string>;

/** A Goal's progress, so a Goal reopened and finished again with more Tasks counts as unseen. */
export const doneMark = (g: GoalLike) => `${g.done}/${g.total}`;

const finished = (g: GoalLike) => g.status === "done" || g.status === "dropped";

export function groupGoals<G extends GoalLike>(
  goals: G[],
  options: { finished: Finished; seen: Seen; hidden: string[] },
): { open: G[]; done: G[]; hidden: G[]; fresh: Set<string> } {
  const open: G[] = [];
  const done: G[] = [];
  const hidden: G[] = [];
  const fresh = new Set<string>();
  for (const g of goals) {
    if (options.hidden.includes(g.id)) hidden.push(g);
    else if (!finished(g)) open.push(g);
    else if (g.status === "done" && options.finished === "review" && options.seen[g.id] !== doneMark(g)) {
      fresh.add(g.id);
      open.push(g);
    } else done.push(g);
  }
  return { open, done, hidden, fresh };
}

/** The first time a browser shows a project, the Goals finished before then count as seen. */
export function seenOnFirstVisit(goals: GoalLike[]): Seen {
  return Object.fromEntries(goals.filter((g) => g.status === "done").map((g) => [g.id, doneMark(g)]));
}

/**
 * Whether a sidebar group is open: when the Developer opened it, or by itself while it holds the
 * goal on screen, unless the Developer closed it while that goal was on screen.
 */
export function groupOpen(g: { pinned: boolean; closedFor: string | undefined; holdsShown: boolean; shown: string | undefined }): boolean {
  return g.pinned || (g.holdsShown && g.closedFor !== g.shown);
}

/** The hidden list with more Goals added, each once. Hiding only changes this browser's list. */
export function hideAll(hidden: string[], ids: string[]): string[] {
  return [...new Set([...hidden, ...ids])];
}

// ---- Finished goals and steps by date ----
// A goal's `added` stamp is when it was added; a finished goal last changed when it was finished,
// so its `updated` stamp is its finish date. Plans from before dates have neither.

/** How the Finished list is ordered. */
export type FinishedSort = "finished-new" | "finished-old" | "name" | "added-new";
/** Whether the Finished list is split under the day each goal was added. */
export type GroupBy = "none" | "added";
/** How the steps list reads: plan order, or finished steps under the day they were finished. */
export type StepsView = "plan" | "newest" | "oldest";

/** Defaults and browser-storage keys, in one place so Settings can offer them later. */
export const FINISHED_SORT_DEFAULT: FinishedSort = "finished-new";
export const FINISHED_SORT_KEY = "progressor.finished-sort";
export const GROUP_BY_DEFAULT: GroupBy = "none";
export const GROUP_BY_KEY = "progressor.goal-group";
export const STEPS_VIEW_DEFAULT: StepsView = "plan";
export const STEPS_VIEW_KEY = "progressor.steps-view";

export const FINISHED_SORT_WORDS: Record<FinishedSort, string> = {
  "finished-new": "Newest finished first",
  "finished-old": "Oldest finished first",
  name: "Name A to Z",
  "added-new": "Newest added first",
};
export const GROUP_BY_WORDS: Record<GroupBy, string> = { none: "Not grouped", added: "Day added" };

export const isFinishedSort = (v: unknown): v is FinishedSort => typeof v === "string" && v in FINISHED_SORT_WORDS;
export const isGroupBy = (v: unknown): v is GroupBy => typeof v === "string" && v in GROUP_BY_WORDS;
export const isStepsView = (v: unknown): v is StepsView => v === "plan" || v === "newest" || v === "oldest";

export const DATE_UNKNOWN = "Date not known";

type Stamped = { title: string; added?: { at: string }; updated?: { at: string } };

/** When a finished goal was finished, as an ISO time. */
export const finishedOf = (g: Stamped) => g.updated?.at;
/** When a goal was added, as an ISO time. */
export const addedOf = (g: Stamped) => g.added?.at;

const time = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? undefined : t;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The local day of a time as a sortable number (yyyymmdd). */
const dayOf = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

/** "Today", "Yesterday", "Mon 3 Nov", or "Wed 3 Dec 2025" in another year; "Date not known" for no time. */
export function dayHeading(iso: string | undefined, now = Date.now()): string {
  const t = time(iso);
  if (t === undefined) return DATE_UNKNOWN;
  const today = new Date(now);
  const key = dayOf(t);
  if (key === dayOf(now)) return "Today";
  if (key === dayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12).getTime())) return "Yesterday";
  const d = new Date(t);
  const year = d.getFullYear() === today.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

/** The goals in the chosen order; goals with no date for the sort go last. The list given is not changed. */
export function sortFinished<G extends Stamped>(goals: G[], sort: FinishedSort): G[] {
  if (sort === "name") return [...goals].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const by = sort === "added-new" ? addedOf : finishedOf;
  const dir = sort === "finished-old" ? 1 : -1;
  return [...goals].sort((a, b) => {
    const x = time(by(a));
    const y = time(by(b));
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    return (x - y) * dir;
  });
}

/** Items split by the day of `when`, days in the order asked, items with no date in a last group. Order inside a day is kept. */
export function dayGroups<T>(items: T[], when: (item: T) => string | undefined, order: "newest" | "oldest", now = Date.now()): { key: string; heading: string; items: T[] }[] {
  const days = new Map<number, T[]>();
  const unknown: T[] = [];
  for (const item of items) {
    const t = time(when(item));
    if (t === undefined) unknown.push(item);
    else days.set(dayOf(t), [...(days.get(dayOf(t)) ?? []), item]);
  }
  const keys = [...days.keys()].sort((a, b) => (order === "newest" ? b - a : a - b));
  const groups = keys.map((k) => ({ key: String(k), heading: dayHeading(when(days.get(k)![0]!), now), items: days.get(k)! }));
  return unknown.length ? [...groups, { key: "unknown", heading: DATE_UNKNOWN, items: unknown }] : groups;
}
