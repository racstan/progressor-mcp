import { FREE_NOTICE } from "./words.js";

// The first-run tour: a welcome, then a few short steps that point at the real dashboard, showing the
// sample project (sample.ts) so there is always something to point at. When it opens is decided in
// firstLook.ts; Tour.tsx draws it, skippable at any time. Nothing here is required.

export interface TourStep {
  title: string;
  body: string;
  /** Where to point, best first; the first one on the page is used, else the step shows on its own. */
  targets: string[];
  /** A sentence shown in bold in a note on the card: the free notice, on the welcome. */
  notice?: string;
  /** The page of the sample project shown for this step: Home, the goal being worked on, the one waiting on you, or a page. */
  show: TourShow;
}

export type TourShow = "home" | "goal" | "needs" | "talk" | "dashboard";

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Progressor",
    body: "Your AI keeps its plan here, and this page follows along by itself. Here is a quick look around; skip it whenever you like.",
    targets: [],
    show: "home",
    // Someone has copied Progressor and sells it, so this comes before anything else.
    notice: FREE_NOTICE,
  },
  {
    title: "Home and your projects",
    body: "Home shows every project at once: what needs you and what your AI is working on. Pick a project in the sidebar to see its goals.",
    targets: ['[data-tour="home"]', ".sidebar"],
    show: "home",
  },
  {
    title: "A goal and its steps",
    body: "Each goal lists its steps, with the one your AI is on highlighted. It all updates by itself as your AI works.",
    targets: [".goal-head", ".main .page", ".main"],
    show: "goal",
  },
  {
    title: "Needs you",
    body: "When your AI has a question or something for you to try by hand, it waits under Needs you, and you answer with a click. Only if you want to: your AI carries on with other steps meanwhile.",
    targets: [".needs-panel", ".side-group.needs", '[data-tour="project"]', ".sidebar"],
    show: "needs",
  },
  {
    title: "Message your AI",
    body: "Write to your AI about the whole project from Message your AI in a project's sidebar. It reads your message at its next step and answers there.",
    targets: ['[data-tour="talk"]', '[data-tour="project"]', ".sidebar"],
    show: "talk",
  },
  {
    title: "Dashboard and Calendar",
    body: "Each project's Dashboard has the numbers: time spent, estimates, side trips. Its Calendar shows what was done and what comes next.",
    targets: ['[data-tour="dashboard"]', '[data-tour="project"]', ".sidebar"],
    show: "dashboard",
  },
  {
    title: "Settings, if you want them",
    body: "Settings has the theme, phone notifications and how your AI works. Everything there is optional. You can take this tour again from Help.",
    targets: ['[data-tour="settings"]'],
    show: "dashboard",
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
