// The first-run tour: a few short steps that point at the real dashboard, shown once per browser and
// skippable at any time (Tour.tsx draws it). Nothing here is ever required.

export interface TourStep {
  title: string;
  body: string;
  /** Where to point, best first; the first one on the page is used, else the step shows on its own. */
  targets: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Home and your projects",
    body: "Home shows every project at once: what needs you and what your AI is working on. Pick a project in the sidebar to see its goals.",
    targets: ['[data-tour="home"]', ".sidebar"],
  },
  {
    title: "A goal and its steps",
    body: "Each goal lists its steps, with the one your AI is on highlighted. It all updates by itself as your AI works.",
    targets: [".goal-head", ".main .page", ".main"],
  },
  {
    title: "Needs you",
    body: "When your AI has a question or something for you to try by hand, it waits under Needs you, and you answer with a click. Only if you want to: your AI carries on with other steps meanwhile.",
    targets: [".needs-panel", ".side-group.needs", '[data-tour="project"]', ".sidebar"],
  },
  {
    title: "Message your AI",
    body: "Write to your AI about the whole project from Message your AI in a project's sidebar. It reads your message at its next step and answers there.",
    targets: ['[data-tour="talk"]', '[data-tour="project"]', ".sidebar"],
  },
  {
    title: "Dashboard and Calendar",
    body: "Each project's Dashboard has the numbers: time spent, estimates, side trips. Its Calendar shows what was done and what comes next.",
    targets: ['[data-tour="dashboard"]', '[data-tour="project"]', ".sidebar"],
  },
  {
    title: "Settings, if you want them",
    body: "Settings has the theme, phone notifications and how your AI works. Everything there is optional. You can take this tour again from Help.",
    targets: ['[data-tour="settings"]'],
  },
];

/** The step after a press of Next, Back or Skip; undefined when the tour ends. */
export function tourMove(at: number, how: "next" | "back" | "skip", count: number): number | undefined {
  if (how === "skip") return undefined;
  if (how === "back") return Math.max(0, at - 1);
  return at + 1 < count ? at + 1 : undefined;
}

/** The first of `targets` that is on the page. */
export const firstTarget = (targets: string[], onPage: (selector: string) => boolean): string | undefined => targets.find(onPage);

const SEEN_KEY = "progressor.tour-seen";
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };

/** Whether this browser has seen the tour; true when the browser can't say, so it never shows over and over. */
export function tourSeen(store: Store): boolean {
  try {
    return store.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

/** Remembers the tour was seen; does nothing when the browser can't keep it. */
export function markTourSeen(store: Store): void {
  try {
    store.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    // nothing kept; the tour simply may show again
  }
}
