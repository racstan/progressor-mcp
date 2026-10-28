// The words the dashboard shows. Its reader may not code, so every status is said in everyday words
// (step, side trip, cancelled, finished) and never in the Agent's terms (Task, Detour, dropped).

import { roughDuration, sayDuration, timeText } from "../estimate.js";
import type { GoalSchedule, Schedule } from "../schedule.js";

export const GOAL_WORD: Record<string, string> = {
  planned: "Not started",
  active: "In progress",
  paused: "Paused",
  done: "Finished",
  dropped: "Cancelled",
};

/** A step's status, and a side trip's: under way, or how it ended. */
export const STEP_WORD: Record<string, string> = {
  pending: "To do",
  "in progress": "Working on it",
  "with a helper": "With a helper",
  "waiting on you": "Waiting on you",
  checked: "Checked",
  done: "Done",
  released: "Released",
  dropped: "Cancelled",
  open: "Side trip under way",
  "merged back": "Side trip done",
  returned: "Back to the plan",
  recalibrated: "Plan changed",
};

/** What each of the newer step states means, for the hover, the details and the legend. */
export const STEP_HINT: Record<string, string> = {
  "with a helper": "The AI handed this step to a helper, another AI that works on it on the side.",
  "waiting on you": "The AI needs you for this step, for example to try something out by hand.",
  checked: "The AI looked over the helper's work and it holds up. It is not merged or released yet.",
  released: "Done and out: merged, shipped, installed or published.",
};

/**
 * The mark in front of a step in the list. The newer states are badges drawn in CSS (`.mk`), the same
 * shapes as on the map: a half-filled ring, a filled amber "!", a ringed tick, a filled tick with an outer ring.
 */
export const STEP_MARK: Record<string, string> = {
  done: "✓",
  "in progress": "▶",
  pending: "○",
  dropped: "✕",
  "with a helper": "",
  "waiting on you": "!",
  checked: "✓",
  released: "✓",
};

/** Whether a step's mark is one of the badges. */
export const isBadge = (status: string) => status === "with a helper" || status === "waiting on you" || status === "checked" || status === "released";

/** The class that names a status in CSS: "waiting on you" is "waiting-on-you". */
export const statusClass = (status: string) => status.replace(/ /g, "-");

/** The steps that are under way in some way, rather than waiting to start or over. */
const UNDER_WAY = ["in progress", "with a helper", "waiting on you", "checked"];

/** What a side trip's ending means, for its hover. */
export const SIDE_TRIP_HINT: Record<string, string> = {
  open: "The AI stepped off the plan to deal with something, and is still on it.",
  "merged back": "The AI dealt with something off the plan, then carried on with the plan as it was.",
  returned: "The AI went back to the plan, adding steps for what it found.",
  recalibrated: "What the AI found changed the plan: the remaining steps were replaced.",
};

const MIN = 60_000;

/** Roughly how long ago: "just now", "5 min ago", "2 h ago", "3 days ago". */
export function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / MIN);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** Which step the work is on, counting only the steps that are not cancelled. */
export function stepOf(statuses: readonly string[]): { step: number; of: number } {
  const live = statuses.filter((s) => s !== "dropped");
  const current = live.findIndex((s) => UNDER_WAY.includes(s));
  const done = live.filter((s) => s === "done" || s === "released").length;
  return { step: current >= 0 ? current + 1 : Math.min(done + 1, live.length), of: live.length };
}

export type GoalState = "you" | "working" | "waiting" | "stopped" | "paused" | "planned" | "finished" | "cancelled";

/** How long the plan can stay unchanged while the AI's chat is open before it counts as waiting. */
const QUIET = 15 * MIN;

/** What the status words need to know about a Goal. */
export type GoalStatus = {
  status: string;
  updatedAt: number | undefined;
  running: boolean | undefined;
  waitingOnYou?: boolean;
  /** How many of its steps are with a helper. */
  helpers?: number;
  /** The latest change an AI chat in another project made to the Goal, if any. */
  fromElsewhere?: FromElsewhere;
};

/** Where and when something was changed from another project (an `updated from` line). */
export type FromElsewhere = { project: string; at?: string };

/**
 * The tag on a goal, step, decision or note an AI chat in another project changed, such as
 * "Updated from rachitkdeaichat", with its hover. Undefined when it was not changed from elsewhere.
 */
export function elsewhereTag(origin: FromElsewhere | undefined, now = Date.now()): { label: string; hint: string } | undefined {
  if (!origin) return undefined;
  const at = origin.at ? Date.parse(origin.at) : NaN;
  return {
    label: `Updated from ${origin.project}`,
    hint: `This was changed by an AI chat working in another project, ${origin.project}${Number.isNaN(at) ? "" : `, ${ago(at, now)}`}. Your AI in this project is told about it.`,
  };
}

/** Whether a Goal's latest change came from another project: no change of its own is newer. */
export function lastChangeFromElsewhere(goal: Pick<GoalStatus, "fromElsewhere" | "updatedAt">): boolean {
  const at = goal.fromElsewhere?.at ? Date.parse(goal.fromElsewhere.at) : NaN;
  if (!goal.fromElsewhere || Number.isNaN(at)) return false;
  // The file is written just after the time in it is taken.
  return goal.updatedAt === undefined || at >= goal.updatedAt - 2000;
}

/**
 * What the AI is doing about a Goal. `running` says whether the chat working on it is still open
 * (undefined when no chat holds it). While a step is with a helper, work is going on even if the plan
 * has not changed for a long while: helpers often work for most of an hour. Otherwise an open chat
 * that has not changed the plan for a while is most likely waiting for the person. A checked step
 * does not count as work going on: it is the AI's own turn to merge and release it.
 */
export function goalState(goal: GoalStatus, now = Date.now()): { state: GoalState; label: string; hint: string } {
  switch (goal.status) {
    case "done":
      return { state: "finished", label: "Finished", hint: "The AI finished this and checked it against what finished looks like." };
    case "dropped":
      return { state: "cancelled", label: "Cancelled", hint: "This was cancelled and will not be done." };
    case "planned":
      return { state: "planned", label: "Not started", hint: "Your AI has planned this but not started it yet." };
  }
  // A step that needs the person comes before everything else: it is what they should look at.
  if (goal.waitingOnYou)
    return { state: "you", label: "Waiting on you", hint: "A step in this goal is waiting on you. Open the goal to see which one." };
  if (goal.running === false)
    return {
      state: "stopped",
      label: "AI stopped",
      hint: "The AI chat that was working on this has closed. Open a chat and ask your AI to carry on.",
    };
  if (goal.running === undefined || goal.status === "paused")
    return { state: "paused", label: "Paused", hint: "No AI is working on this right now. Ask your AI to carry on with it." };
  const helpers = goal.helpers ?? 0;
  if (helpers > 0)
    return {
      state: "working",
      label: "Helpers working",
      hint: `Your AI handed ${helpers === 1 ? "a step" : `${helpers} steps`} to helper agents, which work on them on the side and can take a while. The page updates by itself as each one comes back.`,
    };
  if (goal.updatedAt !== undefined && now - goal.updatedAt > QUIET)
    return {
      state: "waiting",
      label: "AI waiting",
      hint: "Your AI's chat is open, but nothing has changed for a while. It may be waiting for you: check the chat.",
    };
  return { state: "working", label: "AI working", hint: "Your AI is working on this. The page updates by itself." };
}

const steps = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

/**
 * One line on where a Goal stands: "AI working · step 3 of 7 · last update 2 min ago". While helpers
 * work it counts them instead: "Helpers working · 3 of 5 steps with helpers · last update 19 min ago".
 */
export function statusLine(goal: GoalStatus, statuses: readonly string[], now = Date.now()): string {
  const helpers = statuses.filter((s) => s === "with a helper").length;
  const { state, label } = goalState({ ...goal, helpers }, now);
  const { step, of } = stepOf(statuses);
  const when = goal.updatedAt === undefined ? undefined : ago(goal.updatedAt, now);
  // "updated from rachitkdeaichat" while the latest change came from an AI chat in another project.
  const elsewhere = lastChangeFromElsewhere(goal) ? ` · updated from ${goal.fromElsewhere!.project}` : "";
  if (state === "cancelled") return `${label}${elsewhere}`;
  if (state === "planned") return `${label} · ${steps(of)}${elsewhere}`;
  if (state === "finished") return `${label}${when ? ` ${when}` : ""} · ${steps(of)}${elsewhere}`;
  const where = label === "Helpers working" ? `${helpers} of ${of} ${of === 1 ? "step" : "steps"} with ${helpers === 1 ? "a helper" : "helpers"}` : of ? `step ${step} of ${of}` : "no steps yet";
  return [label, where, when && `last update ${when}`].filter(Boolean).join(" · ") + elsewhere;
}

/** The steps in the states that need a person's eye, as "1 waiting on you · 2 with a helper". Empty when none. */
export function countsLine(counts: Partial<Record<string, number>>): string {
  return (["waiting on you", "with a helper", "checked"] as const)
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${STEP_WORD[k]!.toLowerCase()}`)
    .join(" · ");
}

/** What a Goal's steps are doing right now, in a few words; undefined when none is under way. */
export function underWay(steps: readonly { title: string; status: string }[]): string | undefined {
  const quoted = (list: readonly { title: string }[]) => (list.length === 1 ? `"${list[0]!.title}"` : `${list.length} steps`);
  const waiting = steps.filter((t) => t.status === "waiting on you");
  if (waiting.length > 0) return `waiting on you for ${quoted(waiting)}`;
  const working = steps.filter((t) => t.status === "in progress");
  if (working.length > 0) return `working on ${quoted(working)}`;
  const helped = steps.filter((t) => t.status === "with a helper");
  if (helped.length > 0) return helped.length === 1 ? `${quoted(helped)} is with a helper` : `${helped.length} steps are with helpers`;
  const checked = steps.filter((t) => t.status === "checked");
  if (checked.length > 0) return checked.length === 1 ? `${quoted(checked)} is checked, not released yet` : `${checked.length} steps are checked, not released yet`;
  return undefined;
}

/** Where a note was filed from, in plain words; `goals` are the Roadmap's, matched by their refs. */
export function noteOrigin(from: string | undefined, goals: readonly { ref: string; title: string }[]): string | undefined {
  if (!from) return undefined;
  const title = goals.find((g) => g.ref === from)?.title;
  return title ? `Found while working on ${title}` : "Found while working on another goal";
}

const stepCount = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

/** What the schedule says about one goal, as "done in about 6 h (3 steps not estimated)"; undefined when it has nothing to say. */
export function finishWords(g: Pick<GoalSchedule, "finish" | "unknown" | "left">): string | undefined {
  const unknown = g.unknown > 0 ? `${stepCount(g.unknown)} not estimated` : "";
  // A goal whose open steps are all unknown has no time of its own to give, even if it waits behind others.
  if (g.left === 0) return unknown || undefined;
  return `done in about ${roughDuration(g.finish)}${unknown ? ` (${unknown})` : ""}`;
}

/**
 * The schedule in one line, from the estimates, the order of the goals and the helper limit: "Now: 2
 * helpers busy, at most 2 at once · Next: Add logout · Phase 8 done in about 6 h (3 steps not
 * estimated)". `focus` is the goal the reader is looking at; the whole plan is added when there are
 * more goals. Undefined when the plan has no estimates and no limit.
 */
export function scheduleLine(s: Schedule, focus?: string): string | undefined {
  if (!s.estimated && s.limit === undefined) return undefined;
  const own = s.running.length - s.helpers;
  const helpers =
    s.helpers > 0
      ? `${s.helpers} ${s.helpers === 1 ? "helper" : "helpers"} busy${s.limit !== undefined ? (s.helpers > s.limit ? `, more than the ${s.limit} allowed at once` : `, at most ${s.limit} at once`) : ""}`
      : s.limit !== undefined
        ? `no helpers busy, at most ${s.limit} at once`
        : "";
  const now = [own > 0 ? `your AI on ${stepCount(own)}` : "", helpers].filter(Boolean).join(", ");
  const parts = [`Now: ${now || "nothing running"}`];
  if (!s.estimated) return parts[0];
  if (s.next.length > 0) parts.push(`Next: ${s.next.slice(0, 2).map((t) => t.title).join(", then ")}`);
  const goal = s.goals.find((g) => g.id === focus) ?? s.goals.find((g) => g.left > 0 || g.unknown > 0);
  const goalWords = goal && finishWords(goal);
  if (goal && goalWords) parts.push(`${goal.title}${goalWords.startsWith("done") ? " " : ": "}${goalWords}`);
  if (s.goals.length > 1) {
    const all = finishWords({ finish: s.finish, unknown: s.unknown, left: s.goals.reduce((n, g) => n + g.left, 0) });
    if (all) parts.push(`all goals${all.startsWith("done") ? " " : ": "}${all}`);
  }
  return parts.join(" · ");
}

/** A step's estimate against the time it took, for its details: "Took 1 h 10 m, estimated 45 m". */
export function stepTime(t: { status: string; estimate?: number; spent?: number; timingSince?: string }, now = Date.now()): string | undefined {
  const running = !!t.timingSince && ["in progress", "with a helper", "waiting on you", "checked"].includes(t.status);
  const at = t.timingSince ? Date.parse(t.timingSince) : NaN;
  const spent = (t.spent ?? 0) + (running && !Number.isNaN(at) ? Math.max(0, (now - at) / MIN) : 0);
  const text = timeText({ estimate: t.estimate, spent, running });
  return text && text[0]!.toUpperCase() + text.slice(1);
}

/** A goal's estimate and expected finish, for its banner: "Estimated 6 h · done in about 3 h (2 steps not estimated)". */
export function goalTime(g: GoalSchedule | undefined): string | undefined {
  if (!g) return undefined;
  const parts = [g.estimate !== undefined ? `Estimated ${sayDuration(g.estimate)}` : undefined, finishWords(g)].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  const text = parts.join(" · ");
  return text[0]!.toUpperCase() + text.slice(1);
}

/** What the Developer found when they tried something by hand, in the words on the buttons and badges. */
export const HAND_WORD: Record<string, string> = {
  pending: "Not tried yet",
  works: "Works",
  "doesn't work": "Doesn't work",
  "won't test": "Won't test",
};

/** The summary line of a goal's things to try by hand: "2 to try · 1 works · 1 doesn't work". Empty when there are none. */
export function handTestsLine(tests: readonly { result: string }[]): string {
  const count = (r: string) => tests.filter((t) => t.result === r).length;
  const parts: [number, string][] = [
    [count("pending"), "to try"],
    [count("works"), "works"],
    [count("doesn't work"), "doesn't work"],
    [count("won't test"), "won't test"],
  ];
  return parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(" · ");
}

/** Whether every thing to try by hand has been marked, so the goal has nothing left waiting on the person. */
export const handTestsOpen = (tests: readonly { result: string }[]): number => tests.filter((t) => t.result === "pending").length;
