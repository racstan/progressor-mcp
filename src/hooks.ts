// Claude Code hooks: text Claude Code adds to the Agent's context, so the plan stays in front of it
// without the Agent having to remember get_status. The hook runs as its own short-lived process and
// reads .progressor/ straight from disk; it has no Session, so it describes every Goal in progress.
import type { Task } from "./planFile.js";
import { PROGRESSOR_DIR, Project, type ProjectOverview, type Status } from "./project.js";
import { launcherWarning, onPath } from "./init.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PREFIX = "[Progressor]";
const task = (t: Task) => `${t.id} ${t.title}`;

function goalLine(s: Status): string {
  const now = s.currentTask ? task(s.currentTask) : "no Task started";
  return `- ${s.goal?.title}: ${now}${s.nextTask ? `; next ${task(s.nextTask)}` : ""}`;
}

function instructions(o: ProjectOverview): string[] {
  return o.standingInstructions.length > 0
    ? [`Standing Instructions: ${o.standingInstructions.map((i) => `${i.id} ${i.text}`).join("; ")}`]
    : [];
}

function fullStatus(s: Status): string[] {
  const d = s.openDetour;
  return [
    `Goal: ${s.goal?.title} (${s.goal?.ref}), ${s.done} of ${s.total} Tasks done`,
    ...(s.goal?.outcome ? [`Outcome: ${s.goal.outcome}`] : []),
    s.currentTask ? `Current Task: ${task(s.currentTask)} (${s.planFile}:${s.currentTask.line})` : "Current Task: none started",
    ...(s.currentTask?.summary ? [`  Summary: ${s.currentTask.summary}`] : []),
    ...(d ? [`Open Detour: ${d.id} ${d.title}${d.branchedFrom ? `, branched from ${d.branchedFrom}` : ""}. Reason: ${d.reason ?? "none given"}`] : []),
    s.nextTask ? `Next Task: ${task(s.nextTask)}` : "Next Task: none; every Task is done or dropped",
  ];
}

/**
 * The status added at session start and after context compaction. Undefined for a project that has
 * no Goals, so projects that don't use Progressor get nothing.
 */
export function sessionStatus(o: ProjectOverview): string | undefined {
  if (o.active.length === 0 && o.paused.length === 0 && o.planned.length === 0) return undefined;
  const [only] = o.active;
  if (only && o.active.length === 1)
    return [
      `${PREFIX} The plan for this project, kept in .progressor/ by the progressor MCP server:`,
      ...fullStatus(only),
      ...instructions(o),
      "Call get_status before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
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

/** The one-line reminder added to every prompt; silent when no Goal is being worked on. */
export function promptReminder(o: ProjectOverview): string | undefined {
  const [only] = o.active;
  if (!only) return undefined;
  if (o.active.length > 1) {
    const each = o.active.map((s) => `${s.goal?.title} (${s.currentTask ? task(s.currentTask) : "no Task started"})`);
    return `${PREFIX} Goals in progress: ${each.join(", ")}. Call get_status if unsure which is yours.`;
  }
  const d = only.openDetour;
  const now = d
    ? `On Detour ${d.id} ${d.title}${d.branchedFrom ? ` (from ${d.branchedFrom})` : ""}`
    : `Task: ${only.currentTask ? task(only.currentTask) : "none started"}`;
  return [`${PREFIX} Goal: ${only.goal?.title}`, now, ...(only.nextTask ? [`Next: ${task(only.nextTask)}`] : [])].join(" · ");
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
}

/**
 * What `progressor-mcp hook <event>` prints. Claude Code adds a SessionStart or UserPromptSubmit
 * hook's plain stdout to the Agent's context. It never throws: a hook must not get in the way of
 * the session, so anything unexpected prints nothing.
 */
export function runHook({ event, input, env, isAlive, canRun = (c) => onPath(c, env, process.platform) }: HookRun): string {
  try {
    const data = JSON.parse(input) as { cwd?: unknown; hook_event_name?: unknown };
    const kind = EVENTS[event ?? String(data.hook_event_name)];
    const root = env.PROGRESSOR_ROOT ?? env.CLAUDE_PROJECT_DIR ?? (typeof data.cwd === "string" ? data.cwd : undefined);
    if (!kind || !root || !existsSync(join(root, PROGRESSOR_DIR))) return "";
    const overview = new Project({ root, session: { id: "hook", pid: process.pid }, isAlive }).overview();
    const warning = kind === "session-start" ? launcherWarning(root, canRun) : undefined;
    const status = kind === "session-start" ? sessionStatus(overview) : promptReminder(overview);
    const text = [...(warning ? [`${PREFIX} ${warning}`] : []), ...(status ? [status] : [])].join("\n");
    return text.length <= MAX_CONTEXT ? text : text.slice(0, MAX_CONTEXT - CUT.length) + CUT;
  } catch {
    return "";
  }
}
