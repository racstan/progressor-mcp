// Claude Code hooks: text Claude Code adds to the Agent's context, so the plan stays in front of it
// without the Agent having to remember get_status. The hook runs as its own short-lived process and
// reads .progressor/ straight from disk; it has no Session, so it describes every Goal in progress.
import type { Task } from "./planFile.js";
import { PROGRESSOR_DIR, Project, type ProjectOverview, type Status } from "./project.js";
import { launcherWarning, onPath } from "./init.js";
import { seenFile, takeElsewhereLine } from "./elsewhere.js";
import { hardFirst, ruleText } from "./roadmap.js";
import { handTestLines } from "./handTestText.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PREFIX = "[Progressor]";
const task = (t: Task) => `${t.id} ${t.title}`;

const ids = (tasks: Task[]) => tasks.map((t) => t.id).join(", ");

/** The Tasks in a helper's hands or the Developer's, briefly. */
function elsewhere(s: Status): string[] {
  return [
    ...(s.withHelper.length > 0 ? [`with a helper: ${ids(s.withHelper)}`] : []),
    ...(s.waitingOnYou.length > 0 ? [`waiting on the Developer: ${ids(s.waitingOnYou)}`] : []),
  ];
}

function goalLine(s: Status): string {
  const now = s.currentTask ? task(s.currentTask) : "no Task started";
  return `- ${s.goal?.title}: ${[now, ...(s.nextTask ? [`next ${task(s.nextTask)}`] : []), ...elsewhere(s)].join("; ")}`;
}

function instructions(o: ProjectOverview): string[] {
  return [
    ...(o.standingInstructions.length > 0 ? [`Standing Instructions: ${hardFirst(o.standingInstructions).map(ruleText).join("; ")}`] : []),
    ...(o.context ? ["Important context:", o.context] : []),
  ];
}

function fullStatus(s: Status): string[] {
  const d = s.openDetour;
  return [
    `Goal: ${s.goal?.title} (${s.goal?.ref}), ${s.done} of ${s.total} Tasks done`,
    ...(s.goal?.outcome ? [`Outcome: ${s.goal.outcome}`] : []),
    s.currentTask ? `Current Task: ${task(s.currentTask)} (${s.planFile}:${s.currentTask.line})` : "Current Task: none started",
    ...(s.currentTask?.summary ? [`  Summary: ${s.currentTask.summary}`] : []),
    ...(d ? [`Open Detour: ${d.id} ${d.title}${d.branchedFrom ? `, branched from ${d.branchedFrom}` : ""}. Reason: ${d.reason ?? "none given"}`] : []),
    ...(s.withHelper.length > 0 ? [`With a helper: ${s.withHelper.map(task).join("; ")}`] : []),
    ...(s.waitingOnYou.length > 0 ? [`Waiting on the Developer: ${s.waitingOnYou.map(task).join("; ")}`] : []),
    ...(s.checked.length > 0 ? [`Checked, not yet released: ${s.checked.map(task).join("; ")}`] : []),
    s.nextTask
      ? `Next Task: ${task(s.nextTask)}`
      : s.withHelper.length + s.waitingOnYou.length + s.checked.length > 0
        ? "Next Task: none pending"
        : "Next Task: none; every Task is done or dropped",
    ...(s.decisions.length > 0 ? [`Decisions: ${s.decisions.map((d) => `${d.id} ${d.text}`).join("; ")}`] : []),
    ...(s.notes.length > 0 ? [`Notes: ${s.notes.map((n) => `${n.id} ${n.text}${n.from ? ` (from ${n.from})` : ""}`).join("; ")}`] : []),
    ...handTestLines(s.handTests),
  ];
}

/**
 * The status added at session start and after context compaction. Undefined for a project that has
 * no Goals, so projects that don't use Progressor get nothing.
 */
export function sessionStatus(o: ProjectOverview): string | undefined {
  if (o.active.length === 0 && o.paused.length === 0 && o.planned.length === 0 && !o.context) return undefined;
  const [only] = o.active;
  if (only && o.active.length === 1)
    return [
      `${PREFIX} The plan for this project, kept in .progressor/ by the progressor MCP server:`,
      ...fullStatus(only),
      ...instructions(o),
      "Call get_status before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  // One Session holding them all is most likely this conversation, picking up after compaction.
  if (o.active.length > 1 && new Set(o.active.map((s) => s.goal?.claim?.session)).size === 1)
    return [
      `${PREFIX} One Session is working on ${o.active.length} Goals in this project:`,
      ...o.active.flatMap(fullStatus),
      ...instructions(o),
      "Call get_status before you start, and pass goal (the Goal ID) to the tools that change one. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  if (o.active.length > 1)
    return [
      `${PREFIX} ${o.active.length} Goals are being worked on in this project:`,
      ...o.active.map(goalLine),
      ...instructions(o),
      "Call get_status to see which Goal is yours before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  const at = (s: Status) => (s.currentTask ? `at ${task(s.currentTask)}` : s.nextTask ? `next ${task(s.nextTask)}` : "no Tasks left");
  return [
    `${PREFIX} No Goal is being worked on in this project right now.`,
    ...(o.paused.length > 0 ? [`Paused: ${o.paused.map((s) => `${s.goal?.title} (${at(s)})`).join("; ")}`] : []),
    ...(o.planned.length > 0 ? [`Planned: ${o.planned.map((g) => g.title).join("; ")}`] : []),
    ...instructions(o),
    "Before starting work, call get_status, then claim the Goal the Developer wants to work on (claim_goal) or add one (add_goal).",
  ].join("\n");
}

/** A plan that has not changed for longer than this may no longer match the work, so the reminder says so. */
export const STALE_AFTER_MINUTES = 30;

/** How long ago a plan last changed, such as "12 min ago" or "2 h ago". */
function ago(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (24 * 60))} days ago`;
}

/** The plan's age in minutes, or undefined when it has no time. A time in the future counts as now. */
const age = (s: Status, now: Date) => (s.updatedAt === undefined ? undefined : Math.max(0, (now.getTime() - s.updatedAt) / 60_000));
const STALE = "may be out of date";

/**
 * The one-line reminder added to every prompt; silent when no Goal is being worked on. It says when
 * the plan last changed, since a reminder naming a step a helper finished long ago misleads.
 */
export function promptReminder(o: ProjectOverview, now = new Date()): string | undefined {
  const [only] = o.active;
  if (!only) return undefined;
  if (o.active.length > 1) {
    const each = o.active.map((s) => {
      const here = s.currentTask ? task(s.currentTask) : "no Task started";
      const minutes = age(s, now);
      const stale = minutes !== undefined && minutes > STALE_AFTER_MINUTES ? `; updated ${ago(minutes)}, ${STALE}` : "";
      return `${s.goal?.title} (${here}${s.waitingOnYou.length > 0 ? "; waiting on the Developer" : ""}${stale})`;
    });
    return `${PREFIX} Goals in progress: ${each.join(", ")}. Call get_status if unsure which is yours.`;
  }
  const d = only.openDetour;
  const where = d
    ? `On Detour ${d.id} ${d.title}${d.branchedFrom ? ` (from ${d.branchedFrom})` : ""}`
    : `Task: ${only.currentTask ? task(only.currentTask) : "none started"}`;
  const minutes = age(only, now);
  return [
    `${PREFIX} Goal: ${only.goal?.title}`,
    where,
    ...(only.nextTask ? [`Next: ${task(only.nextTask)}`] : []),
    ...(only.withHelper.length > 0 ? [`With a helper: ${ids(only.withHelper)} (mark each checked once you check its work)`] : []),
    ...(only.waitingOnYou.length > 0 ? [`Waiting on the Developer: ${ids(only.waitingOnYou)}`] : []),
    ...(minutes === undefined ? [] : [`updated ${ago(minutes)}${minutes > STALE_AFTER_MINUTES ? `, ${STALE}; call get_status` : ""}`]),
  ].join(" · ");
}

/** Claude Code caps hook text added to context at 10,000 characters; stay under it. */
export const MAX_CONTEXT = 9_500;
const CUT = "\n[Progressor: cut short; call get_status for the rest]";

const EVENTS: Record<string, "session-start" | "prompt"> = {
  "session-start": "session-start",
  SessionStart: "session-start",
  prompt: "prompt",
  UserPromptSubmit: "prompt",
};

export interface HookRun {
  /** The event named on the command line (`hook session-start` or `hook prompt`); else taken from the input. */
  event: string | undefined;
  /** The JSON Claude Code sends on stdin. */
  input: string;
  env: Record<string, string | undefined>;
  isAlive?: (pid: number) => boolean;
  /** Whether this computer has a command; looked up on PATH unless given. */
  canRun?: (command: string) => boolean;
  /** The time the reminder's ages count from. */
  now?: () => Date;
}

/**
 * What `progressor-mcp hook <event>` prints. Claude Code adds a SessionStart or UserPromptSubmit
 * hook's plain stdout to the Agent's context. It never throws: a hook must not get in the way of
 * the session, so anything unexpected prints nothing.
 */
export function runHook({ event, input, env, isAlive, canRun = (c) => onPath(c, env, process.platform), now = () => new Date() }: HookRun): string {
  try {
    const data = JSON.parse(input) as { cwd?: unknown; hook_event_name?: unknown };
    const kind = EVENTS[event ?? String(data.hook_event_name)];
    const root = env.PROGRESSOR_ROOT ?? env.CLAUDE_PROJECT_DIR ?? (typeof data.cwd === "string" ? data.cwd : undefined);
    if (!kind || !root || !existsSync(join(root, PROGRESSOR_DIR))) return "";
    const project = new Project({ root, session: { id: "hook", pid: process.pid }, isAlive });
    const overview = project.overview();
    const warning = kind === "session-start" ? launcherWarning(root, canRun) : undefined;
    const status = kind === "session-start" ? sessionStatus(overview) : promptReminder(overview, now());
    // Changes an AI chat in another project made to this plan, told once (elsewhere.ts).
    const elsewhere = takeElsewhereLine(project, env.PROGRESSOR_REGISTRY ? seenFile(env.PROGRESSOR_REGISTRY) : seenFile());
    const text = [
      ...(warning ? [`${PREFIX} ${warning}`] : []),
      ...(status ? [status] : []),
      ...(elsewhere ? [`${PREFIX} ${elsewhere}`] : []),
    ].join("\n");
    return text.length <= MAX_CONTEXT ? text : text.slice(0, MAX_CONTEXT - CUT.length) + CUT;
  } catch {
    return "";
  }
}
