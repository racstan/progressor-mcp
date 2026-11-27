// Claude Code hooks: text Claude Code adds to the Agent's context, so the plan stays in front of it
// without the Agent having to remember get_status. The hook runs as its own short-lived process and
// reads .progressor/ straight from disk; it has no Session, so it describes every Goal in progress.
import type { Task } from "./planFile.js";
import { PROGRESSOR_DIR, Project, type ProjectOverview, type Status } from "./project.js";
import { launcherWarning, onPath } from "./init.js";
import { promptToldFile, seenFile, takeElsewhereLine, toldChanged } from "./elsewhere.js";
import { hardFirst, hotfixLine, ruleText } from "./roadmap.js";
import { type GlobalNotes, contextLines, defaultGlobalFile, globalFileFor, globalRuleText, notEverywhere, readGlobal } from "./globalRules.js";
import { handTestLines } from "./handTestText.js";
import { promptNewsLine, talkLines } from "./talkText.js";
import { existsSync } from "node:fs";
import { formatRules } from "./helperRules.js";
import { linkedBranch } from "./stepSync.js";
import { planRootFor } from "./worktree.js";
import { liveSessions } from "./liveSessions.js";
import { defaultServersDir, listServers } from "./servers.js";
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

function instructions(o: ProjectOverview, global?: GlobalNotes): string[] {
  const everywhere = global ? hardFirst(global.rules) : [];
  const own = notEverywhere(hardFirst(o.standingInstructions), global);
  return [
    // The rules and context for everything (globalRules.ts) come before the project's own.
    ...(everywhere.length > 0 ? [`Rules for everything: ${everywhere.map(globalRuleText).join("; ")}`] : []),
    ...(global ? contextLines(global) : []),
    ...(own.length > 0 ? [`Standing Instructions: ${own.map(ruleText).join("; ")}`] : []),
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
    ...talkLines(s),
    ...[promptNewsLine(s.messages.filter((m) => m.state === "new"), s.answers)].filter((l): l is string => l !== undefined),
  ];
}

/**
 * The status added at session start and after context compaction. Undefined for a project that has
 * no Goals, so projects that don't use Progressor get nothing.
 */
export function sessionStatus(o: ProjectOverview, global?: GlobalNotes): string | undefined {
  const everywhere = !!global && (global.rules.length > 0 || !!global.computer || !!global.me);
  if (o.active.length === 0 && o.paused.length === 0 && o.planned.length === 0 && !o.context && !everywhere) return undefined;
  const hotfix = hotfixOf(o);
  const text = sessionText(o, global);
  return hotfix ? `${PREFIX} ${hotfix}\n${text}` : text;
}

/** The hotfix line, while one is not started or was let go (see hotfixLine). */
function hotfixOf(o: ProjectOverview): string | undefined {
  return hotfixLine([...o.planned, ...o.paused.flatMap((s) => (s.goal ? [s.goal] : []))]);
}

function sessionText(o: ProjectOverview, global?: GlobalNotes): string {
  const [only] = o.active;
  if (only && o.active.length === 1)
    return [
      `${PREFIX} The plan for this project, kept in .progressor/ by the progressor MCP server:`,
      ...fullStatus(only),
      ...instructions(o, global),
      "Call get_status before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  // One Session holding them all is most likely this conversation, picking up after compaction.
  if (o.active.length > 1 && new Set(o.active.map((s) => s.goal?.claim?.session)).size === 1)
    return [
      `${PREFIX} One Session is working on ${o.active.length} Goals in this project:`,
      ...o.active.flatMap(fullStatus),
      ...instructions(o, global),
      "Call get_status before you start, and pass goal (the Goal ID) to the tools that change one. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  if (o.active.length > 1)
    return [
      `${PREFIX} ${o.active.length} Goals are being worked on in this project:`,
      ...o.active.map(goalLine),
      ...instructions(o, global),
      "Call get_status to see which Goal is yours before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
    ].join("\n");
  const at = (s: Status) => (s.currentTask ? `at ${task(s.currentTask)}` : s.nextTask ? `next ${task(s.nextTask)}` : "no Tasks left");
  return [
    `${PREFIX} No Goal is being worked on in this project right now.`,
    ...(o.paused.length > 0 ? [`Paused: ${o.paused.map((s) => `${s.goal?.title} (${at(s)})`).join("; ")}`] : []),
    ...(o.planned.length > 0 ? [`Planned: ${o.planned.map((g) => g.title).join("; ")}`] : []),
    ...(o.paused.some((s) => s.currentTask)
      ? ["A Goal paused with a step under way was most likely left by this chat before a restart or by one that ended: claim it (claim_goal) and carry on."]
      : []),
    ...instructions(o, global),
    "Before starting work, call get_status, then claim the Goal the Developer wants to work on (claim_goal) or add one (add_goal).",
  ].join("\n");
}

/**
 * The one-line reminder for a prompt; silent when no Goal is being worked on. The hook prints it only
 * when it changed since the chat's last prompt (promptToldFile), so an unchanged plan costs nothing.
 */
export function promptReminder(o: ProjectOverview, _now = new Date()): string | undefined {
  // A waiting hotfix is said in every Session, even one with no Goal in progress, until one claims it.
  const hotfix = hotfixOf(o);
  const plan = planReminder(o);
  const reminder = hotfix ? [`${PREFIX} ${hotfix}`, ...(plan ? [plan] : [])].join("\n") : plan;
  // What the Developer wrote on the dashboard for the Goals in progress; get_status marks it seen.
  // Messages to the whole project show even when no Goal is in progress: they can say what to start.
  const news = promptNewsLine(
    o.active.flatMap((s) => s.messages.filter((m) => m.state === "new")),
    o.active.flatMap((s) => s.answers),
    o.projectMessages.filter((m) => m.state === "new"),
  );
  if (!news) return reminder;
  return reminder ? `${reminder}\n${PREFIX} ${news}` : `${PREFIX} ${news}`;
}

function planReminder(o: ProjectOverview): string | undefined {
  const [only] = o.active;
  if (!only) return undefined;
  if (o.active.length > 1) {
    const each = o.active.map((s) => {
      const here = s.currentTask ? task(s.currentTask) : "no Task started";
      return `${s.goal?.title} (${here}${s.waitingOnYou.length > 0 ? "; waiting on the Developer" : ""})`;
    });
    return `${PREFIX} Goals in progress: ${each.join(", ")}. Call get_status if unsure which is yours.`;
  }
  const d = only.openDetour;
  const where = d
    ? `On Detour ${d.id} ${d.title}${d.branchedFrom ? ` (from ${d.branchedFrom})` : ""}`
    : `Task: ${only.currentTask ? task(only.currentTask) : "none started"}`;
  return [
    `${PREFIX} Goal: ${only.goal?.title}`,
    where,
    ...(only.nextTask ? [`Next: ${task(only.nextTask)}`] : []),
    ...(only.withHelper.length > 0 ? [`With a helper: ${ids(only.withHelper)}`] : []),
    ...(only.waitingOnYou.length > 0 ? [`Waiting on the Developer: ${ids(only.waitingOnYou)}`] : []),
  ].join(" · ");
}

/** The one open step a branch is for (stepSync.ts linkedBranch), across the goals in progress; undefined when none or several. */
export function stepForBranch(project: Project, branch: string): { goal: string; task: string } | undefined {
  const found: { goal: string; task: string }[] = [];
  for (const g of project.roadmap().goals.filter((x) => x.status === "active" || x.status === "paused")) {
    try {
      for (const t of project.plan(g.id).tasks)
        if (t.id && !["done", "released", "dropped"].includes(t.status) && linkedBranch({ id: t.id, helper: t.helper }, [branch]) === branch) found.push({ goal: g.id, task: t.id });
    } catch {
      // a plan file that can't be read names no step
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

/**
 * What a helper chat started in a git worktree of the project is told at session start (and after
 * compaction): that it is a helper, the step its branch is for when one is (stepSync.ts), and the
 * rules, so nobody has to paste them into its brief.
 */
export function helperStart(project: Project, folder: string, branch: string | undefined, global: GlobalNotes): string {
  let step: string | undefined;
  let where = "goal <id>, task <id>";
  if (branch) {
    const found: { text: string; where: string }[] = [];
    for (const g of project.roadmap().goals.filter((x) => x.status === "active" || x.status === "paused")) {
      try {
        for (const t of project.plan(g.id).tasks) {
          if (!t.id || t.status === "done" || t.status === "released" || t.status === "dropped") continue;
          if (linkedBranch({ id: t.id, helper: t.helper }, [branch]) === branch)
            found.push({ text: `Your step: ${t.id} ${t.title} (goal ${g.title})${t.summary ? `: ${t.summary}` : ""}`, where: `goal ${g.id}, task ${t.id}` });
        }
      } catch {
        // a plan file that can't be read names no step
      }
    }
    if (found.length === 1) {
      step = found[0]!.text;
      where = found[0]!.where;
    }
  }
  return [
    `${PREFIX} This chat is a helper working in a git worktree of ${project.root}${branch ? ` (folder ${folder}, branch ${branch})` : ` (folder ${folder})`}. The main chat keeps the plan; follow your brief and these rules.`,
    ...(step ? [step] : []),
    `When your work is done, attach your report to your step with attach_report (${where}) instead of writing it to a file.`,
    formatRules(project.roadmap().standingInstructions, global),
  ].join("\n");
}

/** Claude Code caps hook text added to context at 10,000 characters; stay under it. */
export const MAX_CONTEXT = 9_500;
const CUT = "\n[Progressor: cut short; call get_status for the rest]";

const EVENTS: Record<string, "session-start" | "prompt" | "stop"> = {
  "session-start": "session-start",
  SessionStart: "session-start",
  prompt: "prompt",
  UserPromptSubmit: "prompt",
  stop: "stop",
  Stop: "stop",
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
    const data = JSON.parse(input) as { cwd?: unknown; hook_event_name?: unknown; transcript_path?: unknown; session_id?: unknown };
    const kind = EVENTS[event ?? String(data.hook_event_name)];
    const folder = env.PROGRESSOR_ROOT ?? env.CLAUDE_PROJECT_DIR ?? (typeof data.cwd === "string" ? data.cwd : undefined);
    if (!kind || !folder) return "";
    // A helper chat in a git worktree of the project reads the main folder's plan (worktree.ts).
    const placed = env.PROGRESSOR_ROOT ? { root: folder } : planRootFor(folder);
    const root = placed.root;
    if (!existsSync(join(root, PROGRESSOR_DIR))) return "";
    if (placed.worktree) {
      // A helper chat claims nothing: its tokens go to the step its branch is for.
      if (typeof data.transcript_path === "string" && data.transcript_path) {
        const reader = new Project({ root, session: { id: "hook", pid: process.pid }, isAlive, now, clearStaleClaims: false });
        reader.collectCost(data.transcript_path, placed.branch ? stepForBranch(reader, placed.branch) : undefined);
      }
      if (kind !== "session-start") return "";
      const global = readGlobal(env.PROGRESSOR_REGISTRY ? globalFileFor(env.PROGRESSOR_REGISTRY) : defaultGlobalFile());
      const helper = new Project({ root, session: { id: "hook", pid: process.pid }, isAlive, now, clearStaleClaims: false });
      const text = helperStart(helper, placed.worktree, placed.branch, global);
      return text.length <= MAX_CONTEXT ? text : text.slice(0, MAX_CONTEXT - CUT.length) + CUT;
    }
    // The hook only reads: tidying claims of chats that look closed is the server's job, under its lock.
    const project = new Project({ root, session: { id: "hook", pid: process.pid }, isAlive, now, clearStaleClaims: false });
    // Token use since the last message, added to the goal and step the chat was on (cost.ts).
    if (typeof data.transcript_path === "string" && data.transcript_path) project.collectCost(data.transcript_path);
    // The end of a reply only counts: Claude Code shows nothing a Stop hook prints.
    if (kind === "stop") return "";
    let overview: ReturnType<Project["overview"]>;
    try {
      overview = project.overview();
    } catch {
      return `${PREFIX} Progressor can't read this project's plan right now, so this message has no status. Call get_status: it says what is wrong.`;
    }
    const warning = kind === "session-start" ? launcherWarning(root, canRun) : undefined;
    const global = readGlobal(env.PROGRESSOR_REGISTRY ? globalFileFor(env.PROGRESSOR_REGISTRY) : defaultGlobalFile());
    const status = kind === "session-start" ? sessionStatus(overview, global) : promptReminder(overview, now());
    // Changes an AI chat in another project made to this plan, told once (elsewhere.ts).
    const elsewhere = takeElsewhereLine(project, env.PROGRESSOR_REGISTRY ? seenFile(env.PROGRESSOR_REGISTRY) : seenFile());
    // More helpers at work than the project allows: said on every message until one comes back.
    let overLimit: string | undefined;
    if (kind === "prompt") {
      try {
        const registry = env.PROGRESSOR_REGISTRY;
        const records = listServers(registry ? defaultServersDir(registry) : defaultServersDir(), { ...(isAlive ? { isAlive } : {}), now });
        const { busy, limit, rule, chats } = project.helperLoad({ chats: liveSessions(project, records), global: global.rules });
        if (limit !== undefined && busy > limit)
          overLimit = `${busy} helpers are at work${chats ? ` (${chats} chats in this project)` : ""}, over the helper limit of ${limit} (${rule!.id}): hand out no more until one comes back.`;
      } catch {
        // the reminder never fails the message
      }
    }
    // A prompt gets the status only when it changed since this chat's last one; the one-time line from
    // elsewhere and the over-limit warning are said whenever they are there, and never make the status count as changed.
    let shownStatus = status;
    if (kind === "prompt" && status && typeof data.session_id === "string" && data.session_id) {
      if (!toldChanged(promptToldFile(env.PROGRESSOR_REGISTRY), data.session_id, status, now())) shownStatus = undefined;
    }
    const text = [
      ...(warning ? [`${PREFIX} ${warning}`] : []),
      ...(shownStatus ? [shownStatus] : []),
      ...(overLimit ? [`${PREFIX} ${overLimit}`] : []),
      ...(elsewhere ? [`${PREFIX} ${elsewhere}`] : []),
    ].join("\n");
    return text.length <= MAX_CONTEXT ? text : text.slice(0, MAX_CONTEXT - CUT.length) + CUT;
  } catch {
    return "";
  }
}
