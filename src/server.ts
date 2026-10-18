import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { Dashboard } from "./dashboard/http.js";
import type { Detour, Task } from "./planFile.js";
import type { DetourEnding, FoundItem, Project, Status } from "./project.js";
import type { Goal } from "./roadmap.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export const INSTRUCTIONS = `Progressor keeps you and the Developer focused on the same Goal across long sessions, context compression and distractions. The progress record is markdown in .progressor/ that only you change, through these tools; never edit those files directly.

- At the start of every conversation, and again after your context has been compressed or summarised, call get_status before doing anything else. It tells you the Goal you are working on, the current Task, any open Detour, the next Task and the Developer's Standing Instructions. Follow the Standing Instructions.
- If no Goal is claimed, claim the one the Developer wants to work on (claim_goal), or add it (add_goal) with a Task list.
- Give every Task a short title (a few words), the files it touches, and a summary: one or two sentences on the fix or change it makes, such as "Callback re-sets the session cookie on every hit; only set it after token exchange." Set them when you add Tasks, and keep them true with update_task as you learn more.
- Mark Tasks as you go: start_task before working on one, complete_task when it is done (pass the files you touched and, if it changed, the final summary), drop_task when it is no longer needed.
- When the work you are about to do is not the current Task (fixing something unrelated, a prerequisite you discovered, a rethink of the plan), declare a Detour with start_detour and a Reason before doing it. Never drift away from the plan silently.
- End the Detour with end_detour: "merge back" for a small fix that leaves the plan as it is, "return" to go back to the plan (optionally appending Tasks for the Detour's intended work), or "recalibrate" to replace the remaining Tasks with a new list.
- When a feature or improvement comes up that is not needed now, park it with record_idea instead of doing it.
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
  /** The dashboard, so get_status can say where the Developer can open it. */
  dashboard?: Pick<Dashboard, "url" | "refresh">;
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
        [status(), ...(dashboard ? [`Dashboard: ${dashboard.url} (tell the Developer they can follow progress there)`] : [])].join("\n"),
      );
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "Get item",
      description: "Look up a Goal, Task, Detour, Idea or Standing Instruction by its ref, with its file and line.",
      inputSchema: { ref: z.string().describe("A ref such as progressor://login/t2 or progressor://roadmap/i1.") },
      annotations: { readOnlyHint: true },
    },
    ({ ref }) => respond(() => formatItem(project.getItem(ref))),
  );

  server.registerTool(
    "add_goal",
    {
      title: "Add Goal",
      description: "Add a Goal to the end of the Roadmap, with an optional initial Task list. Does not claim it.",
      inputSchema: {
        title: z.string().min(1).describe("The outcome, such as 'Ship OAuth login'."),
        tasks: z.array(taskInput).optional(),
      },
    },
    ({ title, tasks }) =>
      respond(() => {
        const goal = project.addGoal(title, tasks ?? []);
        return `Added Goal ${goal.id} (${goal.ref}) with ${tasks?.length ?? 0} Tasks. Claim it with claim_goal to work on it.`;
      }),
  );

  server.registerTool(
    "claim_goal",
    {
      title: "Claim Goal",
      description:
        "Claim a Goal for this Session, so only this Session works on it. Releases (pauses) any Goal this Session held before. Fails if another running Session holds it.",
      inputSchema: {
        goal: z.string().describe("The Goal ID, such as 'ship-oauth-login'."),
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
      description: "Mark the claimed Goal done and release it.",
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
        "Append Tasks to the claimed Goal's plan. For work that is not part of the plan, declare a Detour instead.",
      inputSchema: { tasks: z.array(taskInput).min(1) },
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
      description: "Mark a Task done, recording the files it touched and, if it changed, the final summary of what it did.",
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
      description: "Drop a Task that is no longer needed, with a reason. To replace the whole remaining plan, recalibrate instead.",
      inputSchema: { task: z.string(), reason: z.string().min(1) },
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
    "record_idea",
    {
      title: "Record Idea",
      description: "Park a feature or improvement that came up but is not needed now, instead of doing it.",
      inputSchema: { title: z.string().min(1), note: z.string().optional() },
    },
    ({ title, note }) =>
      respond(() => {
        const idea = project.recordIdea(title, note);
        return `Recorded Idea ${idea.id} (${idea.ref}).`;
      }),
  );

  server.registerTool(
    "promote_idea",
    {
      title: "Promote Idea",
      description: "Turn an Idea into a Task at the end of the claimed Goal, or into a new Goal on the Roadmap.",
      inputSchema: { idea: z.string().describe("The Idea ID, such as 'i2'."), to: z.enum(["task", "goal"]) },
    },
    ({ idea, to }) =>
      respond(() => {
        const promoted = project.promoteIdea(idea, to);
        return `Promoted Idea ${idea} to ${to === "task" ? "Task" : "Goal"} ${promoted.ref}.`;
      }),
  );

  server.registerTool(
    "add_standing_instruction",
    {
      title: "Add Standing Instruction",
      description:
        "Save a lasting rule from the Developer about how you should work, such as 'ask me before recalibrating'. It is shown in every get_status.",
      inputSchema: { text: z.string().min(1) },
    },
    ({ text }) =>
      respond(() => {
        const s = project.addStandingInstruction(text);
        return `Saved Standing Instruction ${s.id}: ${s.text}`;
      }),
  );

  return server;
}
