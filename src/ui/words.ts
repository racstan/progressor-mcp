// The words the dashboard shows. Its reader may not code, so every status is said in everyday words
// (step, side trip, cancelled, finished) and never in the Agent's terms (Task, Detour, dropped).

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
  done: "Done",
  dropped: "Cancelled",
  open: "Side trip under way",
  "merged back": "Side trip done",
  returned: "Back to the plan",
  recalibrated: "Plan changed",
};

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
  const current = live.indexOf("in progress");
  const done = live.filter((s) => s === "done").length;
  return { step: current >= 0 ? current + 1 : Math.min(done + 1, live.length), of: live.length };
}

export type GoalState = "working" | "waiting" | "stopped" | "paused" | "planned" | "finished" | "cancelled";

/** How long the plan can stay unchanged while the AI's chat is open before it counts as waiting. */
const QUIET = 15 * MIN;

/**
 * What the AI is doing about a Goal. `running` says whether the chat working on it is still open
 * (undefined when no chat holds it). An open chat that has not changed the plan for a while is most
 * likely waiting for the person.
 */
export function goalState(
  goal: { status: string; updatedAt: number | undefined; running: boolean | undefined },
  now = Date.now(),
): { state: GoalState; label: string; hint: string } {
  switch (goal.status) {
    case "done":
      return { state: "finished", label: "Finished", hint: "The AI finished this and checked it against what finished looks like." };
    case "dropped":
      return { state: "cancelled", label: "Cancelled", hint: "This was cancelled and will not be done." };
    case "planned":
      return { state: "planned", label: "Not started", hint: "Your AI has planned this but not started it yet." };
  }
  if (goal.running === false)
    return {
      state: "stopped",
      label: "AI stopped",
      hint: "The AI chat that was working on this has closed. Open a chat and ask your AI to carry on.",
    };
  if (goal.running === undefined || goal.status === "paused")
    return { state: "paused", label: "Paused", hint: "No AI is working on this right now. Ask your AI to carry on with it." };
  if (goal.updatedAt !== undefined && now - goal.updatedAt > QUIET)
    return {
      state: "waiting",
      label: "AI waiting",
      hint: "Your AI's chat is open, but nothing has changed for a while. It may be waiting for you: check the chat.",
    };
  return { state: "working", label: "AI working", hint: "Your AI is working on this. The page updates by itself." };
}

const steps = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

/** One line on where a Goal stands: "AI working · step 3 of 7 · last update 2 min ago". */
export function statusLine(
  goal: { status: string; updatedAt: number | undefined; running: boolean | undefined },
  statuses: readonly string[],
  now = Date.now(),
): string {
  const { state, label } = goalState(goal, now);
  const { step, of } = stepOf(statuses);
  const when = goal.updatedAt === undefined ? undefined : ago(goal.updatedAt, now);
  if (state === "cancelled") return label;
  if (state === "planned") return `${label} · ${steps(of)}`;
  if (state === "finished") return `${label}${when ? ` ${when}` : ""} · ${steps(of)}`;
  return [label, of ? `step ${step} of ${of}` : "no steps yet", when && `last update ${when}`].filter(Boolean).join(" · ");
}
