import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { Dashboard } from "./dashboard/http.js";
import { launchFor, startedViaNpx } from "./init.js";
import type { Detour, Task } from "./planFile.js";
import type { DetourEnding, FoundItem, Project, Status } from "./project.js";
import { dashboardPrompt, nextPrompt, planPrompt, reviewPrompt, setupPrompt, statusPrompt } from "./prompts.js";
import type { Goal } from "./roadmap.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export const INSTRUCTIONS = `Progressor keeps you and the Developer focused on the same Goal across long sessions, context compression and distractions. The progress record is markdown in .progressor/ that only you change, through these tools; never edit those files directly.

- At the start of every conversation, and again after your context has been compressed or summarised, call get_status before doing anything else. It tells you the Goal you are working on, the current Task, any open Detour, the next Task and the Developer's Standing Instructions. Follow the Standing Instructions.
- If no Goal is claimed, claim the one the Developer wants to work on (claim_goal), or add it (add_goal) with a Task list, an Outcome (one sentence on what done looks like) and, if the title is long, a short id. Complete the Goal once its Outcome is true. When the Developer finds more work in a Goal that is already done, claim it again to reopen it and add the new Tasks there.
- Keep the Roadmap in the order the work should happen: rename a Goal or change its Outcome with update_goal, reorder with move_goal, and drop_goal (with a reason) for one that will not be done.
- To record work that was finished before Progressor tracked it, use add_goal with done: true on the Goal and on each Task, in one call.
- Give every Task a short title (a few words), the files it touches, and a summary: one or two sentences on the fix or change it makes, such as "Callback re-sets the session cookie on every hit; only set it after token exchange." Set them when you add Tasks, and keep them true with update_task as you learn more.
- Mark Tasks as you go: start_task before working on one, complete_task when it is done (pass the files you touched and, if it changed, the final summary), drop_task when it is no longer needed.
- When the work you are about to do is not the current Task (fixing something unrelated, a prerequisite you discovered, a rethink of the plan), declare a Detour with start_detour and a Reason before doing it. Never drift away from the plan silently.
- End the Detour with end_detour: "merge back" for a small fix that leaves the plan as it is, "return" to go back to the plan (optionally appending Tasks for the Detour's intended work), or "recalibrate" to replace the remaining Tasks with a new list.
- When the Developer states a lasting rule about how you should work, save it with add_standing_instruction.
- Refs like progressor://<goal>/<item> can be looked up with get_item.`;

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

export function formatStatus(s: Status): string {
  const instructions =
    s.standingInstructions.length > 0
      ? ["Standing Instructions:", ...s.standingInstructions.map((i) => `- ${i.id} ${i.text}`)]
      : [];
  if (!s.goal) {
    return [
      "No Goal is claimed by this Session. Claim one with claim_goal, or add one with add_goal.",
      ...(s.goals.length > 0 ? ["Goals:", ...s.goals.map(goalLine)] : ["The Roadmap has no Goals yet."]),
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
    s.nextTask ? `Next Task: ${taskLine(s.nextTask)}` : "Next Task: none; every Task is done or dropped",
    ...summaryLine(s.nextTask),
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
  const status = () => formatStatus(project.status());
  const { dashboard } = options;

  server.registerTool(
    "get_status",
    {
      title: "Get status",
      description:
        "Compact summary of this Session's Goal, current Task, open Detour, next Task and the Developer's Standing Instructions. Call it at the start of every conversation and after context compression.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      // The Session serving the dashboard may have ended; if so, this one takes over.
      await dashboard?.refresh().catch(() => undefined);
      return respond(() =>
        [
          status(),
          `Project folder: ${project.root}`,
          ...(dashboard?.url ? [`Dashboard: ${dashboard.url} (tell the Developer they can follow progress there)`] : []),
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "Get item",
      description:
        "Look up one Goal, Task, Detour or Standing Instruction by its ref (progressor://<goal>/<item>, or progressor://roadmap/<instruction>), with its file and line. Use it when the Developer pastes a ref or you need one item's details; for where the work stands overall, use get_status.",
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
        "Add a Goal to the end of the Roadmap, with an optional Task list and Outcome. Does not claim it. A title another Goal already has is refused unless allow_duplicate is set. To record work already finished, set done on the Goal and on every Task.",
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
      },
    },
    ({ title, id, outcome, tasks, allow_duplicate, done }) =>
      respond(() => {
        const goal = project.addGoal(title, tasks ?? [], { id, outcome, allowDuplicate: allow_duplicate, done });
        const n = tasks?.length ?? 0;
        return done
          ? `Recorded finished Goal ${goal.id} (${goal.ref}) with ${n} done Tasks.`
          : `Added Goal ${goal.id} (${goal.ref}) with ${n} Tasks. Claim it with claim_goal to work on it.`;
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
        "Claim a Goal for this Session, so only this Session works on it. Releases (pauses) any Goal this Session held before. Fails if another running Session holds it. Claiming a done Goal reopens it: its finished Tasks stay done, and add_tasks adds the new work to the same list.",
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
      description: "Release this Session's Claim, leaving the Goal paused for a later Session.",
    },
    () =>
      respond(() => {
        const goal = project.releaseGoal();
        return goal ? `Released Goal ${goal.id}; it is now paused.` : "This Session had no Goal to release.";
      }),
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Complete Goal",
      description:
        "Mark the claimed Goal done and release it, once its Outcome is true and its Tasks are done or dropped. If more work turns up later, claim_goal reopens it.",
    },
    () =>
      respond(() => {
        const goal = project.completeGoal();
        return `Goal ${goal.id} is done.`;
      }),
  );

  server.registerTool(
    "add_tasks",
    {
      title: "Add Tasks",
      description:
        "Append Tasks to the claimed Goal's plan. For work that is not part of the plan, declare a Detour instead. Set done on a Task that is already finished.",
      inputSchema: { tasks: z.array(newTaskInput).min(1) },
    },
    ({ tasks }) =>
      respond(() => {
        const added = project.addTasks(tasks);
        return `Added: ${added.map(taskLine).join("; ")}`;
      }),
  );

  server.registerTool(
    "start_task",
    {
      title: "Start Task",
      description: "Mark a Task in progress. Only one Task can be in progress at a time.",
      inputSchema: { task: z.string().describe("The Task ID, such as 't3'.") },
    },
    ({ task }) =>
      respond(() => {
        project.startTask(task);
        return status();
      }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete Task",
      description:
        "Mark a Task of the claimed Goal done, recording the files it touched and, if it changed, the final summary of what it did. Works whether or not the Task was started. For a Task that turned out unnecessary, use drop_task instead; to change a Task without finishing it, use update_task.",
      inputSchema: {
        task: z.string().describe("The Task ID, such as 't3'."),
        code: z.array(z.string()).optional().describe("Files the Task touched, optionally with :line; added to the ones it has."),
        summary: taskInput.shape.summary,
      },
    },
    ({ task, code, summary }) =>
      respond(() => {
        project.completeTask(task, code ?? [], summary);
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
        task: z.string().describe("The Task ID, such as 't3'."),
        title: taskInput.shape.title.optional(),
        summary: taskInput.shape.summary,
        code: z.array(z.string()).optional().describe("The Task's files, optionally with :line; replaces the ones it has."),
      },
    },
    ({ task, title, summary, code }) =>
      respond(() => {
        const t = project.updateTask(task, { title, summary, code });
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
        task: z.string().describe("The Task ID, such as 't3'."),
        reason: z.string().min(1).describe("Why the Task is no longer needed."),
      },
    },
    ({ task, reason }) =>
      respond(() => {
        project.dropTask(task, reason);
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
        title: z.string().min(1).describe("What the Detour does, such as 'Fix flaky token refresh'."),
        reason: z.string().min(1).describe("Why the work has to split off from the plan now."),
      },
    },
    ({ title, reason }) =>
      respond(() => {
        const d = project.startDetour(title, reason);
        return `Started ${formatDetour(d)}. End it with end_detour when done.`;
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
        ending: z.enum(endings),
        tasks: z.array(taskInput).optional().describe("Tasks to append (return) or the new Task list (recalibrate)."),
      },
    },
    ({ ending, tasks }) =>
      respond(() => {
        const { detour, added, dropped } = project.endDetour(ending, tasks ?? []);
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
    "add_standing_instruction",
    {
      title: "Add Standing Instruction",
      description:
        "Save a lasting rule from the Developer about how you should work in this project, such as 'ask me before recalibrating'. It is shown in every get_status and by the Claude Code hooks. Use it only for rules meant to last; a one-off request is just done.",
      inputSchema: { text: z.string().min(1).describe("The rule, in the Developer's words where possible.") },
    },
    ({ text }) =>
      respond(() => {
        const s = project.addStandingInstruction(text);
        return `Saved Standing Instruction ${s.id}: ${s.text}`;
      }),
  );

  // Slash commands: Claude Code lists them in its / menu as /<server name>:status (MCP) and so on.
  const message = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "status",
    { title: "Progressor status", description: "Where the work stands: the Goal, its Outcome, the current Task, any open Detour and what comes next." },
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
    { title: "Set up this project", description: "Add Progressor's hooks, its note in CLAUDE.md and a Roadmap to this folder, after your OK." },
    () => message(setupPrompt(project.root, launchFor({ viaNpx: startedViaNpx(), platform: process.platform }))),
  );

  server.registerPrompt(
    "next",
    { title: "Pick up the work", description: "Carry on where the plan left off: the open Detour, the Task in progress, or the next Task, claiming a Goal if needed." },
    () => message(nextPrompt(project.status(), status())),
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
