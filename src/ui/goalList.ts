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
