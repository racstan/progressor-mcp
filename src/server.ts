import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { Dashboard } from "./dashboard/http.js";
import { defaultRegistryFile, projectEntry } from "./dashboard/registry.js";
import { type CiDeps, ciCacheFile, realCiDeps } from "./ci.js";
import { attachReport, removeReport } from "./reports.js";
import { stepWaitLine, stepWaits, waitLine, waitTotals } from "./waits.js";
import { resolveProject, sameFolder, seenFile, takeElsewhereLine } from "./elsewhere.js";
import { type GoalLookup, waitsText } from "./dependencies.js";
import { checkUp, checkupLine } from "./checkup.js";
import { hooksAdvice, launchFor, startedViaNpx, startedViaUvx } from "./init.js";
import { parseDuration, roughDuration, sayDuration, timeText } from "./estimate.js";
import { type Decision, type Detour, type HelperInfo, type NewTask, type Note, type Task, type TaskStatus, TIMED, timeSpent } from "./planFile.js";
import { type DetourEnding, type FoundItem, HANDED_TO_NEXT, MAX_CONTEXT_LENGTH, PROJECT_TALK, Project, type SessionStatus, type Status, type TaskOperation } from "./project.js";
import { dashboardPrompt, nextPrompt, planPrompt, reviewPrompt, setupPrompt, statusPrompt } from "./prompts.js";
import { handTestLines, handTestWord } from "./handTestText.js";
import { elsewhereNewsLine, newsLines, projectTalkLine, talkLines } from "./talkText.js";
import { type ResourceLock, holderText, resourceLine } from "./resources.js";
import { oncePerDay, reminderLine, summarizeUntried } from "./untried.js";
import { type Goal, type StandingInstruction, hardFirst, helperLimit, hotfixLine, ruleText } from "./roadmap.js";
import { readinessText } from "./readiness.js";
import { LEVELS, RISK_STATUSES, type Risk, unreducedSeriousRisks } from "./risks.js";
import type { GoalSchedule, Schedule } from "./schedule.js";
import type { Wish } from "./wishlist.js";
import { readSettings, settingsFileFor } from "./settings.js";
import { howInstalled, refreshUpdate, takeUpdateLine, updateFileFor } from "./updateCheck.js";
import { everyWords, parseEvery } from "./routines.js";
import { releaseFacts } from "./facts.js";
import { offerHint, parseWait } from "./alternatives.js";
import { registerFeatureTools } from "./tools/index.js";
import { formatRules } from "./helperRules.js";
export { formatRules };
import { type ServerRecord, defaultServersDir, listServers } from "./servers.js";
import { liveSessions } from "./liveSessions.js";
import { type GlobalNotes, PART_TITLE, addGlobalRule, contextLines, globalFileFor, globalInstructions, globalStatusLines, notEverywhere, readGlobal, setGlobalContext, updateGlobalRule } from "./globalRules.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const BUILD_SEAL = "368785021a7bdfc977b37e328e88f7750027fa2b92ecb8f73cfeeb2b2e433fa0";
const BUILD = { version: VERSION, seal: BUILD_SEAL } as const;

export const INSTRUCTIONS = `Progressor keeps the plan for this project in .progressor/ and shows it to the Developer on a live dashboard. Change the plan only with these tools, never by editing those files. The Developer may not be a programmer: you run the plan, they watch.

1. At the start of every conversation and after context compression, call get_status and follow the Standing Instructions it lists. If it says one Goal is paused, claim it (claim_goal) and carry on. If tools are deferred, load them once: ToolSearch "select:mcp__progressor__get_status,mcp__progressor__claim_goal,mcp__progressor__add_goal,mcp__progressor__add_tasks,mcp__progressor__update_tasks,mcp__progressor__save_hand_test,mcp__progressor__save_decision,mcp__progressor__complete_goal".
2. When the Developer asks for work no Goal covers, plan it as a Goal: a short title, an Outcome (one sentence) and Tasks, each with the files it touches, a one-line summary and an estimate ("45m", "2h"). Tell the Developer the plan in a few plain lines, then add_goal with claim: true. A quick question needs no Goal.
3. Before code for a Task longer than a few minutes, start it with update_tasks. One step is one update_tasks call: complete it (files touched, new summary if it differs, hand_tests, decisions) and start the next in the same call; drop what is not needed. Record a small finished change in one call: add_tasks with done: true (and hand_test). Keep summaries and estimates true with update_task. set_task_state records Tasks in other hands (with a helper, waiting on you, checked, released); keep to any helper limit get_status shows.
4. To change several Tasks at once, give update_tasks several operations (applied in order, all or nothing). move_task moves a Task to another Goal. To hold several Goals, claim each one and pass goal (its ID) to the tools that change a Goal.
5. About to change code for something that is not the current Task? Call start_detour with the reason first; afterwards end_detour ("merge back", "return" or "recalibrate").
6. When every Task is done, released or dropped and the Outcome is true, call complete_goal once (with hand_tests, and next to claim the next Goal) and tell the Developer in one sentence.
7. Talk to the Developer in everyday words: say "step" for Task and "side trip" for Detour, and leave out tool names, IDs and the files in .progressor/. Give them the dashboard link from get_status at the start and when a Goal is finished.
8. A lasting rule ("always...", "never...") is saved with save_standing_instruction (with its id: change or remove); one that must never be broken ("never", "hard rule") with hard: true; one for all their projects ("in all my projects") with global: true. update_context keeps the project's Important context page; save_decision records a choice only if it would surprise a later session (small technical choices go in the commit message); save_note records something that belongs to a Goal instead of fixing it now.
9. Anything only the Developer can try by hand goes in a hand test (hand_tests on update_tasks or complete_goal, or save_hand_test), not in your chat summary. Show a screenshot with attach_picture.
10. The Developer can write to you on the dashboard: their messages and answers arrive at the end of your next Progressor reply under "New from the Developer". Act on each one and answer with reply_to_developer (whole_project: true for the whole project). For a product or UX choice, use ask_developer with 2 to 4 short choices instead of stopping in the chat.
11. When you brief a helper agent, paste in get_status with for_helper: true (worktree helpers get it by themselves). Before using something only one can use at a time (a dev window, a port), claim it with resource; release it there.
12. Work that belongs to another project using Progressor goes in that project's plan: pass project (its name on the dashboard) to get_status, add_goal and the other tools that take it.
13. A * line in .progressor/.gitignore keeps the plan out of git; delete it to keep it in git.`;

const resourceName = z.string().max(80).describe("The shared thing's name, such as 'dev-window' or 'plasmashell'. Case and spaces do not matter.");
const resourceLabel = z
  .string()
  .max(100)
  .optional()
  .describe("Who it is held for when that is not this Session itself, such as 'helper: media run'. Claim and release a helper's lock with the same label.");

const estimateText = z
  .string()
  .describe("How long it should take, such as '45m', '2h' or '1h 30m'; an empty string removes the estimate.");

/** Minutes in an estimate given to a tool; null for an empty one (which removes it), undefined when left out. */
function readEstimate(text: string | undefined): number | null | undefined {
  if (text === undefined) return undefined;
  if (!text.trim()) return null;
  const minutes = parseDuration(text);
  if (minutes === undefined || minutes <= 0) throw new Error(`"${text}" is not an estimate; write it like "45m", "2h" or "1h 30m".`);
  return minutes;
}

/** Tasks given to a tool, with their estimates read. */
function newTasks(tasks: { title: string; summary?: string; code?: string[]; done?: boolean; estimate?: string }[] | undefined): NewTask[] {
  return (tasks ?? []).map(({ estimate, ...t }) => {
    const minutes = readEstimate(estimate);
    return minutes ? { ...t, estimate: minutes } : t;
  });
}

const taskInput = z.object({
  title: z.string().trim().min(1).describe("A short title for the Task, a few words, such as 'Fix callback redirect loop'."),
  summary: z
    .string()
    .optional()
    .describe("One or two sentences on the fix or change the Task makes, such as 'Callback re-sets the session cookie on every hit; only set it after token exchange.'"),
  code: z.array(z.string()).optional().describe("Files the Task touches, optionally with :line."),
  estimate: z.string().optional().describe("How long it should take, such as '45m', '2h' or '1h 30m'. Give one for every Task you plan; the dashboard's schedule is built from them."),
});

/** A Task being added, which may already be done when past work is recorded. */
const newTaskInput = taskInput.extend({
  done: z.boolean().optional().describe("Add the Task already done, for work finished before it was recorded."),
});

const handTestsInput = z.array(z.string()).optional().describe("Things only the Developer can try by hand, each saved as save_hand_test would (about this Task).");
const decisionsInput = z.array(z.string()).optional().describe("Choices that would surprise a later session, each saved as save_decision would (on this Goal).");
/** The non-empty texts of a list, or an error naming what is empty: checked before anything is changed. */
function filled(texts: string[] | undefined, what: string): string[] {
  const list = texts ?? [];
  if (list.some((t) => !t.trim())) throw new Error(`Say what each ${what} is; one was empty.`);
  return list;
}

/** A Task added to a claimed Goal, which can bring the hand test for it along. */
const addTaskInput = newTaskInput.extend({
  hand_tests: handTestsInput,
  hand_test: z
    .string()
    .optional()
    .describe("Something only the Developer can try by hand for this Task; added as a hand test about it, as with save_hand_test."),
});

const goalId = z.string().describe("The Goal ID, such as 'ship-oauth-login'.");
/** Another project's plan to act on instead of this one's. */
const otherProject = z
  .string()
  .optional()
  .describe(
    "Another project's plan to use instead of this one's: its name or ID on the dashboard, or its folder's full path. Changes there are marked as made from this project. Leave out for this project.",
  );
/** The claimed Goal a tool acts on; only needed while the Session holds several. */
const heldGoal = z
  .string()
  .optional()
  .describe("The claimed Goal's ID, such as 'ship-oauth-login'. Needed only when this Session holds several Goals.");
const helperBranch = z.string().max(200).optional().describe("With state 'with a helper': the git branch the helper works on, such as 'feat/export'. Not needed when the branch name holds the step's ID (t3-export): the step follows that branch by itself.");
const helperFolder = z.string().max(500).optional().describe("With state 'with a helper': the helper's worktree folder (its path).");
const helperLabel = z.string().max(100).optional().describe("With state 'with a helper': a label for the helper, such as the model it runs on ('Sonnet').");
const evidence = z
  .string()
  .max(300)
  .optional()
  .describe("With state 'checked': one short line on what you checked, such as '715 passed, live send OK'. Give it: the Developer sees it on the dashboard step.");
const taskId = z.string().describe("The Task ID, such as 't3'.");
const states = ["pending", "in progress", "with a helper", "waiting on you", "waiting on someone", "checked", "done", "released"] as const satisfies readonly TaskStatus[];
/** Who a step waits on, and what they need to do, with the state 'waiting on someone'. */
const personInput = z.string().optional().describe("With state 'waiting on someone': who it waits on, by name (or ID, such as 'p2'), such as 'Priya', 'Stripe support' or 'CI' (for a CI run); how long steps wait on each is kept and shown. Someone new is added to the project's people.");
const needInput = z.string().optional().describe("With state 'waiting on someone': what they need to do, in one line, such as 'Sign and send back the contract'.");
const helpersAtOnce = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe(
    "Makes this rule the helper limit (in every project, with global): the most helper chats at work at once, such as 1 when the Developer says 'one helper at a time'. Progressor counts the chats running in the project. 0 removes it.",
  );
const hardFlag = z
  .boolean()
  .optional()
  .describe("true for a rule that must never be broken (not just a preference); get_status and the session start list those first as HARD RULE.");
const globalFlag = z
  .boolean()
  .optional()
  .describe("true for a rule for everything: the Developer says it holds in all their projects ('in all my projects...'). Saved once for this computer; shown wherever Progressor runs.");
const outcome = z
  .string()
  .describe("What done looks like, in one sentence, such as 'Users can sign in with Google and stay signed in for 30 days'.");

/** The locks held now, for get_status; nothing when none is. */
export function resourceLines(locks: ResourceLock[], now: Date): string[] {
  return locks.length > 0
    ? ["In use now (claim with resource before using one, release after):", ...locks.map((l) => `- ${resourceLine(l, now)}`)]
    : [];
}

/** A Goal's status as the Agent reads it in a list. */
const statusText = (g: Goal) => (g.status === "testing" ? "built, waiting on the Developer's hand tests" : g.status);

function goalLine(g: Goal, waits?: string): string {
  return `- ${g.id}: ${g.hotfix ? "HOTFIX " : ""}${g.title} (${statusText(g)}${waits ? `; ${waits}` : ""})`;
}

/** A held hotfix's bug report, quoted, so the Agent fixes what was reported. */
const reportLines = (s: Status) => (s.goal?.hotfix && s.report ? ["Bug report:", ...s.report.split("\n").map((l) => `> ${l}`)] : []);

/** The hotfix line first, while one waits and this Session is not already fixing a hotfix. */
function hotfixFirst(session: SessionStatus): string[] {
  if (session.held.some((s) => s.goal?.hotfix)) return [];
  const line = hotfixLine(session.goals);
  return line ? [line] : [];
}

function taskLine(t: Task): string {
  return `${t.id} ${t.title}`;
}

const summaryLine = (t: Task | undefined) => (t?.summary ? [`  Summary: ${t.summary}`] : []);
const noteText = (n: Note) => `${n.id} ${n.text}${n.from ? ` (from ${n.from})` : ""}`;
const decisionText = (d: Decision) => `${d.id} ${d.text}`;

/** A Task's helper info, as "Sonnet, branch feat/x, folder /w/x"; empty when there is none. */
function helperText(t: Task): string {
  const h = t.helper;
  return h ? [h.label, h.branch && `branch ${h.branch}`, h.folder && `folder ${h.folder}`].filter(Boolean).join(", ") : "";
}

/** A Task in a list with what it carries: "t1 Route (Sonnet, branch feat/x)" or, once checked, with its evidence. */
function carryingLine(t: Task): string {
  const extra = [t.status === "checked" && t.evidence ? `evidence: ${t.evidence}` : "", helperText(t)].filter(Boolean).join("; ");
  return extra ? `${taskLine(t)} (${extra})` : taskLine(t);
}

/** The Tasks in other hands than the Agent's: a helper's, or the Developer's. */
function elsewhereLines(s: Status): string[] {
  const line = (label: string, tasks: Task[]) => (tasks.length > 0 ? [`${label}: ${tasks.map(carryingLine).join("; ")}`] : []);
  return [
    ...line("With a helper", s.withHelper),
    ...line("Waiting on the Developer", s.waitingOnYou),
    ...line("Checked, not yet released", s.checked),
    ...(s.waited ? [s.waited] : []),
  ];
}

const elsewhere = (s: Status) => [
  ...s.withHelper.map((t) => [t, "with a helper"] as const),
  ...s.waitingOnYou.map((t) => [t, "waiting on you"] as const),
  ...s.checked.map((t) => [t, "checked"] as const),
];

const nextLine = (s: Status) =>
  s.nextTask
    ? `Next Task: ${taskLine(s.nextTask)}`
    : elsewhere(s).length > 0
      ? "Next Task: none pending"
      : "Next Task: none; every Task is done or dropped";

/** One line on where the work stands, for the end of results that don't show the whole status. */
export function nowLine(session: SessionStatus): string {
  const [hotfix] = hotfixFirst(session);
  const now = plainNowLine(session);
  return hotfix ? `${hotfix}\n${now}` : now;
}

function plainNowLine(session: SessionStatus): string {
  const { held } = session;
  if (held.length === 0) return "Now: no Goal claimed; call get_status.";
  if (held.length > 1) return `Now: ${held.map((s) => `${s.goal!.id}: ${goalNow(s)}`).join(" · ")}`;
  const s = held[0]!;
  const next = s.currentTask ?? s.nextTask;
  if (s.openDetour) return `Now: side trip "${s.openDetour.title}" (end it with end_detour) · then ${next ? taskLine(next) : "complete_goal"}`;
  if (s.currentTask) return `Now: ${taskLine(s.currentTask)} · Next: ${s.nextTask ? taskLine(s.nextTask) : "complete_goal"}`;
  if (s.nextTask)
    return `Now: no Task in progress · Next: ${taskLine(s.nextTask)} (start it with update_tasks, or complete it there if it is already built)`;
  const waiting = elsewhere(s);
  return waiting.length > 0
    ? `Now: no Task in progress · Waiting: ${waiting.map(([t, state]) => `${taskLine(t)} (${state})`).join(", ")}`
    : "Now: every Task is done or dropped · Next: complete_goal";
}

/** A few words on where one of several Goals stands. */
function goalNow(s: Status): string {
  if (s.openDetour) return `side trip "${s.openDetour.title}"`;
  if (s.currentTask) return taskLine(s.currentTask);
  if (s.nextTask) return `next ${taskLine(s.nextTask)}`;
  const waiting = elsewhere(s);
  return waiting.length > 0 ? `waiting (${waiting.map(([t, state]) => `${t.id} ${state}`).join(", ")})` : "complete_goal";
}

/** One of several Goals, in a few lines: what get_status shows for one Goal, minus the summaries. */
function heldGoalLines(s: Status): string[] {
  const g = s.goal!;
  const d = s.openDetour;
  return [
    `${g.hotfix ? "HOTFIX" : "Goal"} ${g.id}: ${g.title} (${g.ref}), ${s.done} of ${s.total} Tasks done${s.waitingOnYou.length > 0 ? ", waiting on the Developer" : ""}`,
    ...[
      ...(g.outcome ? [`Outcome: ${g.outcome}`] : []),
      ...reportLines(s),
      s.currentTask ? `Current Task: ${taskLine(s.currentTask)} (${s.planFile}:${s.currentTask.line})` : "Current Task: none",
      ...(d ? [`Open Detour: ${d.id} ${d.title}. Reason: ${d.reason ?? "none given"}`] : []),
      ...elsewhereLines(s),
      nextLine(s),
      ...(s.decisions.length > 0 ? [`Decisions: ${s.decisions.map(decisionText).join("; ")}`] : []),
      ...(s.notes.length > 0 ? [`Notes: ${s.notes.map(noteText).join("; ")}`] : []),
      ...handTestLines(s.handTests),
      ...talkLines(s),
    ].map((line) => `  ${line}`),
  ];
}

/** A Goal's expected finish, for the Agent: "login done in about 3 h (2 Tasks not estimated)". */
function finishText(g: GoalSchedule, name: string): string {
  const unknown = g.unknown > 0 ? `${g.unknown} ${g.unknown === 1 ? "Task" : "Tasks"} not estimated` : "";
  if (g.left === 0) return unknown ? `${name}: ${unknown}` : `${name}: no work left`;
  return `${name} done in about ${roughDuration(g.finish)}${unknown ? ` (${unknown})` : ""}`;
}

/**
 * The helper limit and the schedule in two short lines for get_status, about the Goals this Session
 * holds; nothing when the project has no limit and no estimates.
 */
export function scheduleLines(schedule: Schedule, held: string[]): string[] {
  const lines: string[] = [];
  if (schedule.limit !== undefined)
    lines.push(
      `Helper limit: at most ${schedule.limit} Tasks with a helper at once; ${schedule.helpers} now${schedule.helpers > schedule.limit ? ", over the limit: hand out no more until some come back" : ""}.`,
    );
  if (!schedule.estimated) return lines;
  const next = schedule.next[0];
  const goals = schedule.goals.filter((g) => held.includes(g.id));
  const all = { ...schedule, id: "", title: "", left: schedule.goals.reduce((n, g) => n + g.left, 0), estimate: undefined, estimateSet: false, adjusted: false };
  const parts = [
    ...(next ? [`next ${next.goal}${next.id ? `/${next.id} ${next.title}` : ""}`] : []),
    ...goals.map((g) => finishText(g, g.id)),
    ...(schedule.goals.length > goals.length || goals.length > 1 ? [finishText(all, "Roadmap")] : []),
  ];
  if (parts.length > 0) lines.push(`Schedule: ${parts.join(" · ")}.`);
  return lines;
}

/** The Goals to pick from, with the finished and cancelled ones only counted. */
function goalListLines(goals: Goal[], waits?: Map<string, string>): string[] {
  if (goals.length === 0) return ["The Roadmap has no Goals yet."];
  const open = goals.filter((g) => g.status !== "done" && g.status !== "dropped");
  const finished = goals.filter((g) => g.status === "done").length;
  const cancelled = goals.filter((g) => g.status === "dropped").length;
  const noun = (n: number) => (n === 1 ? "goal" : "goals");
  return [
    ...(open.length > 0 ? ["Goals:", ...open.map((g) => goalLine(g, waits?.get(g.id)))] : []),
    ...(finished > 0 ? [`Finished: ${finished} ${noun(finished)} (not listed; get_item progressor://<goal> to look one up).`] : []),
    ...(cancelled > 0 ? [`Cancelled: ${cancelled} ${noun(cancelled)} (not listed).`] : []),
  ];
}

/** The Developer's wishlist: the open wishes, with the granted ones only counted. */
function wishlistLines(wishes: Wish[]): string[] {
  if (wishes.length === 0) return [];
  const open = wishes.filter((w) => !w.granted);
  const granted = wishes.length - open.length;
  return [
    "The Developer's wishlist (theirs to change: suggest goals from it when one fits, never edit it):",
    ...open.flatMap((w) => [
      `- ${w.id} ${w.text}`,
      ...(w.attachments?.length ? [`  Files (open one by its path only if you need it): ${w.attachments.map((a) => a.path).join(", ")}`] : []),
    ]),
    ...(granted > 0 ? [`Granted: ${granted} ${granted === 1 ? "wish" : "wishes"} (not listed).`] : []),
  ];
}

/** One short line when estimates have run more than 20% off, for the AI to allow for; undefined otherwise. */
export function estimateLine(c: { factor: number | undefined; samples: number } | undefined): string | undefined {
  if (!c || c.factor === undefined || Math.abs(c.factor - 1) <= 0.2) return undefined;
  // The factor is time spent over estimate: below 1, steps take less time than estimated.
  const f = c.factor;
  if (f > 1) return `Steps here have taken about ${Number(f.toFixed(1))}× as long as estimated (last ${c.samples} steps); estimate longer.`;
  const how = f <= 0.55 ? "half" : `${f.toFixed(1)}×`;
  return `Steps here have taken about ${how} as long as estimated (last ${c.samples} steps); estimate shorter.`;
}

/** The rules, Important context and wishlist a status ends with: those for everything first, then this project's own. */
export function instructionLines(session: SessionStatus, global?: GlobalNotes): string[] {
  const rules = notEverywhere(hardFirst(session.standingInstructions), global);
  const instructions = [
    ...globalStatusLines(global),
    ...(rules.length > 0
      ? [rules.some((r) => r.hard) ? "Standing Instructions (a HARD RULE must never be broken):" : "Standing Instructions:", ...rules.map((r) => `- ${ruleText(r)}`)]
      : []),
  ];
  if (session.context) instructions.push("Important context:", session.context);
  instructions.push(...wishlistLines(session.wishes));
  return instructions;
}

/** Said instead of the rules, context and wishlist when this chat was already sent them unchanged. */
export const INSTRUCTIONS_UNCHANGED =
  "Standing Instructions, Important context and wishlist: unchanged since this chat last saw them (get_status shows them in full).";

export function formatStatus(
  session: SessionStatus,
  schedule?: Schedule,
  warnings: string[] = [],
  waits?: Map<string, string>,
  global?: GlobalNotes,
  shownInstructions?: string[],
): string {
  const instructions = shownInstructions ?? instructionLines(session, global);
  const timing = [...(schedule ? scheduleLines(schedule, session.held.map((s) => s.goal!.id)) : []), ...warnings];
  const hotfix = hotfixFirst(session);
  if (session.held.length > 1)
    return [
      ...hotfix,
      `This Session holds ${session.held.length} Goals; pass goal (the Goal ID) to the tools that change one.`,
      ...session.held.flatMap(heldGoalLines),
      ...timing,
      ...instructions,
    ].join("\n");
  const s = session.held[0];
  if (!s?.goal) {
    const paused = session.goals.filter((g) => g.status === "paused");
    return [
      ...hotfix,
      paused.length === 1
        ? `No Goal is claimed by this Session. Goal ${paused[0]!.id} ("${paused[0]!.title}") is paused: claim it with claim_goal and carry on.`
        : "No Goal is claimed by this Session. Claim one with claim_goal, or plan one and add it with add_goal (claim: true).",
      ...goalListLines(session.goals, waits),
      ...timing,
      ...instructions,
    ].join("\n");
  }
  const d = s.openDetour;
  return [
    ...hotfix,
    `${s.goal.hotfix ? "HOTFIX" : "Goal"}: ${s.goal.title} (${s.goal.ref}), claimed by this Session`,
    ...reportLines(s),
    ...(s.goal.outcome ? [`Outcome: ${s.goal.outcome}`] : []),
    `Plan File: ${s.planFile}`,
    `Progress: ${s.done} of ${s.total} Tasks done`,
    s.currentTask
      ? `Current Task: ${taskLine(s.currentTask)} (${s.planFile}:${s.currentTask.line})`
      : "Current Task: none (start one with update_tasks)",
    ...summaryLine(s.currentTask),
    ...(d
      ? [`Open Detour: ${d.id} ${d.title}${d.branchedFrom ? `, branched from ${d.branchedFrom}` : ""}. Reason: ${d.reason ?? "none given"}`]
      : []),
    ...elsewhereLines(s),
    nextLine(s),
    ...summaryLine(s.nextTask),
    ...(s.decisions.length > 0 ? ["Decisions:", ...s.decisions.map((x) => `- ${decisionText(x)}`)] : []),
    ...(s.notes.length > 0 ? ["Notes:", ...s.notes.map((n) => `- ${noteText(n)}`)] : []),
    ...handTestLines(s.handTests),
    ...talkLines(s),
    ...timing,
    ...instructions,
  ].join("\n");
}


/** A Goal's estimate and expected finish: "Estimate: 4 h from its open Tasks (2 not estimated); done in about 3 h". */
function goalTime(g: Goal, s: GoalSchedule | undefined): string[] {
  if (!s) return g.estimate !== undefined ? [`Estimate: ${sayDuration(g.estimate)} (set on the Goal)`] : [];
  if (s.estimate === undefined && s.unknown === 0) return [];
  const estimate = s.estimate === undefined ? "none" : `${sayDuration(s.estimate)} ${s.estimateSet ? "(set on the Goal)" : "from its open Tasks"}`;
  return [
    `Estimate: ${estimate}${s.unknown > 0 ? `; ${s.unknown} open ${s.unknown === 1 ? "Task has" : "Tasks have"} none` : ""}`,
    ...(s.left > 0
      ? [`Expected done in about ${roughDuration(s.finish)}${s.unknown > 0 ? ", not counting the Tasks without an estimate" : ""}`]
      : []),
  ];
}

const limitText = (s: StandingInstruction) => (s.helpersAtOnce ? ` (the helper limit: at most ${s.helpersAtOnce} Tasks with a helper at once)` : "");

/**
 * The warning after a Task was handed to a helper while the project's helper limit is passed. The
 * change is made all the same: the Agent may have a reason.
 */
export function helperWarning(p: Pick<Project, "helperLoad">, options: Parameters<Project["helperLoad"]>[0] = {}): string[] {
  const { busy, limit, rule, chats } = p.helperLoad(options);
  if (limit === undefined || busy <= limit) return [];
  return [
    `Warning: ${busy} helpers are at work${chats ? ` (${chats} chats in this project)` : ""}, over the helper limit of ${limit} at once (${rule!.id}: "${rule!.text}"). ` +
      "The change is made. Unless you have a good reason, wait for a helper to come back before handing out another, and say why if you keep going.",
  ];
}

function formatDetour(d: Detour): string {
  return `Detour ${d.id}: ${d.title} (${d.status})${d.branchedFrom ? `, branched from ${d.branchedFrom}` : ""}. Reason: ${d.reason ?? "none given"}`;
}

/** A Task's estimate against its time spent, for calibrating: "Time: took 1 h 10 m, estimated 45 m". */
function timeLine(t: Task, now: Date): string[] {
  const text = timeText({ estimate: t.estimate, spent: timeSpent(t, now), running: TIMED.includes(t.status) && !!t.timingSince });
  return text ? [`Time: ${text}`] : [];
}

/** The time of Tasks just completed, for calibrating the next estimates; empty when none has any. */
function tookLine(tasks: Task[], now: Date): string[] {
  const timed = tasks.filter((t) => t.spent > 0 && (t.status === "done" || t.status === "released"));
  return timed.length > 0 ? [`Time: ${timed.map((t) => `${t.id} ${timeText({ estimate: t.estimate, spent: t.spent, running: false })}`).join("; ")}.`] : [];
}

export function formatItem(found: FoundItem, schedule?: Schedule, now = new Date()): string {
  const where = `${found.file}:${found.line}`;
  switch (found.kind) {
    case "goal": {
      const g = found.item;
      return [
        `Goal ${g.id}: ${g.title} (${statusText(g)})`,
        ...(g.outcome ? [`Outcome: ${g.outcome}`] : []),
        ...(g.reason ? [`Reason: ${g.reason}`] : []),
        `Ref: ${g.ref}`,
        `Roadmap line: ${where}`,
        `Plan File: ${found.planFile}`,
        ...(g.claim ? [`Claimed by: Session ${g.claim.session}${g.claim.since ? ` since ${g.claim.since}` : ""}`] : []),
        ...goalTime(g, schedule?.goals.find((x) => x.id === g.id)),
        ...[waitLine(waitTotals(found.tasks, now))].filter((l): l is string => !!l),
        ...goalTaskLines(found.tasks),
      ].join("\n");
    }
    case "task": {
      const t = found.item;
      return [
        `Task ${t.id}: ${t.title} (${t.status})`,
        `Ref: ${found.ref}`,
        `Plan File: ${where}`,
        ...(t.summary ? [`Summary: ${t.summary}`] : []),
        ...(t.code.length > 0 ? [`Code: ${t.code.join(", ")}`] : []),
        ...(t.movedFrom ? [`Moved from: ${t.movedFrom}`] : []),
        ...(t.addedBy ? [`Added by Detour ${t.addedBy}`] : []),
        ...(t.droppedBy ? [`Dropped by Detour ${t.droppedBy}`] : []),
        ...(t.reason ? [`Reason: ${t.reason}`] : []),
        ...(t.helper ? [`Helper: ${helperText(t)}`] : []),
        ...(t.evidence ? [`Evidence: ${t.evidence}`] : []),
        ...(stepWaits(t, now).length > 0 ? ["Waits:", ...stepWaits(t, now).map((w) => `- ${stepWaitLine(w)} (since ${w.at})`)] : []),
        ...(found.reports.length > 0 ? ["Reports:", ...found.reports.map((r) => `- ${r.id} ${r.title} (${r.written}, ${sayBytes(r.bytes)}): progressor://${r.goal}/${r.id}`)] : []),
        ...timeLine(t, now),
      ].join("\n");
    }
    case "report": {
      const r = found.item;
      return [`Report ${r.id}: ${r.title} (step ${r.task}, written ${r.written}${r.session ? ` by ${r.session}` : ""})`, `Ref: ${found.ref}`, `File: ${found.file}`, "", found.text.trim()].join("\n");
    }
    case "detour":
      return [formatDetour(found.item), `Ref: ${found.ref}`, `Plan File: ${where}`].join("\n");
    case "decision":
      return [`Decision ${found.item.id}: ${found.item.text}`, `Ref: ${found.ref}`, `Plan File: ${where}`].join("\n");
    case "note": {
      const n = found.item;
      return [
        `Note ${n.id}: ${n.text} (${n.resolved ? "resolved" : "open"})`,
        `Ref: ${found.ref}`,
        `Plan File: ${where}`,
        ...(n.from ? [`Spotted while working on: ${n.from}`] : []),
      ].join("\n");
    }
    case "hand test": {
      const h = found.item;
      return [
        `Hand test ${h.id}: ${h.text} (${handTestWord[h.result]})`,
        `Ref: ${found.ref}`,
        `Plan File: ${where}`,
        ...(h.task ? [`About Task: ${h.task}`] : []),
        ...(h.note ? [`Developer's note: ${h.note}`] : []),
        ...(h.taskAdded ? [`Failure added Task: ${h.taskAdded}`] : []),
      ].join("\n");
    }
    case "idea": {
      const i = found.item;
      return [
        `Idea ${i.id}: ${i.title}`,
        `Ref: ${found.ref}`,
        `Roadmap line: ${where}`,
        ...i.notes.map((n) => `Note: ${n}`),
        ...(i.promotedTo ? [`Promoted to: ${i.promotedTo}`] : []),
      ].join("\n");
    }
    case "standing instruction":
      return [`${found.item.hard ? "HARD RULE" : "Standing Instruction"} ${found.item.id}: ${found.item.text}`, `Ref: ${found.ref}`, `Roadmap line: ${where}`].join(
        "\n",
      );
  }
}

/** "812 B" or "14 KB". */
const sayBytes = (n: number) => (n < 1024 ? `${n} B` : `${Math.ceil(n / 1024)} KB`);

/** A Goal's Tasks for get_item: the open ones with their summaries, then the finished and dropped ones by name. */
function goalTaskLines(tasks: Task[]): string[] {
  const done = tasks.filter((t) => t.status === "done");
  const dropped = tasks.filter((t) => t.status === "dropped");
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "dropped");
  if (tasks.length === 0) return ["Tasks: none yet."];
  return [
    `Tasks (${done.length} of ${done.length + open.length} done):`,
    ...open.map((t) => `- ${taskLine(t)} (${t.status})${t.summary ? `: ${t.summary}` : ""}`),
    ...(done.length > 0 ? [`Done: ${done.map(taskLine).join("; ")}`] : []),
    ...(dropped.length > 0 ? [`Dropped: ${dropped.map(taskLine).join("; ")}`] : []),
  ];
}

/** The helper info a state change was given, or nothing when none was. */
function helperOf(branch?: string, folder?: string, label?: string): HelperInfo | undefined {
  const h: HelperInfo = { ...(branch?.trim() ? { branch } : {}), ...(folder?.trim() ? { folder } : {}), ...(label?.trim() ? { label } : {}) };
  return Object.keys(h).length > 0 ? h : undefined;
}

/** One correct call per tool, added to the SDK's answer when a call has the wrong shape, so the next try is right. */
export const TOOL_EXAMPLES: Record<string, string> = {
  get_status: "get_status({})",
  get_item: 'get_item({ ref: "progressor://login/t2" })',
  add_hotfix: 'add_hotfix({ report: "Checkout fails with a 500 when the cart has a coupon" })',
  add_goal: 'add_goal({ title: "Ship login", outcome: "Users can sign in", tasks: [{ title: "Add form", estimate: "45m" }], claim: true })',
  update_goal: 'update_goal({ goal: "login", outcome: "Users can sign in with Google" })',
  move_goal: 'move_goal({ goal: "login", before: "billing" })',
  drop_goal: 'drop_goal({ goal: "login", reason: "Not needed any more" })',
  claim_goal: 'claim_goal({ goal: "login" })',
  resource: 'resource({ action: "claim", resource: "dev-window", reason: "running the UI test" })',
  release_goal: "release_goal({})",
  complete_goal: "complete_goal({})",
  add_tasks: 'add_tasks({ tasks: [{ title: "Fix typo", done: true, code: ["src/a.ts"], hand_test: "Check the button text" }] })',
  launch_readiness: "launch_readiness()",
  save_risk: 'save_risk({ title: "Windows paths break setup", likelihood: "medium", impact: "high", mitigation: "Test setup on Windows in CI", goals: ["tests-ci-deps"] })',
  add_small_fix: 'add_small_fix({ title: "Faster dev server start", summary: "Skip the type check on start.", code: ["vite.config.ts"] })',
  set_task_state: 'set_task_state({ task: "t2", state: "checked", evidence: "715 passed" })',
  update_tasks: 'update_tasks({ operations: [{ action: "complete", task: "t2" }, { action: "start", task: "t3" }] })',
  move_task: 'move_task({ task: "t2", to_goal: "billing" })',
  update_task: 'update_task({ task: "t2", estimate: "2h" })',
  start_detour: 'start_detour({ title: "Fix flaky test", reason: "It blocks the build" })',
  end_detour: 'end_detour({ ending: "merge back" })',
  save_decision: 'save_decision({ text: "Keep the old API for a release" })',
  save_note: 'save_note({ goal: "login", text: "The logout link is broken" })',
  ask_developer: 'ask_developer({ question: "Dark mode by default?", choices: ["Yes", "Follow the computer"] })',
  reply_to_developer: 'reply_to_developer({ message: "m2", reply: "Done: the button is bigger now." })',
  save_hand_test: 'save_hand_test({ text: "Open the login page and sign in", task: "t2" })',
  attach_picture: 'attach_picture({ path: "shot.png", caption: "The new login page" })',
  attach_report: 'attach_report({ goal: "login", task: "t2", title: "Test run", text: "715 passed" })',
  save_standing_instruction: 'save_standing_instruction({ text: "Ask me before changing the plan" })',
  update_context: 'update_context({ text: "What the project is, in a few lines" })',
  plan_history: 'plan_history({ restore: "20261107T101500123Z-1" })',
  handoff: 'handoff({ since: "2026-11-01", title: "Week of 2 November", text: "# Week of 2 November ..." })',
};

/**
 * Adds the fields a tool takes and its example to the SDK's answer to arguments of the wrong shape,
 * which otherwise names only the field that failed. The SDK builds every such answer in its createToolError.
 */
function withExamples(server: McpServer): void {
  const sdk = server as unknown as {
    createToolError?: (message: string) => { content: { type: "text"; text: string }[]; isError: true };
    _registeredTools?: Record<string, { inputSchema?: { shape?: Record<string, { isOptional?: () => boolean }> } }>;
  };
  const original = sdk.createToolError?.bind(server);
  if (!original) return;
  sdk.createToolError = (message) => {
    const name = /Invalid arguments for tool (\w+)/.exec(message)?.[1] ?? "";
    const shape = sdk._registeredTools?.[name]?.inputSchema?.shape ?? {};
    const required = Object.keys(shape).filter((f) => !shape[f]!.isOptional?.());
    const optional = Object.keys(shape).filter((f) => shape[f]!.isOptional?.());
    const fields = [...required.map((f) => `${f} (required)`), ...optional];
    const example = TOOL_EXAMPLES[name];
    const thisPlanOnly =
      /unrecognized key/i.test(message) && /"project"/.test(message) && !("project" in shape)
        ? [`${name} only works on this project's plan, so nothing was changed. To change another project's plan, use a tool that takes project.`]
        : [];
    return original(
      [message, ...thisPlanOnly, ...(fields.length > 0 ? [`${name} takes: ${fields.join(", ")}.`] : []), ...(example ? [`A correct call: ${example}`] : [])].join("\n"),
    );
  };
}

/**
 * A tool's fields as a strict object: a field it doesn't take (a typo such as goall, or project on a
 * tool that only works on this plan) is refused instead of quietly dropped while the change goes ahead.
 */
function strictInput(config: unknown): unknown {
  const c = config as { inputSchema?: unknown };
  if (!c?.inputSchema || c.inputSchema instanceof z.ZodType) return config;
  return { ...c, inputSchema: z.strictObject(c.inputSchema as z.ZodRawShape) };
}

/** Runs a tool body, turning thrown domain errors into MCP tool errors the Agent can read. */
function respond(body: () => string) {
  try {
    return { content: [{ type: "text" as const, text: body() }] };
  } catch (e) {
    return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
  }
}

export interface ServerOptions {
  /** The dashboard, so get_status can say where the Developer can open it; its url may come later. */
  dashboard?: { readonly url: string | undefined; readonly notice?: string | undefined; refresh(): Promise<void> };
  /** The project registry, for finding other projects; `~/.progressor/projects.json` unless set. */
  registryFile?: string;
  /** The settings for how Progressor works (settings.ts); `settings.json` next to the registry unless set. */
  settingsFile?: string;
  /** Where Claude Code keeps the user's settings (`.claude/settings.json` in it), for the hooks check; the home folder unless set. */
  claudeHome?: string;
  /** Where the answer to "is a newer Progressor out?" is kept (updateCheck.ts); beside the registry unless set, and not used under the tests unless set. */
  updateFile?: string;
  /** The running Progressor processes (servers.ts), for the chats in this project; read from `servers/` beside the registry unless set. */
  servers?: () => ServerRecord[];
  /** How pull requests are asked for (ci.ts), so steps follow them; the real commands and network unless set, and not used under the tests unless set. */
  ci?: CiDeps;
}

/** Whether the app is Claude Code, the one app with hooks; it names itself "claude-code". */
const isClaudeCode = (server: McpServer) => /^claude[- ]?code/i.test(server.server.getClientVersion()?.name ?? "");

/** Another project's plan, as get_status shows it when given project: read-only, for changing it from here. */
export function formatOtherProject(other: Project, name: string): string {
  const roadmap = other.roadmap();
  const lines = roadmap.goals.map((g) => {
    if (other.heldElsewhere(g)) return `- ${g.id}: ${g.title} (${g.status}; an AI chat in that project is working on it, so only save_note can change it)`;
    if (g.status === "done" || g.status === "dropped") return goalLine(g);
    let tasks: Task[] = [];
    try {
      tasks = other.plan(g.id).tasks.filter((t) => t.status !== "dropped");
    } catch {
      // a Goal whose Plan File cannot be read still shows
    }
    return [goalLine(g), ...(tasks.length > 0 ? [`  Tasks: ${tasks.map((t) => `${taskLine(t)} (${t.status})`).join("; ")}`] : [])].join("\n");
  });
  const rules = hardFirst(roadmap.standingInstructions);
  return [
    `Project ${name} (${other.root}): another project's plan, seen from ${other.from}. Changes you make to it are marked as made from ${other.from}.`,
    ...(lines.length > 0 ? ["Goals:", ...lines] : ["Its Roadmap has no Goals yet."]),
    ...(rules.length > 0 ? ["Its Standing Instructions (they apply to work on it):", ...rules.map((r) => `- ${ruleText(r)}`)] : []),
  ].join("\n");
}

/**
 * The folders the app has open, as MCP root URIs, or undefined when it does not report any (or
 * takes longer than `timeoutMs`). Call it once the app has connected.
 */
export async function appRoots(server: McpServer, timeoutMs: number): Promise<string[] | undefined> {
  if (!server.server.getClientCapabilities()?.roots) return undefined;
  try {
    const { roots } = await server.server.listRoots(undefined, { timeout: timeoutMs });
    return roots.map((r) => r.uri);
  } catch {
    return undefined;
  }
}

/**
 * The instructions an app gets when it connects: INSTRUCTIONS, then the rules and context for
 * everything (globalRules.ts), so they hold wherever Progressor runs, even in a folder with no plan.
 */
export function serverInstructions(global: GlobalNotes): string {
  const extra = globalInstructions(global);
  return extra ? `${INSTRUCTIONS}\n\n${extra}` : INSTRUCTIONS;
}

export function createServer(project: Project, options: ServerOptions = {}): McpServer {
  // The rules and context for everything (globalRules.ts), beside the project list.
  const globalFile = globalFileFor(options.registryFile ?? defaultRegistryFile());
  const server = new McpServer({ name: "progressor", version: BUILD.version }, { instructions: serverInstructions(readGlobal(globalFile)) });
  withExamples(server);
  // Steps follow pull requests (stepSync.ts): the kept answers beside the project list, as the dashboard keeps them.
  const ciDeps = options.ci ?? (process.env.VITEST ? undefined : realCiDeps());
  if (ciDeps) {
    const registry = options.registryFile ?? defaultRegistryFile();
    const settings = options.settingsFile ?? settingsFileFor(registry);
    project.followPullRequests({
      cacheFile: () => ciCacheFile(registry, project.root),
      deps: ciDeps,
      on: () => {
        try {
          return readSettings(settings, project.root).ci.enabled;
        } catch {
          return true;
        }
      },
    });
  }
  const servers = options.servers ?? (() => listServers(defaultServersDir(options.registryFile ?? defaultRegistryFile())));
  /** What the helper limit is counted against: the chats here (this project only) and the rules for everything. */
  const helperContext = (p: Project) => ({ ...(p === project ? { chats: chatsHere() } : {}), global: readGlobal(globalFile).rules });
  /** The chats running in this project now, this one included. */
  const chatsHere = () => {
    try {
      return liveSessions(project, servers());
    } catch {
      return [];
    }
  };
  // Each tool call is one change in the plan's history, named after the tool (history.ts).
  const toolName = new AsyncLocalStorage<string>();
  const register = server.registerTool.bind(server) as (name: string, config: unknown, cb: (...args: unknown[]) => unknown) => unknown;
  (server as { registerTool: unknown }).registerTool = (name: string, config: unknown, cb: (...args: unknown[]) => unknown) =>
    register(name, strictInput(config), (...args: unknown[]) => toolName.run(name, () => cb(...args)));
  // What the Developer wrote on the dashboard to the whole project (shown to whichever Session calls
  // first, with or without a Goal) and to the Goals this Session holds, now marked as shown.
  const takeNews = () =>
    newsLines(
      [PROJECT_TALK, ...project.claimedGoals().map((g) => g.id)]
        .filter((id) => project.hasNewFromDeveloper(id))
        .map((id) => ({ goal: id, from: project.takeNewFromDeveloper(id) })),
    );
  // The rules, context and wishlist this chat was last sent; tools that end with a status leave them
  // out while they are unchanged. get_status leaves them out too, but only in Claude Code with the hooks set up.
  let sentInstructions: string | undefined;
  const status = (brief = false) => {
    const news = takeNews();
    const session = project.sessionStatus();
    const global = readGlobal(globalFile);
    const instructions = instructionLines(session, global);
    const said = instructions.join("\n");
    const shown = brief && instructions.length > 0 && said === sentInstructions ? [INSTRUCTIONS_UNCHANGED] : instructions;
    sentInstructions = said;
    const held = new Set(session.held.map((s) => s.goal!.id));
    // Goals nobody is working on: said, but left unseen for the Session that claims them.
    const unheld = project
      .roadmap()
      .goals.filter((g) => !held.has(g.id) && g.status !== "dropped" && !project.heldElsewhere(g))
      .map((g) => {
        try {
          if (!project.hasNewFromDeveloper(g.id)) return { goal: g.id, messages: 0, answers: 0 };
          const talk = project.talk(g.id);
          return { goal: g.id, messages: talk.messages.filter((m) => m.state === "new").length, answers: talk.questions.filter((q) => q.state === "answered" && !q.seen).length };
        } catch {
          return { goal: g.id, messages: 0, answers: 0 };
        }
      });
    const elsewhereNews = elsewhereNewsLine(unheld);
    const toProject = projectTalkLine(project.projectMessages());
    const text = [
      ...news,
      ...(elsewhereNews ? [elsewhereNews] : []),
      ...(toProject ? [toProject] : []),
      formatStatus(
        session,
        project.schedule(estimatesOf(project)),
        [
          ...[calibrationLine(project), session.held.length > 0 ? offerHint(readSettings(settingsFile, project.root).alternatives.offer) : undefined].filter((l): l is string => !!l),
          ...project.helperWarnings(),
          ...resourceLines(project.resources().list(), project.now()),
        ],
        goalWaits(session.goals),
        global,
        shown,
      ),
      ...session.held.filter((h) => h.goal!.release !== undefined && h.goal!.status !== "done").map((h) => `\n${releaseFor(project, h.goal!).text}`),
    ].join("\n");
    // The Developer's new hand-test marks are now shown, so the next status calls only later ones new.
    for (const s of session.held) if (s.handTests.some((h) => h.result !== "pending" && !h.seen)) project.acknowledgeHandTests(s.goal!.id);
    return text;
  };
  // Apps without Claude Code's hooks never hand the Agent the plan between calls, so results that
  // don't show the whole status end with where the work stands.
  const settingsFile = options.settingsFile ?? settingsFileFor(options.registryFile ?? defaultRegistryFile());
  const estimatesOf = (p: Project) => readSettings(settingsFile, p.root).estimates;
  const updateFile = options.updateFile ?? (process.env.VITEST ? undefined : updateFileFor(options.registryFile ?? defaultRegistryFile()));
  /** Once per newer version: the line telling the AI it is out; asks npm in the background when the answer is a day old. */
  const updateLine = (): string | undefined => {
    if (!updateFile) return undefined;
    const enabled = readSettings(settingsFile).updates.check;
    void refreshUpdate(updateFile, { enabled }).catch(() => undefined);
    return takeUpdateLine(updateFile, VERSION, howInstalled(), enabled);
  };
  // Release goals (facts.ts): the facts the AI writes the changelog entry and version bump from.
  const releaseFor = (p: Project, g: Goal, bundles?: string[]) => {
    const r = readSettings(settingsFile, p.root).release;
    return releaseFacts(p, {
      goalId: g.id,
      bundles: bundles ?? (g.release !== undefined ? (g.bundles ?? []) : undefined),
      version: g.release !== undefined && g.release !== "next" ? g.release : undefined,
      files: r.files,
      changelog: r.changelog,
    });
  };
  const calibrationLine = (p: Project) => estimateLine(p.calibration(estimatesOf(p)));
  // Steps linked to their commits and tests (gitFacts.ts): recorded as they finish, with one warning
  // line for a step whose files still have changes not saved in git.
  const recordEvidence = (p: Project, finished: { task: Task; goal?: string; commits?: string[]; tests?: string }[]): string[] => {
    const s = readSettings(settingsFile, p.root).evidence;
    if (!s.record) return [];
    return finished.flatMap(({ task, goal, commits, tests }) => {
      if (task.status !== "done" && task.status !== "released") return [];
      // Said once per goal: later steps of a goal that is committed at the end stay quiet (complete_goal says it again).
      const warned = s.warnUncommitted && p.uncommittedWarned(task.id!, goal);
      const t = p.recordEvidence(task.id!, goal, { commits, tests });
      return s.warnUncommitted && t.uncommitted && !warned ? [`Warning: ${t.id} is done but its files have changes not saved in git. This is said once for each goal; the files still need saving before the goal is finished.`] : [];
    });
  };
  // Goals that wait on other goals (dependencies.ts): another project's goals are read, never changed.
  const goalLookup: GoalLookup = (wantedProject, goalId) => {
    try {
      const target = resolveProject(wantedProject, { registryFile });
      const other = new Project({ root: target.root, session: { id: "lookup", pid: process.pid }, clearStaleClaims: false });
      const g = other.roadmap().goal(goalId);
      return g ? { title: g.title, status: g.status } : undefined;
    } catch {
      return undefined;
    }
  };
  const unknownWaits = (p: Project, goalId: string) =>
    p
      .waitingOn(goalId, goalLookup)
      .filter((w) => w.state === "unknown")
      .map((w) => `Note: found no goal ${w.ref.raw}; it won't hold ${goalId} up.`);
  /** "waits on X (not finished)" for each open goal that still waits on another. */
  const goalWaits = (goals: Goal[]) =>
    new Map(
      goals
        .filter((g) => g.waitsOn?.length && g.status !== "done" && g.status !== "dropped")
        .flatMap((g) => {
          const text = waitsText(project.waitingOn(g.id, goalLookup));
          return text ? [[g.id, text] as const] : [];
        }),
    );
  // Recurring goals (routines.ts): due ones are added by get_status without asking, one line each.
  const routineLines = (p: Project): string[] => {
    try {
      if (!readSettings(settingsFile, p.root).routines.enabled) return [];
      return p.runRoutines().map((g) => `Routine ${g.fromRoutine} added goal ${g.id} "${g.title}" (${everyWords(p.roadmap().routine(g.fromRoutine!)?.every ?? "")}).`);
    } catch {
      return []; // a routine never fails the status
    }
  };
  const waitsOnInput = z.array(z.string()).optional().describe("Goals it waits on: IDs here, or <project>/<goal-id>.");
  const commitsInput = z.array(z.string()).optional().describe("Short hashes of its commits; found from git when left out.");
  const testsInput = z.string().optional().describe("The test run behind it, in a few words ('715 passed').");
  const withNow = (text: string) => `${text}\n${nowLine(project.sessionStatus())}`;
  const { dashboard, registryFile } = options;
  project.history = (root) => readSettings(settingsFile, root).history;
  project.claims = (root) => readSettings(settingsFile, root).claims;
  // Told once per Session: each get_status after that would only repeat it.
  let hooksChecked = false;
  let hooksMissing = false;
  // The plan check-up runs by itself once per Session (see get_status).
  let checkedUp = false;
  // The reminder about untried things to try: at most one line a day (untried.ts), by the project's clock.
  const remindOnce = oncePerDay(() => project.now());
  const untriedReminder = (): string | undefined => {
    try {
      const untried = project
        .roadmap()
        .goals.filter((g) => g.status !== "dropped")
        .flatMap((g) => project.plan(g.id).handTests.filter((h) => h.result === "pending").map((h) => ({ goal: g.id, at: h.added?.at })));
      return remindOnce(reminderLine(summarizeUntried(untried), project.now()));
    } catch {
      return undefined; // a reminder never fails the status
    }
  };
  // The risks list (risks.ts) is the AI's to keep: a project without one is nudged once per chat, and
  // serious risks nothing is reducing are named in get_status until a goal is linked or they change.
  let riskNudged = false;
  const riskReminder = (): string | undefined => {
    try {
      const risks = project.risks();
      if (risks.length === 0) {
        if (riskNudged) return undefined;
        riskNudged = true;
        return "This project has no risks list yet: add the risks you notice as you work (what could go wrong, how likely, how bad, what would reduce it) with save_risk. Nobody has to ask.";
      }
      const goals = new Map(project.roadmap().goals.map((g) => [g.id, g.status]));
      const serious = unreducedSeriousRisks(risks, (id) => goals.get(id));
      return serious.length > 0
        ? `Serious risks nothing is reducing: ${serious.map((r) => `${r.id} ${r.title}`).join("; ")}. Link a goal that reduces each (save_risk with goals), plan one, or update the risk if it has changed.`
        : undefined;
    } catch {
      return undefined; // a reminder never fails the status
    }
  };
  /** After a goal is finished: the open risks linked to it, for the AI to mark reduced or closed. */
  const finishedGoalRisks = (p: Project, goalId: string): string => {
    try {
      return p
        .risks()
        .filter((r) => r.status === "open" && r.goals.includes(goalId))
        .map((r) => ` Risk ${r.id} ${r.title} is linked to this goal: now that it is finished, mark it reduced or closed with save_risk, or say why it is still open.`)
        .join("");
    } catch {
      return "";
    }
  };
  const hooksLine = (): string | undefined => {
    if (hooksChecked || !isClaudeCode(server)) return undefined;
    hooksChecked = true;
    const advice = hooksAdvice(project.root, options.claudeHome ?? homedir(), launchFor({ viaNpx: startedViaNpx(), viaUvx: startedViaUvx(), platform: process.platform }));
    if (advice) hooksMissing = true;
    return advice;
  };
  // The plan a tool acts on: this project's, or with `project` another one's, changed from here.
  const planOf = (wanted: string | undefined): Project => {
    if (!wanted?.trim()) return project;
    const target = resolveProject(wanted, { registryFile });
    return sameFolder(target.root, project.root) ? project : project.elsewhere(target.root, projectEntry(project.root).name);
  };
  // Every tool holds the plan it acts on while it reads and rewrites it (lock.ts), as one change in its history.
  // Every reply on this project's plan ends with anything new from the Developer (get_status puts it first).
  const respondIn = (wanted: string | undefined, body: (p: Project) => string) =>
    respond(() => {
      const p = planOf(wanted);
      return p.transaction(toolName.getStore() ?? "tool", () => {
        // Steps follow local git by themselves (stepSync.ts); a failure here never fails the tool.
        let synced: string | undefined;
        if (p === project) {
          try {
            synced = project.syncWithGit(chatsHere());
          } catch {
            synced = undefined;
          }
        }
        const text = body(p);
        if (p !== project) return text;
        const news = takeNews();
        return [text, ...(synced ? [synced] : []), ...news].join("\n");
      });
    });
  const nameOf = (p: Project) => projectEntry(p.root).name;
  // What a change to another project's plan answers with, instead of where this project's work stands.
  const doneIn = (p: Project, text: string) =>
    p === project ? withNow(text) : `${text}\nThat was in project ${nameOf(p)}; it is marked there as updated from ${p.from}.`;

  server.registerTool(
    "get_status",
    {
      title: "Get status",
      description:
        "Compact summary of every Goal this Session holds (current Task, open Detour, Tasks with a helper or waiting on the Developer, next Task, decisions and open notes) and the Developer's Standing Instructions. Call it at the start of every conversation and after context compression. With project, another project's Goals and Tasks instead, to change them from here. With for_helper, only the Developer's rules as a block for a helper agent's brief (a helper chat in a git worktree of the project gets it by itself in Claude Code).",
      inputSchema: {
        project: otherProject,
        check: z.boolean().optional().describe("Also run the plan check-up and list everything it found."),
        for_helper: z.boolean().optional().describe("Only the rules, as a block for a helper agent's brief: the rules and context for everything, then this project's Standing Instructions, hard rules first."),
        full: z.boolean().optional().describe("Print the Standing Instructions, Important context and wishlist in full even if they are unchanged since this Session last saw them."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project: wanted, check, for_helper, full }) => {
      if (for_helper) return respondIn(undefined, () => formatRules(project.roadmap().standingInstructions, readGlobal(globalFile)));
      // The Session serving the dashboard may have ended; if so, this one takes over.
      await dashboard?.refresh().catch(() => undefined);
      const routined = wanted?.trim() ? [] : routineLines(project);
      return respondIn(wanted, (p) => {
        if (p !== project) return formatOtherProject(p, nameOf(p));
        // A Goal another chat handed to the next one is taken by the first get_status of a chat that holds none.
        const handed = project.takeHandedGoals().map((g) => `Goal ${g.id} was handed to this chat; it is claimed for you.`);
        // The plan check-up (checkup.ts): once per Session by itself, or every finding when asked.
        const settings = readSettings(settingsFile, project.root).checkup;
        let checked: string[] = [];
        if (check) {
          const r = checkUp(project, { repair: settings.autoRepair });
          checked = r.findings.length === 0 ? ["Plan check-up: nothing wrong."] : ["Plan check-up:", ...r.findings.map((f) => `- ${f.fixed ? "Fixed: " : ""}${f.text}`)];
        } else if (settings.onStatus && !checkedUp) {
          checkedUp = true;
          const line = checkupLine(checkUp(project, { repair: settings.autoRepair }));
          if (line) checked = [line];
        }
        const hooks = hooksLine();
        let now: string;
        try {
          // The rules are repeated in full only the first time, when they changed, or when asked. Only Claude Code
          // with the hooks set up gets them back after context compression; every other app always gets them in full.
          now = status(!full && !hooksMissing && isClaudeCode(server));
        } catch (e) {
          // A plan that can't be read still gets what the check-up found, which says why.
          throw checked.length > 0 ? new Error(`${(e as Error).message}\n${checked.join("\n")}`) : e;
        }
        const elsewhere = takeElsewhereLine(project, seenFile(registryFile));
        const reminder = untriedReminder();
        const risky = riskReminder();
        const update = updateLine();
        const others = chatsHere().filter((c) => c.session !== project.session.id);
        const overLimit = helperWarning(project, { chats: chatsHere(), global: readGlobal(globalFile).rules });
        const chats = others.length > 0 ? `Other chats in this project: ${others.map((c) => `${c.session} (${c.goals.length > 0 ? `holds ${c.goals.map((g) => g.id).join(", ")}` : "no Goal"})`).join(", ")}` : undefined;
        return [
          ...handed,
          now,
          ...routined,
          ...checked,
          ...(reminder ? [reminder] : []),
          ...(risky ? [risky] : []),
          ...(elsewhere ? [elsewhere] : []),
          ...(hooks ? [hooks] : []),
          ...(update ? [update] : []),
          ...(chats ? [chats] : []),
          ...overLimit,
          `Project folder: ${project.root}`,
          ...(dashboard?.url ? [`Dashboard: ${dashboard.url}`] : []),
          ...(dashboard?.url && dashboard.notice ? [`Dashboard note: ${dashboard.notice}`] : []),
        ].join("\n");
      });
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "Get item",
      description:
        "Look up one Goal, Task, Detour, decision, note or Standing Instruction by its ref (progressor://<goal>/<item>, or progressor://roadmap/<instruction>), with its file and line. Use it when the Developer pastes a ref or you need one item's details; for where the work stands overall, use get_status.",
      inputSchema: {
        ref: z.string().optional().describe("A ref such as progressor://login/t2 or progressor://roadmap/i1."),
        refs: z.array(z.string()).max(10).optional().describe("Several refs (at most 10) instead of ref: each item's text, separated by a blank line; a bad ref reports its own error."),
        project: otherProject,
      },
      annotations: { readOnlyHint: true },
    },
    ({ ref, refs, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (!refs?.length) {
          if (!ref) throw new Error("Give a ref, or refs for several.");
          return formatItem(p.getItem(ref), p.schedule(estimatesOf(p)), p.now());
        }
        const schedule = p.schedule(estimatesOf(p));
        return [...(ref ? [ref] : []), ...refs]
          .map((r) => {
            try {
              return formatItem(p.getItem(r), schedule, p.now());
            } catch (e) {
              return `${r}: ${(e as Error).message}`;
            }
          })
          .join("\n\n");
      }),
  );

  server.registerTool(
    "add_goal",
    {
      title: "Add Goal",
      description:
        "Add a Goal to the end of the Roadmap, with an optional Task list and Outcome; with claim: true, also claim it to start work. A title another Goal already has is refused unless allow_duplicate is set. To record work already finished, set done on the Goal and on every Task. Plan each Goal with an Outcome (one sentence on what done looks like) and Tasks that each have a short title, the files they touch, a one-line summary and an estimate. Tell the Developer the plan in a few plain lines first. With claim: true the answer is the brief status of the claimed Goal; otherwise only the new Goal's ID, title, step count and estimate.",
      inputSchema: {
        title: z.string().trim().min(1).describe("A few words naming the Goal, such as 'Ship OAuth login'."),
        id: z
          .string()
          .optional()
          .describe("A short ID for the Goal's refs, such as 'web-ui': lowercase letters, digits and dashes. Made from the title when left out."),
        outcome: outcome.optional(),
        estimate: z
          .string()
          .optional()
          .describe("How long the whole Goal should take, such as '6h', when its Tasks are not estimated one by one yet. Without it, the Goal's estimate is the sum of its Tasks'."),
        tasks: z.array(newTaskInput).optional(),
        allow_duplicate: z.boolean().optional().describe("Add the Goal even though another Goal has the same title."),
        done: z.boolean().optional().describe("Record a Goal that is already finished. Every Task must then have done: true."),
        claim: z.boolean().optional().describe("Claim the new Goal straight away, to start working on it. Not with project: a Goal on another project's plan can't be claimed from here."),
        waits_on: waitsOnInput,
        release: z
          .boolean()
          .optional()
          .describe("Make it a release goal: it bundles the finished goals no earlier release took, and the reply gives the facts to write the changelog entry and version bump from."),
        bundles: z.array(z.string()).optional().describe("For a release goal: the finished goals it bundles, by ID, instead of all the unreleased ones."),
        repeat: z
          .string()
          .optional()
          .describe("Make it come back: 1d, 1w, 2w, 1mo or a weekday (monday). A goal like it is added by itself when due, once the last one is finished or dropped."),
        project: otherProject,
      },
    },
    ({ title, id, outcome, estimate, tasks, allow_duplicate, done, claim, waits_on, release, bundles, repeat, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (p !== project && claim)
          throw new Error("A Goal added to another project's plan cannot be claimed from here; leave out claim (or record finished work with done).");
        if (repeat !== undefined && !parseEvery(repeat)) throw new Error(`Say how often it comes back: 1d, 1w, 2w, 1mo or a weekday such as monday (not "${repeat}").`);
        const goal = p.addGoal(title, newTasks(tasks), { id, outcome, estimate: readEstimate(estimate) ?? undefined, allowDuplicate: allow_duplicate, done });
        if (waits_on?.length) p.setWaitsOn(goal.id, waits_on);
        let facts = "";
        if (release || bundles?.length) {
          const f = releaseFor(p, goal, bundles);
          p.setRelease(goal.id, f.version ?? "next", f.bundles);
          // Held release goals show their facts in the status; otherwise the reply carries them.
          if (!claim || p !== project) facts = `\n${f.text}`;
        }
        if (repeat !== undefined) {
          const r = p.repeatGoal(goal.id, repeat);
          facts = `\nComes back ${everyWords(r.every)} (routine ${r.id}).${facts}`;
        }
        const unknown = waits_on?.length ? unknownWaits(p, goal.id) : [];
        const n = tasks?.length ?? 0;
        if (unknown.length > 0) return [`Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks.`, ...unknown].join("\n") + facts;
        if (p !== project)
          return doneIn(p, (done ? `Recorded finished Goal ${goal.id} (${goal.ref}) with ${n} done Tasks.` : `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks.`) + facts);
        if (done) return `Recorded finished Goal ${goal.id} (${goal.ref}) with ${n} done Tasks.${facts}`;
        const learned = calibrationLine(p);
        if (claim) {
          project.claimGoal(goal.id);
          return `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks, claimed by this Session.${facts}${learned ? `\n${learned}` : ""}\n\n${status(true)}`;
        }
        const total = goal.estimate ?? (tasks ?? []).reduce((sum, t) => sum + (readEstimate(t.estimate) || 0), 0);
        return `Added Goal ${goal.id} "${goal.title}" (${goal.ref}): ${n} ${n === 1 ? "step" : "steps"}${total ? `, estimate ${sayDuration(total)}` : ""}. Claim it with claim_goal to work on it.${learned ? `\n${learned}` : ""}${facts}`;
      }),
  );

  server.registerTool(
    "add_hotfix",
    {
      title: "Add hotfix",
      description:
        "Add a hotfix: a bug the Developer wants fixed before any other work, often from a customer report. Pass the report word for word. It goes at the top of the Roadmap with two Tasks (a test that shows the bug, then the fix), and every Session is told it is waiting until one claims it. With claim: true, claim it now; otherwise finish the step you are on first, then claim it.",
      inputSchema: {
        report: z.string().min(1).describe("The bug report as the Developer or customer wrote it: what goes wrong, and how to make it happen if known."),
        title: z.string().optional().describe("A few words naming the bug; the report's first line when left out."),
        claim: z.boolean().optional().describe("Claim the hotfix straight away, to start on it now. Not with project: a hotfix on another project's plan can't be claimed from here."),
        project: otherProject,
      },
    },
    ({ report, title, claim, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (p !== project && claim) throw new Error("A hotfix added to another project's plan cannot be claimed from here; leave out claim.");
        const goal = p.addHotfix(report, { title });
        if (p !== project) return doneIn(p, `Added hotfix ${goal.id} (${goal.ref}) at the top of the Roadmap.`);
        if (claim) {
          project.claimGoal(goal.id);
          return `Added hotfix ${goal.id} (${goal.ref}), claimed by this Session. Start with t1: a test that shows the bug.\n\n${status(true)}`;
        }
        return withNow(`Added hotfix ${goal.id} (${goal.ref}) at the top of the Roadmap. Finish the step you are on, then claim it with claim_goal.`);
      }),
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update Goal",
      description:
        "Rename a Goal, set its Outcome or its estimate, or mark it needed for the launch (for_launch). Its ID, refs and Plan File stay the same, and it needs no Claim. To change a Goal's Tasks, claim it and use add_tasks, update_task or update_tasks.",
      inputSchema: {
        goal: goalId,
        title: z.string().trim().min(1).optional().describe("The new title."),
        outcome: outcome.optional().describe("The new Outcome; an empty string removes it."),
        estimate: estimateText
          .optional()
          .describe("How long the whole Goal should take, such as '6h'; it covers the open Tasks that have no estimate of their own. An empty string removes it, so the Goal's estimate is the sum of its Tasks'."),
        waits_on: waitsOnInput.describe("The goals it waits on, replacing any it had (empty: none): IDs here, or <project>/<goal-id>."),
        for_launch: z
          .boolean()
          .optional()
          .describe("true: the Goal is needed for the launch, so the dashboard's Ready to launch? page and launch_readiness count it; false: no longer. Mark the goals a launch needs as soon as you know; nobody has to ask."),
        project: otherProject,
      },
    },
    ({ goal, title, outcome, estimate, waits_on, for_launch, project: wanted }) =>
      respondIn(wanted, (p) => {
        const g = p.updateGoal(goal, { title, outcome, estimate: readEstimate(estimate) });
        if (waits_on) p.setWaitsOn(goal, waits_on);
        if (for_launch !== undefined) p.setForLaunch([goal], for_launch);
        const item = [formatItem(p.getItem(g.ref), p.schedule(estimatesOf(p))), ...(waits_on?.length ? unknownWaits(p, goal) : [])].join("\n");
        return p === project ? item : doneIn(p, item);
      }),
  );

  server.registerTool(
    "launch_readiness",
    {
      title: "Launch readiness",
      description:
        "Answer 'are we ready to launch?': what still stands before the launch or the next release, grouped by who it waits on (you, the Developer, other people), with serious risks nothing is reducing. It is the same summary as the dashboard's Ready to launch? page, so answer from it. It counts the next open release goal and what it bundles, else the goals marked for launch (update_goal for_launch), else every open goal.",
      inputSchema: { project: otherProject },
    },
    ({ project: wanted }) => respondIn(wanted, (p) => readinessText(p.readiness())),
  );

  server.registerTool(
    "move_goal",
    {
      title: "Move Goal",
      description:
        "Move a Goal right before or after another Goal, so the Roadmap lists the work in the order it should happen. Give exactly one of before and after. The dashboard lists the Goals that need the Developer (things to try, steps to check, questions) in this order too, so put the one they should check first in front.",
      inputSchema: {
        goal: goalId,
        before: z.string().optional().describe("The ID of the Goal to move it in front of."),
        after: z.string().optional().describe("The ID of the Goal to move it behind."),
        project: otherProject,
      },
    },
    ({ goal, before, after, project: wanted }) =>
      respondIn(wanted, (p) => {
        const order = ["Goals in order:", ...p.moveGoal(goal, { before, after }).map((g) => goalLine(g))].join("\n");
        return p === project ? order : doneIn(p, order);
      }),
  );

  server.registerTool(
    "drop_goal",
    {
      title: "Drop Goal",
      description:
        "Drop a Goal that will not be done, with the reason; its Plan File stays as a record. Releases this Session's Claim on it. A Goal another running Session holds, or one already done, cannot be dropped. To drop a single Task, use update_tasks (action drop).",
      inputSchema: {
        goal: goalId,
        reason: z.string().min(1).describe("Why the Goal will not be done."),
        stop_repeating: z.boolean().optional().describe("For a goal a routine made: also stop the routine, so it won't come back."),
      },
    },
    ({ goal, reason, stop_repeating }) =>
      respondIn(undefined, () => {
        const g = project.dropGoal(goal, reason, { stopRepeating: stop_repeating });
        const routine = g.fromRoutine ? project.roadmap().routine(g.fromRoutine) : undefined;
        if (stop_repeating && g.fromRoutine) return `Dropped Goal ${g.id}: ${g.reason} It won't come back.`;
        if (routine) return `Dropped Goal ${g.id}: ${g.reason} Routine ${routine.id} still brings it back ${everyWords(routine.every)} (stop_repeating stops it).`;
        return `Dropped Goal ${g.id}: ${g.reason}`;
      }),
  );

  server.registerTool(
    "claim_goal",
    {
      title: "Claim Goal",
      description:
        "Claim a Goal for this Session, so only this Session works on it. The Session keeps any other Goals it holds; while it holds several, pass goal to the tools that change one. Fails if another running Session holds it. Claiming a done Goal reopens it: its finished Tasks stay done, and add_tasks adds the new work to the same list.",
      inputSchema: {
        goal: goalId,
        takeover: z
          .boolean()
          .optional()
          .describe("Take the Goal from another running Session. Only when the Developer asks for it."),
      },
    },
    ({ goal, takeover }) =>
      respondIn(undefined, () => {
        project.claimGoal(goal, { takeover });
        // Waiting never stops the work (nothing waits for the Developer); the AI is only told.
        const waits = readSettings(settingsFile, project.root).dependencies.warnOnClaim ? waitsText(project.waitingOn(goal, goalLookup)) : undefined;
        return waits ? `Note: Goal ${goal} ${waits}; carry on only where that work isn't needed first.\n\n${status(true)}` : status(true);
      }),
  );

  server.registerTool(
    "resource",
    {
      title: "Shared resource",
      description:
        "A named shared resource that only one session or helper can use at a time (a dev window that allows a single instance, plasmashell, a port). " +
        "claim it before you or a helper start something that needs it: refused, saying who holds it, since when and why, when someone else has it; then do not start it, do other work and try again later (nothing waits for you). Claiming your own again refreshes its time. It frees itself after `minutes` (30 unless given, at most 240) from the last claim, when its Session ends, or when you release it. A helper usually cannot call Progressor: claim on its behalf with label such as 'helper: media run'. " +
        "release it as soon as the work that needed it ends (a helper's too), with the same label; another holder's is refused unless force, only when the Developer says the holder is gone. " +
        "list says who holds what (get_status shows the same).",
      inputSchema: {
        action: z.enum(["claim", "release", "list"]).describe("claim, release or list."),
        resource: resourceName.optional(),
        reason: z.string().max(300).optional().describe("To claim: why you need it, in a few words, such as 'running the UI test'. Shown to whoever is refused."),
        label: resourceLabel,
        task: z.string().max(40).optional().describe("To claim: the Task ID it is for, such as 't3'."),
        minutes: z.number().min(1).max(240).optional().describe("To claim: how long to keep it before it frees itself, from now. 30 if omitted; claim again to extend."),
        force: z.boolean().optional().describe("To release: even though someone else holds it. Only when the Developer asks."),
      },
    },
    ({ action, resource, reason, label, task, minutes, force }) =>
      respondIn(undefined, () => {
        if (action === "list") {
          const held = project.resources().list();
          return held.length > 0 ? resourceLines(held, project.now()).join("\n") : "Nothing is in use.";
        }
        if (!resource?.trim()) throw new Error(`Name the resource to ${action}.`);
        if (action === "release")
          return project.resources().release(resource, { label, force })
            ? `Released ${resource.trim().toLowerCase().replace(/\s+/g, "-")}.`
            : `${resource} was not held, so there is nothing to release.`;
        if (!reason?.trim()) throw new Error("Say why you need it (reason).");
        const { lock, refreshed } = project.resources().claim(resource, { reason, label, task, minutes });
        return `${refreshed ? "Refreshed" : "Claimed"} ${lock.resource} for ${holderText(lock)}; it frees itself in ${lock.minutes} m. Call resource with action release when the work that needs it ends.`;
      }),
  );

  server.registerTool(
    "release_goal",
    {
      title: "Release Goal",
      description:
        "Release this Session's Claim on a Goal, leaving it paused for a later Session. With to, hand it over in this one call instead: another chat's Session ID (get_status lists the chats in this project), which then holds it, or 'next' for the next chat whose get_status takes it.",
      inputSchema: {
        goal: heldGoal,
        to: z.string().max(40).optional().describe("Hand the Goal to this chat instead of pausing it: a running Session's ID such as 's-1a2b3c', or 'next'."),
      },
    },
    ({ goal: id, to }) =>
      respondIn(undefined, () => {
        if (to?.trim()) {
          const handed = project.handGoal(id, to, chatsHere().map((c) => ({ session: c.session, pid: c.pid })));
          return handed.claim?.session === HANDED_TO_NEXT
            ? `Handed Goal ${handed.id} to the next chat in this project: its get_status takes it. If nobody takes it within a day, it is paused.`
            : `Handed Goal ${handed.id} to Session ${handed.claim?.session}; it holds it now.`;
        }
        const goal = project.releaseGoal(id);
        return goal ? `Released Goal ${goal.id}; it is now paused.` : "This Session had no Goal to release.";
      }),
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Complete Goal",
      description:
        "Mark the claimed Goal done and release it, once its Outcome is true and its Tasks are done, released or dropped (not with a helper, waiting on the Developer or only checked). While the Developer still has hand tests (save_hand_test) to mark, the Goal is released as built and waiting on their tests instead: it finishes by itself when they mark the last one, and a failure reopens it with a new Task. unmarked_hand_tests_ok finishes it now, only when the Developer says to finish anyway. If more work turns up later, claim_goal reopens it.",
      inputSchema: {
        goal: heldGoal,
        hand_tests: z.array(z.string()).optional().describe("Things only the Developer can try by hand, saved before completing (so the Goal is released waiting on them), each as save_hand_test would."),
        next: z.string().optional().describe("The ID of the Goal to claim right after; if that fails the completion still stands and the reply says why."),
        unmarked_hand_tests_ok: z
          .boolean()
          .optional()
          .describe("Finish now even though some hand tests are still not marked by the Developer. Only when the Developer says to finish anyway."),
        project: otherProject,
      },
    },
    ({ goal: id, hand_tests, next, unmarked_hand_tests_ok, project: wanted }) =>
      respondIn(wanted, (p) => {
        const tests = filled(hand_tests, "hand test");
        if (next && p !== project) throw new Error("A Goal on another project's plan cannot be claimed from here; leave out next.");
        for (const text of tests) p.addHandTest(text, id);
        const options = { unmarkedHandTests: unmarked_hand_tests_ok };
        const ev = readSettings(settingsFile, p.root).evidence;
        const unsaved = ev.record && ev.warnUncommitted && p.goalUncommitted(id) === true;
        const goal = p.completeGoal(id, options);
        // The next Goal is claimed after the completion; if that fails, the completion stands.
        const claimNext = (): string => {
          if (!next) return "";
          try {
            project.claimGoal(next);
            return `

${status(true)}`;
          } catch (e) {
            return `
Could not claim ${next}: ${(e as Error).message}`;
          }
        };
        const unsavedLine =
          (unsaved ? ` Warning: some files this goal's steps touched still have changes not saved in git.` : "") + finishedGoalRisks(p, goal.id);
        if (goal.status === "testing") {
          const left = p.plan(goal.id).handTests.filter((h) => h.result === "pending").length;
          const said =
            `Goal ${goal.id} is built and waiting on the Developer's hand tests (${left} not marked yet); it is released. ` +
            "It finishes by itself when they mark the last one, and a failure reopens it with a new Task." + unsavedLine;
          return p === project
            ? `${said} Tell the Developer in one plain sentence that "${goal.title}" is built and ${left === 1 ? "one thing is" : `${left} things are`} waiting for them to try${dashboard?.url ? ` at ${dashboard.url}` : " on the dashboard"}.${claimNext()}`
            : doneIn(p, said);
        }
        // A finished release gets its handoff, written by the AI from the facts (handoff.ts).
        const handoff = goal.release !== undefined && readSettings(settingsFile, p.root).handoffs.afterRelease ? " Then write a handoff for this release with the handoff tool." : "";
        if (p !== project) return doneIn(p, `Goal ${goal.id} is done.${unsavedLine}${handoff}`);
        return `Goal ${goal.id} is done.${unsavedLine} Tell the Developer in one plain sentence that "${goal.title}" is finished${dashboard?.url ? `, and that they can see it at ${dashboard.url}` : ""}.${handoff}${claimNext()}`;
      }),
  );

  server.registerTool(
    "add_tasks",
    {
      title: "Add Tasks",
      description:
        "Append Tasks to the claimed Goal's plan, each with an estimate of how long it takes. For work that is not part of the plan, declare a Detour instead. Set done on a Task that is already finished: a small change you have made is recorded in this one call, with hand_test for what the Developer should try. A quick fix that belongs to no Goal goes under Small fixes with add_small_fix instead.",
      inputSchema: { goal: heldGoal, tasks: z.array(addTaskInput).min(1), decisions: decisionsInput, project: otherProject },
    },
    ({ goal, tasks, decisions, project: wanted }) =>
      respondIn(wanted, (p) => {
        for (const t of tasks) filled(t.hand_tests, "hand test");
        const said = filled(decisions, "decision");
        const added = p.addTasks(newTasks(tasks.map(({ hand_test, hand_tests, ...t }) => t)), goal);
        const tests = tasks.flatMap((t, i) => [t.hand_test, ...(t.hand_tests ?? [])].flatMap((text) => (text?.trim() ? [p.addHandTest(text, goal, added[i]!.id)] : [])));
        for (const text of said) p.addDecision(text, goal);
        const warnings = recordEvidence(p, added.map((task) => ({ task, goal })));
        return doneIn(p, [`Added: ${added.map(taskLine).join("; ")}`, ...[calibrationLine(p)].filter((l): l is string => !!l), ...tests.map((h) => `Saved hand test ${h.id} about ${h.task}: ${h.text}`), ...warnings].join("\n"));
      }),
  );

  server.registerTool(
    "add_small_fix",
    {
      title: "Add small fix",
      description:
        "Record a small one-off fix you have made that belongs to no Goal (a dev-server speed-up, a typo, formatting) as a finished step of the project's standing Small fixes goal, made the first time. Nothing is claimed and the Goals you hold are untouched. hand_test adds what the Developer should try. For work that is part of a Goal, use add_tasks with done: true instead.",
      inputSchema: {
        title: taskInput.shape.title,
        summary: taskInput.shape.summary,
        code: taskInput.shape.code,
        hand_test: addTaskInput.shape.hand_test,
        project: otherProject,
      },
    },
    ({ title, summary, code, hand_test, project: wanted }) =>
      respondIn(wanted, (p) => {
        const { goal, task, handTest } = p.addSmallFix({ title, summary, code, handTest: hand_test });
        return doneIn(
          p,
          [`Recorded ${goal.id}/${taskLine(task)} as done under ${goal.title}.`, ...(handTest ? [`Saved hand test ${handTest.id} about ${handTest.task}: ${handTest.text}`] : [])].join("\n"),
        );
      }),
  );

  const riskFields = {
    likelihood: z.enum(LEVELS).describe("How likely it is to happen: low, medium or high."),
    impact: z.enum(LEVELS).describe("How bad it would be: low, medium or high."),
    mitigation: z.string().optional().describe("What would reduce it, in one line; an empty string removes it."),
    owner: z.string().optional().describe("Who looks after it, such as 'your AI' or 'the Developer'; an empty string removes it."),
    goals: z.array(z.string()).optional().describe("IDs of the goals whose work reduces it; replaces the ones it has."),
    status: z.enum(RISK_STATUSES).optional().describe("open (the usual), reduced (the work that lowers it is done) or closed (it can no longer happen)."),
  };
  const riskSaid = (r: Risk) => `risk ${r.id} ${r.title}: ${r.status}, ${r.likelihood} likelihood, ${r.impact} impact${r.goals.length ? `, reduced by ${r.goals.join(", ")}` : ""}`;

  server.registerTool(
    "save_risk",
    {
      title: "Save risk",
      description:
        "Add a risk to the project's risks list: something that could go wrong, how likely and how bad, what would reduce it, who owns it and the goals that reduce it. Add the ones you notice as you work, without being asked; the Developer sees the list on the dashboard. " +
        "With risk (its ID): change any of its fields, or its status (reduced once the work that lowers it is done, closed when it can no longer happen). Keep the list true as goals finish.",
      inputSchema: {
        risk: z.string().optional().describe("A risk's ID, such as 'r2', to change it; leave out to add one (then title, likelihood and impact are needed)."),
        title: taskInput.shape.title.optional().describe("What could go wrong, in a few words, such as 'Windows paths break setup'."),
        likelihood: riskFields.likelihood.optional(),
        impact: riskFields.impact.optional(),
        mitigation: riskFields.mitigation,
        owner: riskFields.owner,
        goals: riskFields.goals,
        status: riskFields.status,
        project: otherProject,
      },
    },
    ({ risk, title, likelihood, impact, project: wanted, ...rest }) =>
      respondIn(wanted, (p) => {
        if (risk) {
          const r = p.updateRisk(risk, { title, likelihood, impact, ...rest });
          return doneIn(p, `Updated ${riskSaid(r)}.`);
        }
        if (!title || !likelihood || !impact) throw new Error("A new risk needs a title, a likelihood and an impact.");
        const r = p.addRisk({ title, likelihood, impact, ...rest });
        return doneIn(p, `Added risk ${r.id} ${r.title} (${r.likelihood} likelihood, ${r.impact} impact)${r.goals.length ? `, reduced by ${r.goals.join(", ")}` : ""}.`);
      }),
  );

  server.registerTool(
    "set_task_state",
    {
      title: "Set Task state",
      description:
        "Set a Task's state. 'with a helper': handed to a helper agent that is working on it (several Tasks can be). 'waiting on you': you are waiting on the Developer, such as for them to test something by hand; the dashboard shows the Goal as waiting on them, so tell them what you need. 'waiting on someone': waiting on a person other than the Developer (a team member, a lawyer, a provider): give person and need; it is shown apart from what waits on the Developer. 'checked': you checked a helper's work (tests, review) but it is not merged or released yet; give evidence, one short line on what you checked (\"715 passed, live send OK\"), which the Developer sees on the step. With 'with a helper', give helper_branch, helper_folder (the worktree path) and helper_label: they are recorded with the Task and shown in get_status and on the dashboard, and get_status warns when a finished Task's helper branch still has unmerged work. 'released': merged and out (shipped, installed or published); counts as done. 'pending', 'in progress' and 'done' work too (in progress allows one Task of a Goal at a time). Set a state as soon as it changes, such as 'checked' right after you check a helper's work, so the Developer's dashboard keeps moving. If the project has a helper limit (get_status shows it), keep at most that many Tasks with a helper: one more is still set, with a warning. To drop a Task, use update_tasks (action drop).",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        state: z.enum(states),
        helper_branch: helperBranch,
        helper_folder: helperFolder,
        helper_label: helperLabel,
        evidence,
        person: personInput,
        need: needInput,
        role: z.string().optional().describe("With person: what they are to the project, such as 'payments lawyer'; kept on the project's people (an empty role removes it)."),
        project: otherProject,
      },
    },
    ({ goal, task, state, helper_branch, helper_folder, helper_label, evidence: proof, person, need, role, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (role !== undefined && !person) throw new Error("role goes with person: say whose role it is.");
        const t = p.setTaskState(task, state, goal, { helper: helperOf(helper_branch, helper_folder, helper_label), evidence: proof, person, need });
        const waits = t.status === "waiting on someone" ? `, waiting on ${t.waitingFor}${t.need ? `: ${t.need}` : ""}` : "";
        const who = role !== undefined && person ? p.addPerson(person, role) : undefined;
        const said = [`Task ${taskLine(t)} is now ${t.status}${waits}.`, ...(who ? [who.role ? `${who.name} (${who.id}) is now: ${who.role}.` : `${who.name} (${who.id}) has no role now.`] : []), ...tookLine([t], new Date()), ...(state === "with a helper" ? helperWarning(p, helperContext(p)) : []), ...recordEvidence(p, [{ task: t, goal }])];
        return doneIn(p, said.join("\n"));
      }),
  );

  const operation = z.object({
    helper_branch: helperBranch,
    helper_folder: helperFolder,
    helper_label: helperLabel,
    evidence,
    person: personInput,
    need: needInput,
    action: z
      .enum(["start", "complete", "state", "drop", "estimate"])
      .describe("start: mark in progress. complete: mark done. state: set the state given in state. drop: drop it, with reason. estimate: only set its estimate."),
    task: taskId,
    goal: heldGoal,
    state: z.enum(states).optional().describe("For action 'state': the new state, as in set_task_state."),
    reason: z.string().optional().describe("For action 'drop': why the Task is no longer needed."),
    code: z.array(z.string()).optional().describe("For action 'complete': files the Task touched, optionally with :line."),
    commits: commitsInput,
    tests: testsInput,
    hand_tests: handTestsInput,
    decisions: decisionsInput,
    summary: taskInput.shape.summary,
    estimate: estimateText.optional().describe("The Task's new estimate, such as '45m' or '2h' (any action; needed for 'estimate'); an empty string removes it."),
  }).strict();
  server.registerTool(
    "update_tasks",
    {
      title: "Update Tasks",
      description:
        "Start, complete or drop Tasks, one or several in one call: start one before you change code for it (only one Task of a Goal is in progress at a time); complete it when done, with the files it touched (code), and the new summary when what you built differs from it; drop one that is no longer needed, with the reason. Also sets states and estimates. The operations are applied in order, so a start can follow the complete of the Task that was in progress; if any one fails, none is applied. A 'state' operation takes the same helper_branch, helper_folder, helper_label (with 'with a helper') and evidence (with 'checked') as set_task_state. Each operation can name its own claimed Goal with goal, else the call's goal (or the only Goal held) is used. Answers briefly, with the time a completed Task took and where the work stands, not the whole status.",
      inputSchema: { goal: heldGoal, operations: z.array(operation).min(1).max(25), project: otherProject },
    },
    ({ goal, operations, project: wanted }) =>
      respondIn(wanted, (p) => {
        const held = p !== project || project.claimedGoals().length > 1;
        // A Task completed again changes only its files and summary, and says so.
        for (const op of operations) {
          filled(op.hand_tests, "hand test");
          filled(op.decisions, "decision");
        }
        const was = operations.map((op) => {
          if (op.action !== "complete") return undefined;
          try {
            const status = p.taskStatus(op.task, op.goal ?? goal);
            return status === "done" || status === "released" ? status : undefined;
          } catch {
            return undefined;
          }
        });
        const ops: TaskOperation[] = operations.map(({ estimate, helper_branch, helper_folder, helper_label, commits: _commits, tests: _tests, hand_tests: _h, decisions: _d, ...op }) => {
          const helper = helperOf(helper_branch, helper_folder, helper_label);
          return { ...op, ...(helper ? { helper } : {}), estimate: readEstimate(estimate) };
        });
        const changed = p.updateTasks(ops, goal);
        const finished = changed.flatMap((c, i) => {
          const op = operations[i]!;
          const finishing = op.action === "complete" || (op.action === "state" && (op.state === "done" || op.state === "released"));
          return finishing && !was[i] ? [{ task: c.task, goal: c.goal, commits: op.commits, tests: op.tests }] : [];
        });
        const warnings = recordEvidence(p, finished);
        let handTests = 0;
        let decisions = 0;
        changed.forEach((c, i) => {
          const op = operations[i]!;
          if (op.action !== "complete") return;
          for (const text of op.hand_tests ?? []) {
            p.addHandTest(text, c.goal, c.task.id);
            handTests++;
          }
          for (const text of op.decisions ?? []) {
            p.addDecision(text, c.goal);
            decisions++;
          }
        });
        const now = new Date();
        // An estimate set in this call is said back; the others are left out, to keep the answer short.
        const est = (t: Task, i: number) => (operations[i]!.estimate !== undefined ? `, estimated ${t.estimate !== undefined ? sayDuration(t.estimate) : "none"}` : "");
        const name = (c: (typeof changed)[number]) => `${held ? `${c.goal}/` : ""}${taskLine(c.task)}`;
        // One Task: a short line in words ("Started", "Done", "Dropped"); several: one list.
        const one = (c: (typeof changed)[number], i: number) => {
          const op = operations[i]!;
          if (was[i]) return `Task ${name(c)} was already ${was[i]}; nothing else changed.${op.code?.length || op.summary?.trim() ? " Its files and summary were updated." : ""}`;
          if (op.action === "start") return `Started ${name(c)}${est(c.task, i)}.`;
          if (op.action === "complete") return `Done: ${name(c)}${est(c.task, i)}.`;
          if (op.action === "drop") return `Dropped ${name(c)}: ${op.reason ?? ""}`.trimEnd();
          return `${name(c)} is ${c.task.status}${est(c.task, i)}.`;
        };
        return doneIn(
          p,
          [
            changed.length === 1 ? one(changed[0]!, 0) : `Updated: ${changed.map((c, i) => `${name(c)} is ${c.task.status}${est(c.task, i)}`).join("; ")}.`,
            ...tookLine(
              changed.filter((c, i) => operations[i]!.action === "complete" && !was[i]).map((c) => c.task),
              now,
            ),
            ...(operations.some((o) => o.state === "with a helper") ? helperWarning(p, helperContext(p)) : []),
            ...(handTests + decisions > 0
              ? [`Saved ${[handTests ? `${handTests} hand test${handTests === 1 ? "" : "s"}` : "", decisions ? `${decisions} decision${decisions === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")}.`]
              : []),
            ...warnings,
          ].join("\n"),
        );
      }),
  );

  server.registerTool(
    "move_task",
    {
      title: "Move Task",
      description:
        "Move a Task of a claimed Goal to another Goal when it belongs there. It keeps its title, summary, files and state, gets a new ID at the end of the other Goal's list (or right before or after the Task given in before or after) and a 'moved from' line. In the old Goal it stays as a dropped Task whose reason is where it went, so refs and history still work. The other Goal must not be dropped, done or held by another running Session; a Task in progress can move only if the other Goal has none in progress.",
      inputSchema: {
        goal: heldGoal.describe("The claimed Goal the Task is in. Needed only when this Session holds several Goals."),
        task: taskId,
        to_goal: goalId.describe("The ID of the Goal to move the Task to."),
        before: z.string().optional().describe("A Task ID in the other Goal to put it in front of."),
        after: z.string().optional().describe("A Task ID in the other Goal to put it behind."),
      },
    },
    ({ goal, task, to_goal, before, after }) =>
      respondIn(undefined, () => {
        const from = goal ?? project.claimedGoal()?.id;
        const moved = project.moveTask(task, to_goal, { before, after }, goal);
        return withNow(
          `Moved ${task} ${moved.title} from ${from} to ${to_goal} as ${moved.ref}. The old ${task} stays in ${from}, dropped with the reason it moved.`,
        );
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description:
        "Change a Task's title, summary, files or estimate, for instance when the fix turns out different from the plan or you learn it takes longer. Leaves its status alone.",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        title: taskInput.shape.title.optional(),
        summary: taskInput.shape.summary,
        code: z.array(z.string()).optional().describe("The Task's files, optionally with :line; replaces the ones it has."),
        estimate: estimateText.optional().describe("The Task's new estimate, such as '45m' or '2h'; an empty string removes it."),
        project: otherProject,
      },
    },
    ({ goal, task, title, summary, code, estimate, project: wanted }) =>
      respondIn(wanted, (p) => {
        const t = p.updateTask(task, { title, summary, code, estimate: readEstimate(estimate) }, goal);
        const item = formatItem(p.getItem(t.ref!));
        return p === project ? item : doneIn(p, item);
      }),
  );

  server.registerTool(
    "start_detour",
    {
      title: "Start Detour",
      description:
        "Declare that the work is splitting off from the planned Tasks, before doing it. Branches from the current Task. Only one Detour can be open.",
      inputSchema: {
        goal: heldGoal,
        title: z.string().trim().min(1).describe("What the Detour does, such as 'Fix flaky token refresh'."),
        reason: z.string().min(1).describe("Why the work has to split off from the plan now."),
      },
    },
    ({ goal, title, reason }) =>
      respondIn(undefined, () => {
        const d = project.startDetour(title, reason, goal);
        return withNow(`Started ${formatDetour(d)}. End it with end_detour when done.`);
      }),
  );

  const endings = ["merge back", "return", "recalibrate"] as const satisfies readonly DetourEnding[];
  server.registerTool(
    "end_detour",
    {
      title: "End Detour",
      description:
        "End the open Detour. 'merge back': it was small and is done; the plan is unchanged. 'return': go back to the plan, appending `tasks` for the Detour's intended work if any. 'recalibrate': drop every remaining Task and replace them with `tasks`.",
      inputSchema: {
        goal: heldGoal,
        ending: z.enum(endings),
        tasks: z.array(taskInput).optional().describe("Tasks to append (return) or the new Task list (recalibrate)."),
      },
    },
    ({ goal, ending, tasks }) =>
      respondIn(undefined, () => {
        const { detour, added, dropped } = project.endDetour(ending, newTasks(tasks), goal);
        return [
          `Ended ${formatDetour(detour)}`,
          ...(dropped.length > 0 ? [`Dropped: ${dropped.map((t) => t.id).join(", ")}`] : []),
          ...(added.length > 0 ? [`Added: ${added.map(taskLine).join("; ")}`] : []),
          nowLine(project.sessionStatus()),
        ].join("\n");
      }),
  );

  server.registerTool(
    "save_decision",
    {
      title: "Save decision",
      description:
        "Record a choice made for a claimed Goal along the way, such as 'old models get thinking on/off only', so it survives context compression; get_status shows it with its ID (c1, c2...). With id: reword it, or remove it with an empty text. Not for lasting project rules (save_standing_instruction) or project-wide background (update_context).",
      inputSchema: {
        goal: heldGoal,
        id: z.string().optional().describe("A decision's ID, such as 'c2', to change it; leave out to add one."),
        text: z.string().describe("The decision, in one line; with id, empty removes it."),
        project: otherProject,
      },
    },
    ({ goal, id, text, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (id) {
          const d = p.updateDecision(id, text, goal);
          const said = d ? `Changed decision ${d.id}: ${d.text}` : `Removed decision ${id}.`;
          return p === project ? said : doneIn(p, said);
        }
        if (!text.trim()) throw new Error("Write the decision first.");
        const d = p.addDecision(text, goal);
        return doneIn(p, `Saved decision ${d.id} in Goal ${goal ?? p.claimedGoal()?.id}: ${d.text}`);
      }),
  );

  server.registerTool(
    "save_note",
    {
      title: "Save note",
      description:
        "Note something you spotted that belongs to a Goal, such as a bug found during cleanup that belongs to the Voice Goal, instead of dealing with it now. Any Goal on the Roadmap that is not dropped, claimed or not. get_status shows the open notes of the Goals this Session holds. With id: resolve it once dealt with (resolved: true), reopen it (false), reword it, or remove it with an empty text.",
      inputSchema: {
        goal: goalId.describe("The ID of the Goal the note belongs to."),
        id: z.string().optional().describe("A note's ID, such as 'n2', to change it; leave out to add one."),
        text: z.string().optional().describe("What you spotted, in one line; with id, the new wording, and empty removes the note."),
        resolved: z.boolean().optional().describe("With id: true once the note is dealt with; false to reopen it."),
        project: otherProject,
      },
    },
    ({ goal, id, text, resolved, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (id) {
          const n = p.updateNote(goal, id, { text, resolved });
          const said = n ? `${resolved === true ? "Resolved" : resolved === false ? "Reopened" : "Changed"} note ${n.id}: ${n.text}` : `Removed note ${id}.`;
          return p === project ? said : doneIn(p, said);
        }
        if (!text?.trim()) throw new Error("Write the note first.");
        if (resolved !== undefined) throw new Error("A new note is open; resolve it later with its id.");
        const n = p.addNote(goal, text);
        return doneIn(p, `Saved note ${n.id} in Goal ${goal}: ${n.text}`);
      }),
  );

  server.registerTool(
    "ask_developer",
    {
      title: "Ask the Developer",
      description:
        "Ask the Developer a question on the dashboard, with 2 to 4 short choices they can click (they can also answer in their own words), instead of stopping in the chat. Use it for product and UX choices only they can make; carry on with other work meanwhile. Their answer reaches you at your next Progressor call, under 'New from the Developer', and is kept as a decision on the Goal. While a question is open the dashboard shows the Goal as waiting on them. To offer ways to go instead, give alternatives and recommended: nobody has to pick, you go ahead with yours. To take back a question that no longer needs an answer, pass withdraw with its ID instead.",
      inputSchema: {
        goal: heldGoal,
        question: z.string().max(500).optional().describe("The question, in one plain sentence a non-programmer understands."),
        choices: z.array(z.string().max(200)).max(4).optional().describe("2 to 4 short answers to pick from, such as ['On by default', 'Follow the computer']."),
        alternatives: z
          .array(z.object({ title: z.string().max(200), about: z.string().max(300).optional(), picture: z.string().optional() }))
          .max(4)
          .optional()
          .describe("2 to 4 ways to go, instead of choices: a title, a line about it, a picture ID from attach_picture."),
        recommended: z.number().int().optional().describe("The alternative you would pick (1-based; default 1)."),
        wait: z.string().optional().describe('How long to wait for a pick before going ahead with yours, such as "10m"; default from the settings ("0m": at once).'),
        task: z.string().optional().describe("The ID of the Task it is about, such as 't3'."),
        withdraw: z.string().optional().describe("The ID of an open question to withdraw (such as 'q2'), instead of asking a new one."),
      },
    },
    ({ goal, question, choices, alternatives, recommended, wait, task, withdraw }) =>
      respondIn(undefined, () => {
        if (withdraw) return withNow(`Withdrew question ${project.withdrawQuestion(withdraw, goal).id}.`);
        if (!question) throw new Error("Give the question and its choices, or withdraw with a question ID.");
        if (alternatives) {
          const waitText = wait ?? readSettings(settingsFile, project.root).alternatives.wait;
          const waitMinutes = parseWait(waitText);
          if (waitMinutes === undefined) throw new Error(`wait must be a time such as "0m", "10m", "1h" or "1d", not "${waitText}".`);
          const q = project.askAlternatives(question, alternatives, { recommended, waitMinutes, goal, task });
          const n = q.recommended ?? 1;
          const pick = `${n} "${q.alternatives[n - 1]!.title}"`;
          const where = `on the dashboard${dashboard?.url ? ` (${dashboard.url})` : ""}`;
          return withNow(
            [
              `Offered ${q.id}: ${q.text} (${q.alternatives.map((a, i) => `${i + 1} ${a.title}`).join(" / ")}, recommended ${n})`,
              q.state === "answered"
                ? `Go ahead now with ${pick} (kept as decision ${q.decision}). The Developer may pick another ${where}; a later pick comes as news under 'New from the Developer', and then you change course.`
                : `Carry on with other work. If nobody picks by ${q.proceeds}, go ahead with ${pick}: your next Progressor call after that says so. The Developer picks ${where}; a later pick comes as news.`,
            ].join("\n"),
          );
        }
        const q = project.askDeveloper(question, choices ?? [], { goal, task });
        return withNow(
          `Asked ${q.id}: ${q.text} (${q.choices.join(" / ")})\nThe Developer answers on the dashboard${dashboard?.url ? ` (${dashboard.url})` : ""}; tell them in one plain sentence that a question is waiting there. Carry on with other work meanwhile.`,
        );
      }),
  );

  server.registerTool(
    "reply_to_developer",
    {
      title: "Reply to the Developer",
      description:
        "Answer a message the Developer sent you on the dashboard (shown under 'New from the Developer' with its ID, such as m2): say in a sentence or two, in plain words, what you did or will do about it. The reply shows under their message on the dashboard. Reply to every message, even if only to say you will do it later. A message to the whole project is answered with whole_project: true and needs no Goal.",
      inputSchema: {
        goal: heldGoal,
        message: z.string().describe("The message ID, such as 'm2'."),
        reply: z.string().max(2000).describe("Your answer, in plain words for someone who doesn't code."),
        whole_project: z.boolean().optional().describe("True for a message to the whole project rather than to a Goal."),
      },
    },
    ({ goal, message, reply, whole_project }) =>
      respondIn(undefined, () => {
        const m = whole_project ? project.replyToProjectMessage(message, reply) : project.replyToDeveloper(message, reply, goal);
        return withNow(`Replied to message ${m.id}. The Developer sees it on the dashboard.`);
      }),
  );

  server.registerTool(
    "save_hand_test",
    {
      title: "Save hand test",
      description:
        "Add something only the Developer can try by hand to a claimed Goal, such as 'OpenCode may ask permission to read an attached file: allow it and check the reply'. Put it here instead of in your chat summary: the Developer sees the Goal's hand-test list on the dashboard and marks each one there as works, doesn't work (with a note) or won't test. A failure adds a Task to the Goal by itself; get_status shows what is still open and the new marks. complete_goal with tests unmarked leaves the Goal waiting on them, and it finishes when the last is marked. " +
        "With id: reword it, change which Task it is about, or remove it with an empty text (for one that turned out not to need testing); its mark stays, and only the Developer marks tests.",
      inputSchema: {
        goal: heldGoal,
        id: z.string().optional().describe("A hand test's ID, such as 'h2', to change it; leave out to add one."),
        text: z.string().optional().describe("What to try and what to look for, in one or two short plain sentences; with id, empty removes it."),
        task: z.string().optional().describe("The ID of the Task it is about, such as 't3'; with id, an empty string removes the link."),
      },
    },
    ({ goal, id, text, task }) =>
      respondIn(undefined, () => {
        if (id) {
          const h = project.updateHandTest(id, { text, task }, goal);
          return withNow(h ? `Changed hand test ${h.id}: ${h.text}` : `Removed hand test ${id}.`);
        }
        if (!text?.trim()) throw new Error("Say what to try first.");
        const h = project.addHandTest(text, goal, task || undefined);
        return withNow(`Saved hand test ${h.id}: ${h.text}\nThe Developer marks it on the dashboard.`);
      }),
  );

  server.registerTool(
    "attach_picture",
    {
      title: "Attach picture",
      description:
        "Show the Developer a screenshot or a short screen recording on the dashboard instead of naming a file in chat. It is copied (not moved) next to the plan, stays on this computer and out of git, and appears on the Goal, on the step or on the hand test you name; the Developer clicks it to enlarge. Allowed: .png .jpg .jpeg .webp .gif and .webm .mp4, up to 10 MB, with a short caption. To take one back, pass remove with its ID (such as 'p2') instead.",
      inputSchema: {
        goal: heldGoal,
        path: z.string().optional().describe("The file's path, absolute or from the project's folder."),
        caption: z.string().optional().describe("What it shows, in a few plain words (up to 200 characters)."),
        task: z.string().optional().describe("The ID of the Task it is about, such as 't3'."),
        hand_test: z.string().optional().describe("The ID of the hand test it is about, such as 'h2'."),
        remove: z.string().optional().describe("The ID of a picture to remove (such as 'p2'), instead of attaching one."),
      },
    },
    ({ goal, path, caption, task, hand_test, remove }) =>
      respondIn(undefined, () => {
        if (remove) return withNow(`Removed picture ${project.removePicture(remove, goal).id}.`);
        if (!path) throw new Error("Give the file's path and a caption, or remove with a picture ID.");
        const p = project.attachPicture(path, caption ?? "", { task, handTest: hand_test }, goal);
        const where = p.task ? `step ${p.task}` : p.handTest ? `hand test ${p.handTest}` : "the Goal";
        return withNow(`Attached ${p.id} to ${where}: ${p.caption}. The Developer sees it on the dashboard.`);
      }),
  );

  server.registerTool(
    "attach_report",
    {
      title: "Attach report",
      description:
        "Keep a write-up (a test run, a review, what you did) on a step, where the Developer and every chat can read it, instead of writing it to a file nobody finds. Works from any chat in the project, even one that holds no goal: then give goal. Give text (markdown) or the path of a .md or .txt file, up to 200 KB, and a short title. Read it with get_item progressor://<goal>/<id>. To take one back, pass remove with its ID (such as 'r2').",
      inputSchema: {
        goal: z.string().optional().describe("The Goal's ID; needed unless this chat holds exactly one Goal."),
        task: z.string().optional().describe("The ID of the step it is about, such as 't3'."),
        title: z.string().optional().describe("A short title for the report."),
        text: z.string().optional().describe("The report, in markdown."),
        path: z.string().optional().describe("Instead of text: a .md or .txt file, absolute or from the project's (or this chat's own worktree) folder."),
        remove: z.string().optional().describe("The ID of a report to remove (such as 'r2'), instead of attaching one."),
      },
    },
    ({ goal, task, title, text, path, remove }) =>
      respondIn(undefined, () => {
        if (remove) {
          const id = goal ?? project.claimedGoals()[0]?.id;
          if (!id) throw new Error("Say which goal the report is in (goal).");
          return withNow(`Removed report ${removeReport(project, id, remove).id}.`);
        }
        if (!task) throw new Error("Say which step the report is about (task), with a title and its text or path.");
        const r = attachReport(project, { task, title: title ?? "", text, path }, goal);
        return withNow(`Attached report ${r.id} to step ${r.task}: ${r.title}. Read it with get_item progressor://${r.goal}/${r.id}; the Developer sees it on the step.`);
      }),
  );

  server.registerTool(
    "save_standing_instruction",
    {
      title: "Save Standing Instruction",
      description:
        "Save a lasting rule from the Developer about how you should work in this project, such as 'ask me before changing the plan'. get_status lists it from then on. Use it only for rules meant to last; a one-off request is just done. " +
        "A rule the Developer says holds in every project ('in all my projects...', 'always, everywhere...') goes in with global: true: it is saved once for this computer and every project's get_status shows it. " +
        "With id (s1, s2... in get_status; g1, g2... for a rule for everything): reword it when the Developer changes it, make it hard (hard: true) or ordinary again (false), set the helper limit it holds, or remove it with an empty text. What you leave out stays.",
      inputSchema: {
        id: z.string().optional().describe("A rule's ID, such as 's2', or 'g1' for a rule for everything, to change it; leave out to add one."),
        text: z.string().optional().describe("The rule, in the Developer's words where possible; with id, empty removes it and left out keeps the wording."),
        hard: hardFlag,
        helpers_at_once: helpersAtOnce,
        global: globalFlag,
      },
    },
    ({ id, text, hard, helpers_at_once, global }) =>
      respondIn(undefined, () => {
        if (id) {
          if (global || /^g\d+$/i.test(id.trim())) {
            const g = updateGlobalRule(globalFile, id, { text, hard, helpersAtOnce: helpers_at_once });
            return g ? `Changed ${g.hard ? "HARD RULE" : "rule"} ${g.id} for everything: ${g.text}` : `Removed rule ${id} for everything.`;
          }
          const s = project.updateStandingInstruction(id, { text, hard, helpersAtOnce: helpers_at_once });
          return s ? `Changed ${s.hard ? "HARD RULE" : "Standing Instruction"} ${s.id}: ${s.text}${limitText(s)}` : `Removed Standing Instruction ${id}.`;
        }
        if (!text?.trim()) throw new Error("Write the rule first.");
        if (global) {
          const g = addGlobalRule(globalFile, text, hard ?? false, helpers_at_once || undefined);
          return withNow(`Saved ${g.hard ? "HARD RULE" : "rule"} ${g.id} for everything: ${g.text}`);
        }
        const s = project.addStandingInstruction(text, hard, helpers_at_once || undefined);
        return withNow(`Saved ${s.hard ? "HARD RULE" : "Standing Instruction"} ${s.id}: ${s.text}${limitText(s)}`);
      }),
  );

  server.registerTool(
    "update_context",
    {
      title: "Update Important context",
      description:
        "Replace the project's Important context: lasting background you and the Developer need in every conversation, such as what the project is, key facts, where things live and choices that hold for the whole project. " +
        "Not for rules (save_standing_instruction) or for one Goal's details. get_status shows the current text: send the whole new text, or an empty text to clear it. " +
        `At most ${MAX_CONTEXT_LENGTH} characters.`,
      inputSchema: {
        text: z.string().describe("The whole Important context, in plain words; short paragraphs or a list."),
        global: z
          .boolean()
          .optional()
          .describe(
            "true to replace a part of the context for everything instead (every project, and anywhere Progressor runs on this computer). Only when the Developer asks for it. Give part too.",
          ),
        part: z
          .enum(["computer", "me"])
          .optional()
          .describe("With global: \"computer\" for About this computer (setup facts: the operating system, tools, where CI runs, hardware), \"me\" for About me and how I work (the Developer's preferences)."),
      },
    },
    ({ text, global, part }) =>
      respondIn(undefined, () => {
        if (global || part) {
          if (!part) throw new Error('Say which part of the context for everything: part: "computer" (About this computer) or "me" (About me and how I work).');
          const saved = setGlobalContext(globalFile, part, text);
          return saved ? `Saved "${PART_TITLE[part]}" for everything (${saved.length} of ${MAX_CONTEXT_LENGTH} characters).` : `Cleared "${PART_TITLE[part]}" for everything.`;
        }
        const context = project.setContext(text);
        return context
          ? `Saved the Important context (${context.length} of ${MAX_CONTEXT_LENGTH} characters).`
          : "Cleared the Important context.";
      }),
  );

  // Slash commands: Claude Code lists them in its / menu as /<server name>:status (MCP) and so on.
  registerFeatureTools(server, {
    project,
    registryFile,
    settingsFile,
    respondIn,
    withNow,
    doneIn,
  });

  const message = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "status",
    { title: "Progressor status", description: "Where the work stands: the Goals, their Outcomes, the current Tasks, any open Detour and what comes next." },
    () => message(statusPrompt(project.transaction("status", status))),
  );

  server.registerPrompt(
    "plan",
    {
      title: "Plan a Goal",
      description: "Turn a piece of work into a Goal with an Outcome and Tasks, agreed with you before anything is added.",
      argsSchema: {
        goal: z.string().optional().describe("What you want done, in plain words. Leave it empty to describe it in the chat, with links or code."),
      },
    },
    ({ goal }) => message(planPrompt(goal?.trim() || undefined)),
  );

  server.registerPrompt(
    "review",
    {
      title: "Review a Goal",
      description: "Go through a Goal's Tasks against its Outcome, find what is missing, and reopen it with new Tasks if needed.",
      argsSchema: { goal: z.string().optional().describe("The Goal ID; the claimed Goal when left out.") },
    },
    ({ goal }) => message(reviewPrompt(project, goal?.trim() || undefined)),
  );

  server.registerPrompt(
    "setup",
    { title: "Set up this project", description: "Add Progressor's hooks, its notes in CLAUDE.md and AGENTS.md and a Roadmap to this folder." },
    () => message(setupPrompt(project.root, launchFor({ viaNpx: startedViaNpx(), viaUvx: startedViaUvx(), platform: process.platform }))),
  );

  server.registerPrompt(
    "next",
    { title: "Pick up the work", description: "Carry on where the plan left off: the open Detour, the Task in progress, or the next Task, claiming a Goal if needed." },
    () => message(project.transaction("next", () => nextPrompt(project.sessionStatus(), status()))),
  );

  server.registerPrompt(
    "dashboard",
    { title: "Open the dashboard", description: "The link to this project's dashboard, opened in a browser pane where the app has one." },
    async () => {
      await dashboard?.refresh().catch(() => undefined);
      return message(dashboardPrompt(dashboard?.url));
    },
  );

  return server;
}
