// "Try them one by one": the order the untried things to try come in, and where the person is.
// Pure, so it is tested; the walkthrough view only shows what this says.

/** One untried thing to try, with where it is. `key` is unique across projects and goals. */
export interface WalkItem {
  key: string;
  projectId: string;
  goalId: string;
  goalTitle: string;
  projectName: string;
  testId: string;
  /** When it was added (an ISO time), if the plan says. */
  added?: string;
}

/** What the person has done so far, by item key: marked ones, and skipped ones in the order skipped. */
export interface WalkState {
  handled: string[];
  skipped: string[];
}

const time = (i: WalkItem) => (i.added ? Date.parse(i.added) : NaN);

/** Oldest first across goals; ones with no known date come last, in the order given. */
export function orderItems(items: readonly WalkItem[]): WalkItem[] {
  const dated = (i: WalkItem) => !Number.isNaN(time(i));
  return items
    .map((item, at) => ({ item, at }))
    .sort((a, b) => Number(!dated(a.item)) - Number(!dated(b.item)) || (dated(a.item) ? time(a.item) - time(b.item) : 0) || a.at - b.at)
    .map((x) => x.item);
}

/** What is left, in order: the ones not skipped, then the skipped ones in the order they were skipped. */
export function queue(items: readonly WalkItem[], state: WalkState): WalkItem[] {
  const left = items.filter((i) => !state.handled.includes(i.key));
  const skipped = state.skipped.flatMap((k) => left.filter((i) => i.key === k));
  return [...left.filter((i) => !state.skipped.includes(i.key)), ...skipped];
}

/** Skip for now: the item goes to the end (again, if it was skipped before). */
export const skip = (state: WalkState, key: string): WalkState => ({ ...state, skipped: [...state.skipped.filter((k) => k !== key), key] });

/** The item was marked, so it is out of the queue. */
export const mark = (state: WalkState, key: string): WalkState => ({ handled: [...state.handled, key], skipped: state.skipped.filter((k) => k !== key) });

/** "3 of 7": the position of the one shown, and whether every one is marked. */
export function progress(total: number, state: WalkState): { position: number; total: number; done: boolean } {
  const done = state.handled.length >= total;
  return { position: done ? total : state.handled.length + 1, total, done };
}
