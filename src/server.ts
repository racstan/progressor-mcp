import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { Dashboard } from "./dashboard/http.js";
import { launchFor, startedViaNpx } from "./init.js";
import type { Decision, Detour, Note, Task, TaskStatus } from "./planFile.js";
import { type DetourEnding, type FoundItem, MAX_CONTEXT_LENGTH, type Project, type SessionStatus, type Status } from "./project.js";
import { dashboardPrompt, nextPrompt, planPrompt, reviewPrompt, setupPrompt, statusPrompt } from "./prompts.js";
import type { Goal } from "./roadmap.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export const INSTRUCTIONS = `Progressor keeps the plan for this project in .progressor/ and shows it to the Developer on a live dashboard. Change the plan only with these tools, never by editing those files. The Developer may not be a programmer: you run the plan, they watch.

1. First thing in every conversation, and again after your context is compressed or summarised, call get_status. Follow the Standing Instructions it lists.
2. No Goal claimed? If get_status says one Goal is paused, claim it and carry on. When the Developer asks for work no Goal covers, plan it yourself as a Goal: a short title, an Outcome (one sentence on what done looks like) and Tasks, each with a short title, the files it touches and a one-line summary of the change. Tell the Developer the plan in a few plain lines, then call add_goal with claim: true. A quick question needs no Goal.
3. Before you change code for a Task, call start_task; call complete_task when it is done, with the files you touched. Keep summaries true with update_task, and drop_task what is no longer needed. You work on one Task of a Goal at a time; set_task_state records the rest: "with a helper" when you hand a Task to a helper agent (several can be), "waiting on you" when you need the Developer (to test something by hand, to decide; tell them what you need), "checked" once you have checked a helper's work (tests, review) but it is not merged yet, and "released" once it is merged and out (shipped, installed, published).
3a. You can hold several Goals at once, for instance with helper agents on different Goals: claim each one. While you hold more than one, pass goal (the Goal ID) to the tools that change a Goal.
4. About to change code for something that is not the current Task (an unrelated bug, a missing prerequisite, a change of plan)? Call start_detour with the reason first. When it is done, call end_detour: "merge back" for a small fix, "return" to go back to the plan (adding Tasks for any work left), or "recalibrate" to replace the remaining Tasks with a new list.
5. When every Task is done, released or dropped and the Outcome is true, call complete_goal and tell the Developer in one sentence. If more work turns up for a finished Goal, claim it again to reopen it, then add_tasks.
6. Talk to the Developer in everyday words: say "step" for Task and "side trip" for Detour, and leave out tool names, IDs and the files in .progressor/. Give them the dashboard link from get_status once at the start of a conversation, and again when a Goal is finished.
7. When the Developer gives a lasting rule ("always...", "never..."), save it with add_standing_instruction; change or remove one with update_standing_instruction.
8. Keep lasting background about the project on its Important context page with update_context: what the project is, key facts, where things live, choices that hold for the whole project. get_status shows it; keep it short and true.
9. Record a choice made along the way that is not a lasting project rule (such as "old models get thinking on/off only") with add_decision, so it survives context compression. When you spot something that belongs to a Goal, this one or another (a bug found during cleanup that belongs to the Voice Goal), add_note on that Goal instead of fixing it now; once it is dealt with, resolve it with update_note.`;

const taskInput = z.object({
  title: z.string().min(1).describe("A short title for the Task, a few words, such as 'Fix callback redirect loop'."),
  summary: z
    .string()
    .optional()
    .describe("One or two sentences on the fix or change the Task makes, such as 'Callback re-sets the session cookie on every hit; only set it after token exchange.'"),
  code: z.array(z.string()).optional().describe("Files the Task touches, optionally with :line."),
});

/** A Task being added, which may already be done when past work is recorded. */
const newTaskInput = taskInput.extend({
  done: z.boolean().optional().describe("Add the Task already done, for work finished before it was recorded."),
});

const goalId = z.string().describe("The Goal ID, such as 'ship-oauth-login'.");
/** The claimed Goal a tool acts on; only needed while the Session holds several. */
const heldGoal = z
  .string()
  .optional()
  .describe("The claimed Goal's ID, such as 'ship-oauth-login'. Needed only when this Session holds several Goals.");
const taskId = z.string().describe("The Task ID, such as 't3'.");
const states = ["pending", "in progress", "with a helper", "waiting on you", "checked", "done", "released"] as const satisfies readonly TaskStatus[];
const outcome = z
  .string()
  .describe("What done looks like, in one sentence, such as 'Users can sign in with Google and stay signed in for 30 days'.");

function goalLine(g: Goal): string {
  return `- ${g.id}: ${g.title} (${g.status})`;
}

function taskLine(t: Task): string {
  return `${t.id} ${t.title}`;
}

const summaryLine = (t: Task | undefined) => (t?.summary ? [`  Summary: ${t.summary}`] : []);
const noteText = (n: Note) => `${n.id} ${n.text}${n.from ? ` (from ${n.from})` : ""}`;
const decisionText = (d: Decision) => `${d.id} ${d.text}`;

/** The Tasks in other hands than the Agent's: a helper's, or the Developer's. */
function elsewhereLines(s: Status): string[] {
  const line = (label: string, tasks: Task[]) => (tasks.length > 0 ? [`${label}: ${tasks.map(taskLine).join("; ")}`] : []);
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
    ].map((line) => `  ${line}`),
  ];
}

export function formatStatus(session: SessionStatus): string {
  const instructions =
    session.standingInstructions.length > 0
      ? ["Standing Instructions:", ...session.standingInstructions.map((i) => `- ${i.id} ${i.text}`)]
      : [];
  if (session.context) instructions.push("Important context:", session.context);
  if (session.held.length > 1)
    return [
      `This Session holds ${session.held.length} Goals; pass goal (the Goal ID) to the tools that change one.`,
      ...session.held.flatMap(heldGoalLines),
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
    ...instructions,
  ].join("\n");
}

function formatDetour(d: Detour): string {
  return `Detour ${d.id}: ${d.title} (${d.status})${d.branchedFrom ? `, branched from ${d.branchedFrom}` : ""}. Reason: ${d.reason ?? "none given"}`;
}

export function formatItem(found: FoundItem): string {
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
        ...(t.addedBy ? [`Added by Detour ${t.addedBy}`] : []),
        ...(t.droppedBy ? [`Dropped by Detour ${t.droppedBy}`] : []),
        ...(t.reason ? [`Reason: ${t.reason}`] : []),
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
      return [`Standing Instruction ${found.item.id}: ${found.item.text}`, `Ref: ${found.ref}`, `Roadmap line: ${where}`].join(
        "\n",
      );
  }
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
  dashboard?: { readonly url: string | undefined; refresh(): Promise<void> };
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
  const status = () => formatStatus(project.sessionStatus());
  // Apps without Claude Code's hooks never hand the Agent the plan between calls, so results that
  // don't show the whole status end with where the work stands.
  const withNow = (text: string) => `${text}\n${nowLine(project.sessionStatus())}`;
  const { dashboard } = options;

  server.registerTool(
    "get_status",
    {
      title: "Get status",
      description:
        "Compact summary of every Goal this Session holds (current Task, open Detour, Tasks with a helper or waiting on the Developer, next Task, decisions and open notes) and the Developer's Standing Instructions. Call it at the start of every conversation and after context compression.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      // The Session serving the dashboard may have ended; if so, this one takes over.
      await dashboard?.refresh().catch(() => undefined);
      return respond(() =>
        [
          status(),
          `Project folder: ${project.root}`,
          ...(dashboard?.url ? [`Dashboard: ${dashboard.url}`] : []),
        ].join("\n"),
      );
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
    ({ ref }) => respond(() => formatItem(project.getItem(ref))),
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
        tasks: z.array(newTaskInput).optional(),
        allow_duplicate: z.boolean().optional().describe("Add the Goal even though another Goal has the same title."),
        done: z.boolean().optional().describe("Record a Goal that is already finished. Every Task must then have done: true."),
        claim: z.boolean().optional().describe("Claim the new Goal straight away, to start working on it."),
      },
    },
    ({ title, id, outcome, tasks, allow_duplicate, done, claim }) =>
      respond(() => {
        const goal = project.addGoal(title, tasks ?? [], { id, outcome, allowDuplicate: allow_duplicate, done });
        const n = tasks?.length ?? 0;
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
        "Rename a Goal or set its Outcome. Its ID, refs and Plan File stay the same, and it needs no Claim. To change a Goal's Tasks, claim it and use add_tasks, update_task or drop_task.",
      inputSchema: {
        goal: goalId,
        title: z.string().min(1).optional().describe("The new title."),
        outcome: outcome.optional().describe("The new Outcome; an empty string removes it."),
      },
    },
    ({ goal, title, outcome }) =>
      respond(() => {
        const g = project.updateGoal(goal, { title, outcome });
        return formatItem(project.getItem(g.ref));
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
      },
    },
    ({ goal, before, after }) =>
      respond(() => ["Goals in order:", ...project.moveGoal(goal, { before, after }).map(goalLine)].join("\n")),
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
      respond(() => {
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
      respond(() => {
        project.claimGoal(goal, { takeover });
        return status();
      }),
  );

  server.registerTool(
    "release_goal",
    {
      title: "Release Goal",
      description: "Release this Session's Claim on a Goal, leaving it paused for a later Session.",
      inputSchema: { goal: heldGoal },
    },
    ({ goal: id }) =>
      respond(() => {
        const goal = project.releaseGoal(id);
        return goal ? `Released Goal ${goal.id}; it is now paused.` : "This Session had no Goal to release.";
      }),
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Complete Goal",
      description:
        "Mark the claimed Goal done and release it, once its Outcome is true and its Tasks are done, released or dropped (not with a helper, waiting on the Developer or only checked). If more work turns up later, claim_goal reopens it.",
      inputSchema: { goal: heldGoal },
    },
    ({ goal: id }) =>
      respond(() => {
        const goal = project.completeGoal(id);
        return `Goal ${goal.id} is done. Tell the Developer in one plain sentence that "${goal.title}" is finished${dashboard?.url ? `, and that they can see it at ${dashboard.url}` : ""}.`;
      }),
  );

  server.registerTool(
    "add_tasks",
    {
      title: "Add Tasks",
      description:
        "Append Tasks to the claimed Goal's plan. For work that is not part of the plan, declare a Detour instead. Set done on a Task that is already finished.",
      inputSchema: { goal: heldGoal, tasks: z.array(newTaskInput).min(1) },
    },
    ({ goal, tasks }) =>
      respond(() => {
        const added = project.addTasks(tasks, goal);
        return withNow(`Added: ${added.map(taskLine).join("; ")}`);
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
      respond(() => {
        project.startTask(task, goal);
        return status();
      }),
  );

  server.registerTool(
    "set_task_state",
    {
      title: "Set Task state",
      description:
        "Set a Task's state. 'with a helper': handed to a helper agent that is working on it (several Tasks can be). 'waiting on you': you are waiting on the Developer, such as for them to test something by hand; the dashboard shows the Goal as waiting on them, so tell them what you need. 'checked': you checked a helper's work (tests, review) but it is not merged or released yet. 'released': merged and out (shipped, installed or published); counts as done. 'pending', 'in progress' and 'done' work too (in progress follows start_task's one-at-a-time rule). To drop a Task, use drop_task.",
      inputSchema: { goal: heldGoal, task: taskId, state: z.enum(states) },
    },
    ({ goal, task, state }) =>
      respond(() => {
        const t = project.setTaskState(task, state, goal);
        return withNow(`Task ${taskLine(t)} is now ${t.status}.`);
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
      },
    },
    ({ goal, task, code, summary }) =>
      respond(() => {
        project.completeTask(task, code ?? [], summary, goal);
        return status();
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description:
        "Change a Task's title, summary or files, for instance when the fix turns out different from the plan. Leaves its status alone.",
      inputSchema: {
        goal: heldGoal,
        task: taskId,
        title: taskInput.shape.title.optional(),
        summary: taskInput.shape.summary,
        code: z.array(z.string()).optional().describe("The Task's files, optionally with :line; replaces the ones it has."),
      },
    },
    ({ goal, task, title, summary, code }) =>
      respond(() => {
        const t = project.updateTask(task, { title, summary, code }, goal);
        return formatItem(project.getItem(t.ref!));
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
      respond(() => {
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
      respond(() => {
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
      respond(() => {
        const { detour, added, dropped } = project.endDetour(ending, tasks ?? [], goal);
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
      inputSchema: { goal: heldGoal, text: z.string().min(1).describe("The decision, in one line.") },
    },
    ({ goal, text }) =>
      respond(() => {
        const d = project.addDecision(text, goal);
        return withNow(`Saved decision ${d.id} in Goal ${goal ?? project.claimedGoal()?.id}: ${d.text}`);
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
      respond(() => {
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
      inputSchema: { goal: goalId.describe("The ID of the Goal the note belongs to."), text: z.string().min(1).describe("What you spotted, in one line.") },
    },
    ({ goal, text }) =>
      respond(() => {
        const n = project.addNote(goal, text);
        return withNow(`Saved note ${n.id} in Goal ${goal}: ${n.text}`);
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
      },
    },
    ({ goal, id, text, resolved }) =>
      respond(() => {
        const n = project.updateNote(goal, id, { text, resolved });
        if (!n) return `Removed note ${id}.`;
        return `${resolved === true ? "Resolved" : resolved === false ? "Reopened" : "Changed"} note ${n.id}: ${n.text}`;
      }),
  );

  server.registerTool(
    "add_standing_instruction",
    {
      title: "Add Standing Instruction",
      description:
        "Save a lasting rule from the Developer about how you should work in this project, such as 'ask me before changing the plan'. get_status lists it from then on. Use it only for rules meant to last; a one-off request is just done.",
      inputSchema: { text: z.string().min(1).describe("The rule, in the Developer's words where possible.") },
    },
    ({ text }) =>
      respond(() => {
        const s = project.addStandingInstruction(text);
        return withNow(`Saved Standing Instruction ${s.id}: ${s.text}`);
      }),
  );

  server.registerTool(
    "update_standing_instruction",
    {
      title: "Update Standing Instruction",
      description:
        "Reword a Standing Instruction when the Developer changes a rule, or remove it with an empty text when they drop it. The IDs (s1, s2...) are in get_status.",
      inputSchema: {
        id: z.string().describe("The Standing Instruction ID, such as 's2'."),
        text: z.string().describe("The new wording; empty to remove the rule."),
      },
    },
    ({ id, text }) =>
      respond(() => {
        const s = project.updateStandingInstruction(id, text);
        return s ? `Changed Standing Instruction ${s.id}: ${s.text}` : `Removed Standing Instruction ${id}.`;
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
      respond(() => {
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
