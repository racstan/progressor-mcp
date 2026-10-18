// "Copy as prompt": the text the Developer pastes into the Agent chat to point at an item. It is
// self-describing, so the Agent knows what was meant, where it lives and how it connects without
// re-reading everything, and it ends by telling the Agent where to read more.
import type { GoalStatus, Idea, StandingInstruction } from "../roadmap.js";
import type { DetourNode, GoalGraph, GraphNode, TaskNode } from "./graph.js";

export interface PromptGoal {
  id: string;
  title: string;
  ref: string;
  status: GoalStatus;
  /** Line of the Goal in roadmap.md. */
  line: number;
  planFile: string;
  claim?: { session: string } | undefined;
}

export type PromptSubject =
  | { kind: "goal"; goal: PromptGoal; graph: GoalGraph }
  | { kind: "node"; node: GraphNode; goal: PromptGoal; graph: GoalGraph }
  | { kind: "idea"; idea: Idea; file: string }
  | { kind: "standing instruction"; instruction: StandingInstruction; file: string };

const quote = (s: string) => `"${s}"`;
const lookUp = (where: string, ref: string | undefined) =>
  ref ? `${where} (or call get_item with ${ref})` : where;
const readFirst = (where: string, ref: string | undefined) => `Read ${lookUp(where, ref)} before acting on it.`;

const summaryOf = (t: TaskNode) => (t.summary ? [`  Summary: ${t.summary}`] : []);
const tasksOf = (graph: GoalGraph) =>
  graph.nodes.filter((n): n is TaskNode => n.kind === "task").sort((a, b) => a.line - b.line);
const detoursOf = (graph: GoalGraph) => graph.nodes.filter((n): n is DetourNode => n.kind === "detour");
const detourLabel = (d: DetourNode | undefined, id: string) =>
  d ? `Detour ${d.id} ${quote(d.title)} (${d.status})` : `Detour ${id}`;

function describeTask(t: TaskNode, goal: PromptGoal, graph: GoalGraph): string[] {
  const detour = (id: string) => detoursOf(graph).find((d) => d.id === id);
  const lines: string[] = [];
  if (t.status === "dropped") {
    if (t.summary) lines.push(`Summary: ${t.summary}`);
    if (t.droppedBy) lines.push(`Dropped by: ${detourLabel(detour(t.droppedBy), t.droppedBy)}`);
    if (t.reason) lines.push(`Reason: ${t.reason}`);
    lines.push("This Task is no longer part of the plan. Do not work on it.");
  } else {
    if (t.summary) lines.push(`Summary: ${t.summary}`);
    const live = tasksOf(graph).filter((x) => x.status !== "dropped");
    const k = live.findIndex((x) => x.id === t.id);
    const neighbour = (x: TaskNode) => `${x.id} ${quote(x.title)} (${x.status}, line ${x.line})`;
    lines.push(`Position: Task ${k + 1} of ${live.length} in the plan`);
    if (live[k - 1]) lines.push(`Previous: ${neighbour(live[k - 1]!)}`);
    if (live[k + 1]) lines.push(`Next: ${neighbour(live[k + 1]!)}`);
    if (t.addedBy) lines.push(`Added by: ${detourLabel(detour(t.addedBy), t.addedBy)}`);
  }
  if (t.code.length > 0) lines.push(`References: ${t.code.join(", ")}`);
  return lines;
}

function describeDetour(d: DetourNode, goal: PromptGoal, graph: GoalGraph): string[] {
  const tasks = tasksOf(graph);
  const from = d.branchedFrom ? tasks.find((t) => t.id === d.branchedFrom) : undefined;
  const added = tasks.filter((t) => t.addedBy === d.id).map((t) => t.id);
  const lines: string[] = [];
  if (from) lines.push(`Branched from: Task ${from.id} ${quote(from.title)} (${goal.planFile}:${from.line})`);
  lines.push(`Reason: ${d.reason ?? "none given"}`);
  const ending = {
    open: "still open; it ends with a Merge back, Return or Recalibration.",
    "merged back": "merged back; the plan was left unchanged.",
    returned:
      added.length > 0
        ? `returned to the plan, adding ${added.join(", ")} at the end.`
        : "returned to the plan, adding no Tasks.",
    recalibrated: `recalibrated; the remaining Tasks were dropped and replaced with ${added.join(", ") || "nothing"}.`,
  }[d.status];
  lines.push(`Status: ${ending}`);
  return lines;
}

export function copyAsPrompt(subject: PromptSubject): string {
  switch (subject.kind) {
    case "node": {
      const { node, goal, graph } = subject;
      const where = `${goal.planFile}:${node.line}`;
      const kind = node.kind === "task" ? "Task" : "Detour";
      return [
        `[Progressor] ${kind} ${node.id} ${quote(node.title)} (${node.status})`,
        ...(node.ref ? [`Ref: ${node.ref}`] : []),
        `Location: ${where}`,
        `Goal: ${quote(goal.title)} (${goal.ref})`,
        ...(node.kind === "task" ? describeTask(node, goal, graph) : describeDetour(node, goal, graph)),
        "",
        readFirst(where, node.ref),
      ].join("\n");
    }
    case "goal": {
      const { goal, graph } = subject;
      const tasks = tasksOf(graph);
      const live = tasks.filter((t) => t.status !== "dropped");
      const current = tasks.find((t) => t.status === "in progress");
      const next = tasks.find((t) => t.status === "pending");
      const open = detoursOf(graph).find((d) => d.status === "open");
      const claim = goal.claim ? `, claimed by Session ${goal.claim.session}` : "";
      return [
        `[Progressor] Goal ${quote(goal.title)} (${goal.status}${claim})`,
        `Ref: ${goal.ref}`,
        `Location: .progressor/roadmap.md:${goal.line}`,
        `Plan File: ${goal.planFile}`,
        `Progress: ${live.filter((t) => t.status === "done").length} of ${live.length} Tasks done`,
        ...(current ? [`Current Task: ${current.id} ${quote(current.title)} (line ${current.line})`, ...summaryOf(current)] : []),
        ...(open
          ? [
              `Open Detour: ${open.id} ${quote(open.title)} (line ${open.line})${open.branchedFrom ? `, branched from ${open.branchedFrom}` : ""}. Reason: ${open.reason ?? "none given"}`,
            ]
          : []),
        ...(next ? [`Next Task: ${next.id} ${quote(next.title)} (line ${next.line})`, ...summaryOf(next)] : []),
        "",
        readFirst(goal.planFile, goal.ref),
      ].join("\n");
    }
    case "idea": {
      const { idea, file } = subject;
      const where = `${file}:${idea.line}`;
      return [
        `[Progressor] Idea ${idea.id ?? ""} ${quote(idea.title)} (${idea.promotedTo ? "promoted" : "parked"})`.replace("  ", " "),
        ...(idea.ref ? [`Ref: ${idea.ref}`] : []),
        `Location: ${where}`,
        ...idea.notes.map((n) => `Note: ${n}`),
        ...(idea.promotedTo ? [`Promoted to: ${idea.promotedTo}`] : []),
        "",
        idea.promotedTo
          ? `This Idea is already planned as ${idea.promotedTo}. Read ${lookUp(where, idea.ref)} for details.`
          : `This Idea is parked, not planned: do not build it unless I ask you to promote it to a Task or Goal. Read ${lookUp(where, idea.ref)} for details.`,
      ].join("\n");
    }
    case "standing instruction": {
      const { instruction, file } = subject;
      const where = `${file}:${instruction.line}`;
      return [
        `[Progressor] Standing Instruction ${instruction.id ?? ""} ${quote(instruction.text)}`.replace("  ", " "),
        ...(instruction.ref ? [`Ref: ${instruction.ref}`] : []),
        `Location: ${where}`,
        "",
        readFirst(where, instruction.ref),
      ].join("\n");
    }
  }
}
