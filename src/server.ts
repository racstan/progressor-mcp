import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { Dashboard } from "./dashboard/http.js";
import { projectEntry } from "./dashboard/registry.js";
import { resolveProject, sameFolder, seenFile, takeElsewhereLine } from "./elsewhere.js";
import { launchFor, startedViaNpx } from "./init.js";
import { withLock } from "./lock.js";
import { parseDuration, roughDuration, sayDuration, timeText } from "./estimate.js";
import { type Decision, type Detour, type HelperInfo, type NewTask, type Note, type Task, type TaskStatus, TIMED, timeSpent } from "./planFile.js";
import { type DetourEnding, type FoundItem, MAX_CONTEXT_LENGTH, type Project, type SessionStatus, type Status, type TaskOperation } from "./project.js";
import { dashboardPrompt, nextPrompt, planPrompt, reviewPrompt, setupPrompt, statusPrompt } from "./prompts.js";
import { handTestLines, handTestWord } from "./handTestText.js";
import { elsewhereNewsLine, newsLines, talkLines } from "./talkText.js";
import { type ResourceLock, holderText, resourceLine } from "./resources.js";
import { type Goal, type StandingInstruction, hardFirst, helperLimit, ruleText } from "./roadmap.js";
import type { GoalSchedule, Schedule } from "./schedule.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export const INSTRUCTIONS = `Progressor keeps the plan for this project in .progressor/ and shows it to the Developer on a live dashboard. Change the plan only with these tools, never by editing those files. The Developer may not be a programmer: you run the plan, they watch.

1. First thing in every conversation, and again after your context is compressed or summarised, call get_status. Follow the Standing Instructions it lists.
2. No Goal claimed? If get_status says one Goal is paused, claim it and carry on. When the Developer asks for work no Goal covers, plan it yourself as a Goal: a short title, an Outcome (one sentence on what done looks like) and Tasks, each with a short title, the files it touches, a one-line summary of the change and an estimate of how long it takes ("45m", "2h"). Tell the Developer the plan in a few plain lines, then call add_goal with claim: true. A quick question needs no Goal.
3. Before you change code for a Task, call start_task; call complete_task when it is done, with the files you touched. Keep summaries true with update_task, and drop_task what is no longer needed. You work on one Task of a Goal at a time; set_task_state records the rest: "with a helper" when you hand a Task to a helper agent (several can be; pass its helper_branch, helper_folder and helper_label so a branch left behind can be found), "waiting on you" when you need the Developer (to test something by hand, to decide; tell them what you need), "checked" once you have checked a helper's work (tests, review; give evidence, a short line such as \"715 passed, live send OK\") but it is not merged yet, and "released" once it is merged and out (shipped, installed, published). If get_status shows a helper limit, keep at most that many Tasks with a helper at once: hand out the next one when one comes back. When you learn a Task will take longer or shorter than its estimate, update the estimate. Record each change as it happens, not all at the end, so the dashboard keeps moving while helpers work: "checked" as soon as you have checked a helper's work, "released" as soon as it is merged (changes that happen together still go in one update_tasks call).
3a. You can hold several Goals at once, for instance with helper agents on different Goals: claim each one. While you hold more than one, pass goal (the Goal ID) to the tools that change a Goal.
3b. To change several Tasks at once (complete two and start the next), make one update_tasks call with a list of operations, applied in order and all or nothing; it costs far fewer tokens than one call each. A Task that belongs in another Goal moves there with move_task, which keeps its title, summary, files and state.
4. About to change code for something that is not the current Task (an unrelated bug, a missing prerequisite, a change of plan)? Call start_detour with the reason first. When it is done, call end_detour: "merge back" for a small fix, "return" to go back to the plan (adding Tasks for any work left), or "recalibrate" to replace the remaining Tasks with a new list.
5. When every Task is done, released or dropped and the Outcome is true, call complete_goal and tell the Developer in one sentence. If more work turns up for a finished Goal, claim it again to reopen it, then add_tasks.
6. Talk to the Developer in everyday words: say "step" for Task and "side trip" for Detour, and leave out tool names, IDs and the files in .progressor/. Give them the dashboard link from get_status once at the start of a conversation, and again when a Goal is finished.
7. When the Developer gives a lasting rule ("always...", "never..."), save it with add_standing_instruction; change or remove one with update_standing_instruction. A rule that must never be broken (the Developer says "never", "under no circumstances", "this is a hard rule") is saved with hard: true; get_status lists those first as HARD RULE.
8. Keep lasting background about the project on its Important context page with update_context: what the project is, key facts, where things live, choices that hold for the whole project. get_status shows it; keep it short and true.
9. Record a choice made along the way that is not a lasting project rule (such as "old models get thinking on/off only") with add_decision, so it survives context compression. When you spot something that belongs to a Goal, this one or another (a bug found during cleanup that belongs to the Voice Goal), add_note on that Goal instead of fixing it now; once it is dealt with, resolve it with update_note.
9a. Anything only the Developer can try by hand (a permission prompt to allow, a screen to look at) goes in add_hand_test, not in your chat summary: they mark each one on the dashboard, and get_status shows what is open and what failed. A failure adds a Task to the Goal. A Goal can't be completed while a hand test is unmarked, unless the Developer says to finish anyway (unmarked_hand_tests_ok).
9b. The Developer can write to you on the dashboard, and you can ask them there. Their messages and answers reach you at your next Progressor call (get_status, or the end of any tool reply) under "New from the Developer": act on each message as an instruction from them, and answer it with reply_to_developer (what you did or will do). When you need the Developer to choose (a product or UX question), ask with ask_developer and 2 to 4 short choices instead of stopping in the chat; carry on with other work meanwhile. Their answer arrives the same way and is kept as a decision.
10. When you brief a helper agent, call get_rules and paste its block into the brief: helpers don't see the Standing Instructions, and the hard rules apply to them too.
11. Some things only one session or helper can use at a time (a dev window that allows one instance, the desktop shell, a port). Before you or a helper start something that needs one, call claim_resource with its name and why; if it is refused, someone else is using it: do not start it now, do other work and try again later. Release it with release_resource when the work ends. A helper usually cannot call Progressor itself, so claim on its behalf before you start it (pass label, such as "helper: media run") and release when it hands back; put the resource name in its brief. get_status shows what is in use.
12. Work you do here that belongs to another project using Progressor (releasing it, say) goes in that project's plan: pass project (its name on the dashboard) to get_status, add_goal and the other tools that take it. Those changes are marked as made from this project, and a Goal an AI chat there is working on can only get a note.`;

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
  title: z.string().min(1).describe("A short title for the Task, a few words, such as 'Fix callback redirect loop'."),
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
const helperBranch = z.string().max(200).optional().describe("With state 'with a helper': the git branch the helper works on, such as 'feat/export'. Recorded so a branch left behind can be found later.");
const helperFolder = z.string().max(500).optional().describe("With state 'with a helper': the helper's worktree folder (its path).");
const helperLabel = z.string().max(100).optional().describe("With state 'with a helper': a label for the helper, such as the model it runs on ('Sonnet').");
const evidence = z
  .string()
  .max(300)
  .optional()
  .describe("With state 'checked': one short line on what you checked, such as '715 passed, live send OK'. Give it: the Developer sees it on the dashboard step.");
const taskId = z.string().describe("The Task ID, such as 't3'.");
const states = ["pending", "in progress", "with a helper", "waiting on you", "checked", "done", "released"] as const satisfies readonly TaskStatus[];
const helpersAtOnce = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe(
    "Makes this rule the project's helper limit: the most Tasks that may be 'with a helper' at once, such as 2 when the Developer says 'at most 2 helpers in parallel'. One rule holds the limit; setting it here takes it off any other. 0 removes it.",
  );
const hardFlag = z
  .boolean()
  .optional()
  .describe("true for a rule that must never be broken (not just a preference); get_status, the session start and get_rules list those first as HARD RULE.");
const outcome = z
  .string()
  .describe("What done looks like, in one sentence, such as 'Users can sign in with Google and stay signed in for 30 days'.");

/** The locks held now, for get_status; nothing when none is. */
export function resourceLines(locks: ResourceLock[], now: Date): string[] {
  return locks.length > 0
    ? ["In use now (claim_resource before using one, release_resource after):", ...locks.map((l) => `- ${resourceLine(l, now)}`)]
    : [];
}

function goalLine(g: Goal): string {
  return `- ${g.id}: ${g.title} (${g.status})`;
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
  const { held } = session;
  if (held.length === 0) return "Now: no Goal claimed; call get_status.";
  if (held.length > 1) return `Now: ${held.map((s) => `${s.goal!.id}: ${goalNow(s)}`).join(" · ")}`;
  const s = held[0]!;
  const next = s.currentTask ?? s.nextTask;
  if (s.openDetour) return `Now: side trip "${s.openDetour.title}" (end it with end_detour) · then ${next ? taskLine(next) : "complete_goal"}`;
  if (s.currentTask) return `Now: ${taskLine(s.currentTask)} · Next: ${s.nextTask ? taskLine(s.nextTask) : "complete_goal"}`;
  if (s.nextTask) return `Now: no Task in progress · Next: start_task ${taskLine(s.nextTask)}`;
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
    `Goal ${g.id}: ${g.title} (${g.ref}), ${s.done} of ${s.total} Tasks done${s.waitingOnYou.length > 0 ? ", waiting on the Developer" : ""}`,
    ...[
      ...(g.outcome ? [`Outcome: ${g.outcome}`] : []),
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
  const all = { ...schedule, id: "", title: "", left: schedule.goals.reduce((n, g) => n + g.left, 0), estimate: undefined, estimateSet: false };
  const parts = [
    ...(next ? [`next ${next.goal}${next.id ? `/${next.id} ${next.title}` : ""}`] : []),
    ...goals.map((g) => finishText(g, g.id)),
    ...(schedule.goals.length > goals.length || goals.length > 1 ? [finishText(all, "Roadmap")] : []),
  ];
  if (parts.length > 0) lines.push(`Schedule: ${parts.join(" · ")}.`);
  return lines;
}

export function formatStatus(session: SessionStatus, schedule?: Schedule, warnings: string[] = []): string {
  const rules = hardFirst(session.standingInstructions);
  const instructions =
    rules.length > 0
      ? [rules.some((r) => r.hard) ? "Standing Instructions (a HARD RULE must never be broken):" : "Standing Instructions:", ...rules.map((r) => `- ${ruleText(r)}`)]
      : [];
  const timing = [...(schedule ? scheduleLines(schedule, session.held.map((s) => s.goal!.id)) : []), ...warnings];
  if (session.context) instructions.push("Important context:", session.context);
  if (session.held.length > 1)
    return [
      `This Session holds ${session.held.length} Goals; pass goal (the Goal ID) to the tools that change one.`,
      ...session.held.flatMap(heldGoalLines),
      ...timing,
      ...instructions,
    ].join("\n");
  const s = session.held[0];
  if (!s?.goal) {
    const paused = session.goals.filter((g) => g.status === "paused");
    return [
      paused.length === 1
        ? `No Goal is claimed by this Session. Goal ${paused[0]!.id} ("${paused[0]!.title}") is paused: claim it with claim_goal and carry on.`
        : "No Goal is claimed by this Session. Claim one with claim_goal, or plan one and add it with add_goal (claim: true).",
      ...(session.goals.length > 0 ? ["Goals:", ...session.goals.map(goalLine)] : ["The Roadmap has no Goals yet."]),
      ...timing,
      ...instructions,
    ].join("\n");
  }
  const d = s.openDetour;
  return [
    `Goal: ${s.goal.title} (${s.goal.ref}), claimed by this Session`,
    ...(s.goal.outcome ? [`Outcome: ${s.goal.outcome}`] : []),
    `Plan File: ${s.planFile}`,
    `Progress: ${s.done} of ${s.total} Tasks done`,
    s.currentTask
      ? `Current Task: ${taskLine(s.currentTask)} (${s.planFile}:${s.currentTask.line})`
      : "Current Task: none (start one with start_task)",
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

/**
 * The rules as a block to paste into a helper agent's brief: hard rules first, then the others.
 * A helper does not see the Standing Instructions, but it is bound by them.
 */
export function formatRules(instructions: StandingInstruction[]): string {
  if (instructions.length === 0) return "No Standing Instructions are set for this project, so there is no rules block to add to the brief.";
  const hard = instructions.filter((i) => i.hard);
  const other = instructions.filter((i) => !i.hard);
  const limit = helperLimit(instructions);
  return [
    "Project rules from the Developer. Follow all of them in this work.",
    ...(hard.length > 0
      ? ["HARD RULES: never break these. If the work seems to need breaking one, stop and report back instead.", ...hard.map((i) => `- ${i.text}`)]
      : []),
    ...(other.length > 0 ? [...(hard.length > 0 ? ["Other rules:"] : []), ...other.map((i) => `- ${i.text}`)] : []),
    ...(limit ? [`Parallel limit: at most ${limit.limit} helper agents work on this project at once, counting you, so do not start helper agents of your own.`] : []),
    "Do not edit anything in .progressor/; the Agent that briefed you keeps the plan there.",
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
export function helperWarning(p: Pick<Project, "helperLoad">): string[] {
  const { busy, limit, rule } = p.helperLoad();
  if (limit === undefined || busy <= limit) return [];
  return [
    `Warning: ${busy} Tasks are now with a helper, over this project's limit of ${limit} at once (${rule!.id}: "${rule!.text}"). ` +
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
        `Goal ${g.id}: ${g.title} (${g.status})`,
        ...(g.outcome ? [`Outcome: ${g.outcome}`] : []),
        ...(g.reason ? [`Reason: ${g.reason}`] : []),
        `Ref: ${g.ref}`,
        `Roadmap line: ${where}`,
        `Plan File: ${found.planFile}`,
        ...(g.claim ? [`Claimed by: Session ${g.claim.session}${g.claim.since ? ` since ${g.claim.since}` : ""}`] : []),
        ...goalTime(g, schedule?.goals.find((x) => x.id === g.id)),
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
        ...timeLine(t, now),
      ].join("\n");
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

/** The helper info a state change was given, or nothing when none was. */
function helperOf(branch?: string, folder?: string, label?: string): HelperInfo | undefined {
  const h: HelperInfo = { ...(branch?.trim() ? { branch } : {}), ...(folder?.trim() ? { folder } : {}), ...(label?.trim() ? { label } : {}) };
  return Object.keys(h).length > 0 ? h : undefined;
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
}

/** Another project's plan, as get_status shows it when given project: read-only, for changing it from here. */
export function formatOtherProject(other: Project, name: string): string {
  const roadmap = other.roadmap();
  const lines = roadmap.goals.map((g) => {
    if (other.heldElsewhere(g)) return `- ${g.id}: ${g.title} (${g.status}; an AI chat in that project is working on it, so only add_note can change it)`;
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

export function createServer(project: Project, options: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: "progressor", version: VERSION }, { instructions: INSTRUCTIONS });
  // What the Developer wrote on the dashboard to the Goals this Session holds, now marked as shown.
  const takeNews = () =>
    newsLines(
      project
        .claimedGoals()
        .filter((g) => project.hasNewFromDeveloper(g.id))
        .map((g) => ({ goal: g.id, from: project.takeNewFromDeveloper(g.id) })),
    );
  const status = () => {
    const news = takeNews();
    const session = project.sessionStatus();
    const held = new Set(session.held.map((s) => s.goal!.id));
    // Goals nobody is working on: said, but left unseen for the Session that claims them.
    const unheld = project
      .roadmap()
      .goals.filter((g) => !held.has(g.id) && g.status !== "dropped" && !project.heldElsewhere(g))
      .map((g) => {
        try {
          const plan = project.plan(g.id);
          return { goal: g.id, messages: plan.messages.filter((m) => m.state === "new").length, answers: plan.questions.filter((q) => q.state === "answered" && !q.seen).length };
        } catch {
          return { goal: g.id, messages: 0, answers: 0 };
        }
      });
    const elsewhereNews = elsewhereNewsLine(unheld);
    const text = [
      ...news,
      ...(elsewhereNews ? [elsewhereNews] : []),
      formatStatus(session, project.schedule(), [...project.helperWarnings(), ...resourceLines(project.resources().list(), project.now())]),
    ].join("\n");
    // The Developer's new hand-test marks are now shown, so the next status calls only later ones new.
    for (const s of session.held) if (s.handTests.some((h) => h.result !== "pending" && !h.seen)) project.acknowledgeHandTests(s.goal!.id);
    return text;
  };
  // Apps without Claude Code's hooks never hand the Agent the plan between calls, so results that
  // don't show the whole status end with where the work stands.
  const withNow = (text: string) => `${text}\n${nowLine(project.sessionStatus())}`;
  const { dashboard, registryFile } = options;
  // The plan a tool acts on: this project's, or with `project` another one's, changed from here.
  const planOf = (wanted: string | undefined): Project => {
    if (!wanted?.trim()) return project;
    const target = resolveProject(wanted, { registryFile });
    return sameFolder(target.root, project.root) ? project : project.elsewhere(target.root, projectEntry(project.root).name);
  };
  // Every tool holds the plan it acts on while it reads and rewrites it (lock.ts).
  // Every reply on this project's plan ends with anything new from the Developer (get_status puts it first).
  const respondIn = (wanted: string | undefined, body: (p: Project) => string) =>
    respond(() => {
      const p = planOf(wanted);
      return withLock(p.root, () => {
        const text = body(p);
        if (p !== project) return text;
        const news = takeNews();
        return news.length > 0 ? `${text}\n${news.join("\n")}` : text;
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
        "Compact summary of every Goal this Session holds (current Task, open Detour, Tasks with a helper or waiting on the Developer, next Task, decisions and open notes) and the Developer's Standing Instructions. Call it at the start of every conversation and after context compression. With project, another project's Goals and Tasks instead, to change them from here.",
      inputSchema: { project: otherProject },
      annotations: { readOnlyHint: true },
    },
    async ({ project: wanted }) => {
      // The Session serving the dashboard may have ended; if so, this one takes over.
      await dashboard?.refresh().catch(() => undefined);
      return respondIn(wanted, (p) => {
        if (p !== project) return formatOtherProject(p, nameOf(p));
        const elsewhere = takeElsewhereLine(project, seenFile(registryFile));
        return [
          status(),
          ...(elsewhere ? [elsewhere] : []),
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
      inputSchema: { ref: z.string().describe("A ref such as progressor://login/t2 or progressor://roadmap/i1.") },
      annotations: { readOnlyHint: true },
    },
    ({ ref }) => respondIn(undefined, () => formatItem(project.getItem(ref), project.schedule())),
  );

  server.registerTool(
    "get_rules",
    {
      title: "Get rules",
      description:
        "The project's Standing Instructions as a block to paste into the brief of a helper agent you start, hard rules first. Helpers don't see the Standing Instructions, so include this block whenever you brief one.",
      annotations: { readOnlyHint: true },
    },
    () => respondIn(undefined, () => formatRules(project.roadmap().standingInstructions)),
  );

  server.registerTool(
    "add_goal",
    {
      title: "Add Goal",
      description:
        "Add a Goal to the end of the Roadmap, with an optional Task list and Outcome; with claim: true, also claim it to start work. A title another Goal already has is refused unless allow_duplicate is set. To record work already finished, set done on the Goal and on every Task.",
      inputSchema: {
        title: z.string().min(1).describe("A few words naming the Goal, such as 'Ship OAuth login'."),
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
        claim: z.boolean().optional().describe("Claim the new Goal straight away, to start working on it."),
        project: otherProject,
      },
    },
    ({ title, id, outcome, estimate, tasks, allow_duplicate, done, claim, project: wanted }) =>
      respondIn(wanted, (p) => {
        if (p !== project && claim)
          throw new Error("A Goal added to another project's plan cannot be claimed from here; leave out claim (or record finished work with done).");
        const goal = p.addGoal(title, newTasks(tasks), { id, outcome, estimate: readEstimate(estimate) ?? undefined, allowDuplicate: allow_duplicate, done });
        const n = tasks?.length ?? 0;
        if (p !== project)
          return doneIn(p, done ? `Recorded finished Goal ${goal.id} (${goal.ref}) with ${n} done Tasks.` : `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks.`);
        if (done) return `Recorded finished Goal ${goal.id} (${goal.ref}) with ${n} done Tasks.`;
        if (claim) {
          project.claimGoal(goal.id);
          return `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks, claimed by this Session.\n\n${status()}`;
        }
        return `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks. Claim it with claim_goal to work on it.`;
      }),
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update Goal",
      description:
        "Rename a Goal, set its Outcome or its estimate. Its ID, refs and Plan File stay the same, and it needs no Claim. To change a Goal's Tasks, claim it and use add_tasks, update_task or drop_task.",
      inputSchema: {
        goal: goalId,
        title: z.string().min(1).optional().describe("The new title."),
        outcome: outcome.optional().describe("The new Outcome; an empty string removes it."),
        estimate: estimateText
          .optional()
          .describe("How long the whole Goal should take, such as '6h'; it covers the open Tasks that have no estimate of their own. An empty string removes it, so the Goal's estimate is the sum of its Tasks'."),
        project: otherProject,
      },
    },
    ({ goal, title, outcome, estimate, project: wanted }) =>
      respondIn(wanted, (p) => {
        const g = p.updateGoal(goal, { title, outcome, estimate: readEstimate(estimate) });
        const item = formatItem(p.getItem(g.ref), p.schedule());
        return p === project ? item : doneIn(p, item);
      }),
  );

  server.registerTool(
    "move_goal",
    {
      title: "Move Goal",
      description:
        "Move a Goal right before or after another Goal, so the Roadmap lists the work in the order it should happen. Give exactly one of before and after.",
      inputSchema: {
        goal: goalId,
        before: z.string().optional().describe("The ID of the Goal to move it in front of."),
        after: z.string().optional().describe("The ID of the Goal to move it behind."),
        project: otherProject,
      },
    },
    ({ goal, before, after, project: wanted }) =>
      respondIn(wanted, (p) => {
        const order = ["Goals in order:", ...p.moveGoal(goal, { before, after }).map(goalLine)].join("\n");
        return p === project ? order : doneIn(p, order);
      }),
  );

  server.registerTool(
    "drop_goal",
    {
      title: "Drop Goal",
      description:
        "Drop a Goal that will not be done, with the reason; its Plan File stays as a record. Releases this Session's Claim on it. A Goal another running Session holds, or one already done, cannot be dropped. To drop a single Task, use drop_task.",
      inputSchema: { goal: goalId, reason: z.string().min(1).describe("Why the Goal will not be done.") },
    },
    ({ goal, reason }) =>
      respondIn(undefined, () => {
        const g = project.dropGoal(goal, reason);
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
        return status();
      }),
  );

  server.registerTool(
    "claim_resource",
    {
      title: "Claim resource",
      description:
        "Claim a named shared resource that only one session or helper can use at a time (a dev window that allows a single instance, plasmashell, a port), before you or a helper start something that needs it. Refused, saying who holds it, since when and why, when someone else has it: then do not start it; do other work and try again later (nothing waits for you). Claiming your own resource again refreshes its time. It frees itself after `minutes` (30 unless given, at most 240) from the last claim, when its Session ends, or when you release it. A helper usually cannot call Progressor: claim on its behalf before you start it, with label such as 'helper: media run', and call release_resource when it hands back.",
      inputSchema: {
        resource: resourceName,
        reason: z.string().max(300).describe("Why you need it, in a few words, such as 'running the UI test'. Shown to whoever is refused."),
        label: resourceLabel,
        task: z.string().max(40).optional().describe("The Task ID it is for, such as 't3'."),
        minutes: z.number().min(1).max(240).optional().describe("How long to keep it before it frees itself, from now. 30 if omitted; claim again to extend."),
      },
    },
    ({ resource, reason, label, task, minutes }) =>
      respondIn(undefined, () => {
        const { lock, refreshed } = project.resources().claim(resource, { reason, label, task, minutes });
        return `${refreshed ? "Refreshed" : "Claimed"} ${lock.resource} for ${holderText(lock)}; it frees itself in ${lock.minutes} m. Call release_resource when the work that needs it ends.`;
      }),
  );

  server.registerTool(
    "release_resource",
    {
      title: "Release resource",
      description:
        "Release a shared resource you claimed with claim_resource, as soon as the work that needed it ends (including a helper's: release it when the helper hands back). Pass the same label you claimed it with. Another holder's resource is refused, unless force is given, which is only for when the Developer says the holder is gone.",
      inputSchema: {
        resource: resourceName,
        label: resourceLabel,
        force: z.boolean().optional().describe("Release it even though someone else holds it. Only when the Developer asks."),
      },
    },
    ({ resource, label, force }) =>
      respondIn(undefined, () =>
        project.resources().release(resource, { label, force })
          ? `Released ${resource.trim().toLowerCase().replace(/\s+/g, "-")}.`
          : `${resource} was not held, so there is nothing to release.`,
      ),
  );

  server.registerTool(
    "list_resources",
    {
      title: "List resources",
      description: "Who holds which shared resource now, for how long, and why. get_status shows the same. Resources whose time is up or whose Session has ended are free and not listed.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respondIn(undefined, () => (project.resources().list().length > 0 ? resourceLines(project.resources().list(), project.now()).join("\n") : "Nothing is in use.")),
  );

  server.registerTool(
    "release_goal",
    {
      title: "Release Goal",
      description: "Release this Session's Claim on a Goal, leaving it paused for a later Session.",
      inputSchema: { goal: heldGoal },
    },
    ({ goal: id }) =>
      respondIn(undefined, () => {
        const goal = project.releaseGoal(id);
        return goal ? `Released Goal ${goal.id}; it is now paused.` : "This Session had no Goal to release.";
      }),
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Complete Goal",
      description:
        "Mark the claimed Goal done and release it, once its Outcome is true and its Tasks are done, released or dropped (not with a helper, waiting on the Developer or only checked) and the Developer has marked every hand test (add_hand_test) on the dashboard; unmarked_hand_tests_ok overrides that only when the Developer says to finish anyway. If more work turns up later, claim_goal reopens it.",
      inputSchema: {
        goal: heldGoal,
        unmarked_hand_tests_ok: z
          .boolean()
          .optional()
          .describe("Finish even though some hand tests are still not marked by the Developer. Only when the Developer says to finish anyway."),
        project: otherProject,
      },
    },
    ({ goal: id, unmarked_hand_tests_ok, project: wanted }) =>
      respondIn(wanted, (p) => {
        const options = { unmarkedHandTests: unmarked_hand_tests_ok };
        if (p !== project) return doneIn(p, `Goal ${p.completeGoal(id, options).id} is done.`);
        const goal = project.completeGoal(id, options);
        return `Goal ${goal.id} is done. Tell the Developer in one plain sentence that "${goal.title}" is finished${dashboard?.url ? `, and that they can see it at ${dashboard.url}` : ""}.`;
      }),
  );

  server.registerTool(
    "add_tasks",
    {
      title: "Add Tasks",
      description:
        "Append Tasks to the claimed Goal's plan, each with an estimate of how long it takes. For work that is not part of the plan, declare a Detour instead. Set done on a Task that is already finished.",
      inputSchema: { goal: heldGoal, tasks: z.array(newTaskInput).min(1), project: otherProject },
    },
    ({ goal, tasks, project: wanted }) =>
      respondIn(wanted, (p) => {
        const added = p.addTasks(newTasks(tasks), goal);
        return doneIn(p, `Added: ${added.map(taskLine).join("; ")}`);
      }),
  );

  server.registerTool(
    "start_task",
    {
      title: "Start Task",
      description:
        "Mark a Task in progress: you are working on it yourself. Only one Task of a Goal can be in progress at a time; for Tasks in other hands, use set_task_state.",
      inputSchema: { goal: heldGoal, task: taskId },
    },
    ({ goal, task }) =>
      respondIn(undefined, () => {
        project.startTask(task, goal);
        return status();
      }),
  );

  server.registerTool(
    "set_task_state",
    {
      title: "Set Task state",
      description:
        "Set a Task's state. 'with a helper': handed to a helper agent that is working on it (several Tasks can be). 'waiting on you': you are waiting on the Developer, such as for them to test something by hand; the dashboard shows the Goal as waiting on them, so tell them what you need. 'checked': you checked a helper's work (tests, review) but it is not merged or released yet; give evidence, one short line on what you checked (\"715 passed, live send OK\"), which the Developer sees on the step. With 'with a helper', give helper_branch, helper_folder (the worktree path) and helper_label: they are recorded with the Task and shown in get_status and on the dashboard, and get_status warns when a finished Task's helper branch still has unmerged work. 'released': merged and out (shipped, installed or published); counts as done. 'pending', 'in progress' and 'done' work too (in progress follows start_task's one-at-a-time rule). Set a state as soon as it changes, such as 'checked' right after you check a helper's work, so the Developer's dashboard keeps moving. If the project has a helper limit (get_status shows it), keep at most that many Tasks with a helper: one more is still set, with a warning. To drop a Task, use drop_task.",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        state: z.enum(states),
        helper_branch: helperBranch,
        helper_folder: helperFolder,
        helper_label: helperLabel,
        evidence,
        project: otherProject,
      },
    },
    ({ goal, task, state, helper_branch, helper_folder, helper_label, evidence: proof, project: wanted }) =>
      respondIn(wanted, (p) => {
        const t = p.setTaskState(task, state, goal, { helper: helperOf(helper_branch, helper_folder, helper_label), evidence: proof });
        const said = [`Task ${taskLine(t)} is now ${t.status}.`, ...tookLine([t], new Date()), ...(state === "with a helper" ? helperWarning(p) : [])];
        return doneIn(p, said.join("\n"));
      }),
  );

  const operation = z.object({
    helper_branch: helperBranch,
    helper_folder: helperFolder,
    helper_label: helperLabel,
    evidence,
    action: z
      .enum(["start", "complete", "state", "drop", "estimate"])
      .describe("start: mark in progress. complete: mark done. state: set the state given in state. drop: drop it, with reason. estimate: only set its estimate."),
    task: taskId,
    goal: heldGoal,
    state: z.enum(states).optional().describe("For action 'state': the new state, as in set_task_state."),
    reason: z.string().optional().describe("For action 'drop': why the Task is no longer needed."),
    code: z.array(z.string()).optional().describe("For action 'complete': files the Task touched, optionally with :line."),
    summary: taskInput.shape.summary,
    estimate: estimateText.optional().describe("The Task's new estimate, such as '45m' or '2h' (any action; needed for 'estimate'); an empty string removes it."),
  });
  server.registerTool(
    "update_tasks",
    {
      title: "Update Tasks",
      description:
        "Change several Tasks in one call, such as completing two and starting the next, or setting the estimates of several, instead of one call each. The operations are applied in order, so a start can follow the complete of the Task that was in progress; if any one fails, none is applied. A 'state' operation takes the same helper_branch, helper_folder, helper_label (with 'with a helper') and evidence (with 'checked') as set_task_state. Each operation can name its own claimed Goal with goal, else the call's goal (or the only Goal held) is used. Answers with one line per call, not the whole status.",
      inputSchema: { goal: heldGoal, operations: z.array(operation).min(1).max(25), project: otherProject },
    },
    ({ goal, operations, project: wanted }) =>
      respondIn(wanted, (p) => {
        const held = p !== project || project.claimedGoals().length > 1;
        const ops: TaskOperation[] = operations.map(({ estimate, helper_branch, helper_folder, helper_label, ...op }) => {
          const helper = helperOf(helper_branch, helper_folder, helper_label);
          return { ...op, ...(helper ? { helper } : {}), estimate: readEstimate(estimate) };
        });
        const changed = p.updateTasks(ops, goal);
        const now = new Date();
        // An estimate set in this call is said back; the others are left out, to keep the answer short.
        const est = (t: Task, i: number) => (operations[i]!.estimate !== undefined ? `, estimated ${t.estimate !== undefined ? sayDuration(t.estimate) : "none"}` : "");
        return doneIn(
          p,
          [
            `Updated: ${changed.map((c, i) => `${held ? `${c.goal}/` : ""}${taskLine(c.task)} is ${c.task.status}${est(c.task, i)}`).join("; ")}.`,
            ...tookLine(
              changed.filter((c, i) => operations[i]!.action === "complete").map((c) => c.task),
              now,
            ),
            ...(operations.some((o) => o.state === "with a helper") ? helperWarning(p) : []),
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
    "complete_task",
    {
      title: "Complete Task",
      description:
        "Mark a Task of the claimed Goal done, recording the files it touched and, if it changed, the final summary of what it did. Works whether or not the Task was started. For a Task that turned out unnecessary, use drop_task instead; to change a Task without finishing it, use update_task.",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        code: z.array(z.string()).optional().describe("Files the Task touched, optionally with :line; added to the ones it has."),
        summary: taskInput.shape.summary,
        project: otherProject,
      },
    },
    ({ goal, task, code, summary, project: wanted }) =>
      respondIn(wanted, (p) => {
        const t = p.completeTask(task, code ?? [], summary, goal);
        if (p !== project) return doneIn(p, [`Task ${taskLine(t)} is now ${t.status}.`, ...tookLine([t], new Date())].join("\n"));
        return [...tookLine([t], new Date()), status()].join("\n");
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
    "drop_task",
    {
      title: "Drop Task",
      description:
        "Drop one Task of the claimed Goal that is no longer needed, with the reason; it stays in the Plan File, struck through. To replace the whole remaining plan, end a Detour with 'recalibrate' instead; to drop the whole Goal, use drop_goal.",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        reason: z.string().min(1).describe("Why the Task is no longer needed."),
      },
    },
    ({ goal, task, reason }) =>
      respondIn(undefined, () => {
        project.dropTask(task, reason, goal);
        return status();
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
        title: z.string().min(1).describe("What the Detour does, such as 'Fix flaky token refresh'."),
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
          "",
          status(),
        ].join("\n");
      }),
  );

  server.registerTool(
    "add_decision",
    {
      title: "Add decision",
      description:
        "Record a choice made for a claimed Goal along the way, such as 'old models get thinking on/off only', so it survives context compression; get_status shows it. Not for lasting project rules (add_standing_instruction) or project-wide background (update_context).",
      inputSchema: { goal: heldGoal, text: z.string().min(1).describe("The decision, in one line."), project: otherProject },
    },
    ({ goal, text, project: wanted }) =>
      respondIn(wanted, (p) => {
        const d = p.addDecision(text, goal);
        return doneIn(p, `Saved decision ${d.id} in Goal ${goal ?? project.claimedGoal()?.id}: ${d.text}`);
      }),
  );

  server.registerTool(
    "update_decision",
    {
      title: "Update decision",
      description: "Reword a decision of a claimed Goal, or remove it with an empty text. The IDs (c1, c2...) are in get_status.",
      inputSchema: {
        goal: heldGoal,
        id: z.string().describe("The decision ID, such as 'c2'."),
        text: z.string().describe("The new wording; empty to remove the decision."),
      },
    },
    ({ goal, id, text }) =>
      respondIn(undefined, () => {
        const d = project.updateDecision(id, text, goal);
        return d ? `Changed decision ${d.id}: ${d.text}` : `Removed decision ${id}.`;
      }),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description:
        "Note something you spotted that belongs to a Goal, such as a bug found during cleanup that belongs to the Voice Goal, instead of dealing with it now. Any Goal on the Roadmap that is not dropped, claimed or not. get_status shows the open notes of the Goals this Session holds.",
      inputSchema: {
        goal: goalId.describe("The ID of the Goal the note belongs to."),
        text: z.string().min(1).describe("What you spotted, in one line."),
        project: otherProject,
      },
    },
    ({ goal, text, project: wanted }) =>
      respondIn(wanted, (p) => {
        const n = p.addNote(goal, text);
        return doneIn(p, `Saved note ${n.id} in Goal ${goal}: ${n.text}`);
      }),
  );

  server.registerTool(
    "update_note",
    {
      title: "Update note",
      description:
        "Resolve a note once it is dealt with (resolved: true), reopen it (false), reword it, or remove it with an empty text.",
      inputSchema: {
        goal: goalId.describe("The ID of the Goal the note belongs to."),
        id: z.string().describe("The note ID, such as 'n2'."),
        text: z.string().optional().describe("The new wording; empty to remove the note."),
        resolved: z.boolean().optional().describe("true once the note is dealt with; false to reopen it."),
        project: otherProject,
      },
    },
    ({ goal, id, text, resolved, project: wanted }) =>
      respondIn(wanted, (p) => {
        const n = p.updateNote(goal, id, { text, resolved });
        const said = n ? `${resolved === true ? "Resolved" : resolved === false ? "Reopened" : "Changed"} note ${n.id}: ${n.text}` : `Removed note ${id}.`;
        return p === project ? said : doneIn(p, said);
      }),
  );

  server.registerTool(
    "ask_developer",
    {
      title: "Ask the Developer",
      description:
        "Ask the Developer a question on the dashboard, with 2 to 4 short choices they can click (they can also answer in their own words), instead of stopping in the chat. Use it for product and UX choices only they can make; carry on with other work meanwhile. Their answer reaches you at your next Progressor call, under 'New from the Developer', and is kept as a decision on the Goal. While a question is open the dashboard shows the Goal as waiting on them. To take back a question that no longer needs an answer, pass withdraw with its ID instead.",
      inputSchema: {
        goal: heldGoal,
        question: z.string().max(500).optional().describe("The question, in one plain sentence a non-programmer understands."),
        choices: z.array(z.string().max(200)).max(4).optional().describe("2 to 4 short answers to pick from, such as ['On by default', 'Follow the computer']."),
        task: z.string().optional().describe("The ID of the Task it is about, such as 't3'."),
        withdraw: z.string().optional().describe("The ID of an open question to withdraw (such as 'q2'), instead of asking a new one."),
      },
    },
    ({ goal, question, choices, task, withdraw }) =>
      respondIn(undefined, () => {
        if (withdraw) return withNow(`Withdrew question ${project.withdrawQuestion(withdraw, goal).id}.`);
        if (!question) throw new Error("Give the question and its choices, or withdraw with a question ID.");
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
        "Answer a message the Developer sent you on the dashboard (shown under 'New from the Developer' with its ID, such as m2): say in a sentence or two, in plain words, what you did or will do about it. The reply shows under their message on the dashboard. Reply to every message, even if only to say you will do it later.",
      inputSchema: {
        goal: heldGoal,
        message: z.string().describe("The message ID, such as 'm2'."),
        reply: z.string().max(2000).describe("Your answer, in plain words for someone who doesn't code."),
      },
    },
    ({ goal, message, reply }) =>
      respondIn(undefined, () => {
        const m = project.replyToDeveloper(message, reply, goal);
        return withNow(`Replied to message ${m.id}. The Developer sees it on the dashboard.`);
      }),
  );

  server.registerTool(
    "add_hand_test",
    {
      title: "Add hand test",
      description:
        "Add something only the Developer can try by hand to a claimed Goal, such as 'OpenCode may ask permission to read an attached file: allow it and check the reply'. Put it here instead of in your chat summary: the Developer sees the Goal's hand-test list on the dashboard and marks each one there as works, doesn't work (with a note) or won't test. A failure adds a Task to the Goal by itself; get_status shows what is still open and the new marks. A Goal cannot be completed while a hand test is unmarked.",
      inputSchema: {
        goal: heldGoal,
        text: z.string().min(1).describe("What to try and what to look for, in one or two short plain sentences."),
        task: z.string().optional().describe("The ID of the Task it is about, such as 't3'."),
      },
    },
    ({ goal, text, task }) =>
      respondIn(undefined, () => {
        const h = project.addHandTest(text, goal, task);
        return withNow(`Saved hand test ${h.id}: ${h.text}\nThe Developer marks it on the dashboard.`);
      }),
  );

  server.registerTool(
    "update_hand_test",
    {
      title: "Update hand test",
      description:
        "Reword a hand test of the claimed Goal, change which Task it is about, or remove it with an empty text (for one that turned out not to need testing). Its mark from the Developer stays; only the Developer marks tests.",
      inputSchema: {
        goal: heldGoal,
        id: z.string().describe("The hand test ID, such as 'h2'."),
        text: z.string().optional().describe("The new wording; empty to remove the hand test."),
        task: z.string().optional().describe("The ID of the Task it is about; an empty string removes the link."),
      },
    },
    ({ goal, id, text, task }) =>
      respondIn(undefined, () => {
        const h = project.updateHandTest(id, { text, task }, goal);
        return withNow(h ? `Changed hand test ${h.id}: ${h.text}` : `Removed hand test ${id}.`);
      }),
  );

  server.registerTool(
    "add_standing_instruction",
    {
      title: "Add Standing Instruction",
      description:
        "Save a lasting rule from the Developer about how you should work in this project, such as 'ask me before changing the plan'. get_status lists it from then on. Use it only for rules meant to last; a one-off request is just done.",
      inputSchema: {
        text: z.string().min(1).describe("The rule, in the Developer's words where possible."),
        hard: hardFlag,
        helpers_at_once: helpersAtOnce,
      },
    },
    ({ text, hard, helpers_at_once }) =>
      respondIn(undefined, () => {
        const s = project.addStandingInstruction(text, hard, helpers_at_once || undefined);
        return withNow(`Saved ${s.hard ? "HARD RULE" : "Standing Instruction"} ${s.id}: ${s.text}${limitText(s)}`);
      }),
  );

  server.registerTool(
    "update_standing_instruction",
    {
      title: "Update Standing Instruction",
      description:
        "Reword a Standing Instruction when the Developer changes a rule, make it a hard rule (hard: true) or an ordinary one again (hard: false), set or change the helper limit it holds (helpers_at_once), or remove it with an empty text when they drop it. Give any of text, hard and helpers_at_once; what you leave out stays. The IDs (s1, s2...) are in get_status.",
      inputSchema: {
        id: z.string().describe("The Standing Instruction ID, such as 's2'."),
        text: z.string().optional().describe("The new wording; empty to remove the rule. Left out, the wording stays."),
        hard: hardFlag,
        helpers_at_once: helpersAtOnce,
      },
    },
    ({ id, text, hard, helpers_at_once }) =>
      respondIn(undefined, () => {
        const s = project.updateStandingInstruction(id, { text, hard, helpersAtOnce: helpers_at_once });
        return s ? `Changed ${s.hard ? "HARD RULE" : "Standing Instruction"} ${s.id}: ${s.text}${limitText(s)}` : `Removed Standing Instruction ${id}.`;
      }),
  );

  server.registerTool(
    "update_context",
    {
      title: "Update Important context",
      description:
        "Replace the project's Important context: lasting background you and the Developer need in every conversation, such as what the project is, key facts, where things live and choices that hold for the whole project. " +
        "Not for rules (add_standing_instruction) or for one Goal's details. get_status shows the current text: send the whole new text, or an empty text to clear it. " +
        `At most ${MAX_CONTEXT_LENGTH} characters.`,
      inputSchema: { text: z.string().describe("The whole Important context, in plain words; short paragraphs or a list.") },
    },
    ({ text }) =>
      respondIn(undefined, () => {
        const context = project.setContext(text);
        return context
          ? `Saved the Important context (${context.length} of ${MAX_CONTEXT_LENGTH} characters).`
          : "Cleared the Important context.";
      }),
  );

  // Slash commands: Claude Code lists them in its / menu as /<server name>:status (MCP) and so on.
  const message = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "status",
    { title: "Progressor status", description: "Where the work stands: the Goals, their Outcomes, the current Tasks, any open Detour and what comes next." },
    () => message(statusPrompt(status())),
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
    () => message(setupPrompt(project.root, launchFor({ viaNpx: startedViaNpx(), platform: process.platform }))),
  );

  server.registerPrompt(
    "next",
    { title: "Pick up the work", description: "Carry on where the plan left off: the open Detour, the Task in progress, or the next Task, claiming a Goal if needed." },
    () => message(nextPrompt(project.sessionStatus(), status())),
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
