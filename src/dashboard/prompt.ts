// "Copy for your AI": the text the Developer pastes into the Agent chat to point at an item. The
// Agent has Progressor, so this is a short pointer (what it is, where it stands, its ref and file)
// that the Agent looks up itself; the Developer types what they want after it.
import type { GoalStatus, Idea, StandingInstruction } from "../roadmap.js";
import type { GoalGraph, GraphNode, TaskNode } from "./graph.js";

export interface PromptGoal {
  id: string;
  title: string;
  ref: string;
  status: GoalStatus;
  /** Line of the Goal in roadmap.md. */
  line: number;
  planFile: string;
  claim?: { session: string } | undefined;
  /** What done looks like. */
  outcome?: string | undefined;
}

export type PromptSubject =
  | { kind: "goal"; goal: PromptGoal; graph: GoalGraph }
  | { kind: "node"; node: GraphNode; goal: PromptGoal; graph: GoalGraph }
  | { kind: "idea"; idea: Idea; file: string }
  | { kind: "standing instruction"; instruction: StandingInstruction; file: string };

const quote = (s: string) => `"${s}"`;
const lookUp = (ref: string | undefined, where: string) => (ref ? `Look it up with get_item ${ref} (${where}).` : `Read ${where}.`);
const doneOf = (graph: GoalGraph) => {
  const live = graph.nodes.filter((n): n is TaskNode => n.kind === "task" && n.status !== "dropped");
  return `${live.filter((t) => t.status === "done" || t.status === "released").length} of ${live.length} steps done`;
};
/** A Goal's status in the Developer's words. */
const GOAL_STATE: Record<GoalStatus, string> = { planned: "not started", active: "active", paused: "paused", done: "finished", dropped: "cancelled" };

export function copyAsPrompt(subject: PromptSubject): string {
  switch (subject.kind) {
    case "node": {
      const { node, goal } = subject;
      const what = node.kind === "task" ? "Step" : "Side trip";
      const state = node.status === "dropped" ? "cancelled, not part of the plan" : node.status;
      return `[Progressor] ${what} ${node.id} ${quote(node.title)} (${state}) in goal ${quote(goal.title)}. ${lookUp(node.ref, `${goal.planFile}:${node.line}`)}`;
    }
    case "goal": {
      const { goal, graph } = subject;
      const reopen = goal.status === "done" ? " For more work on it, reopen it with claim_goal." : "";
      return `[Progressor] Goal ${quote(goal.title)} (${GOAL_STATE[goal.status]}, ${doneOf(graph)}). ${lookUp(goal.ref, goal.planFile)}${reopen}`;
    }
    case "idea": {
      const { idea, file } = subject;
      const state = idea.promotedTo ? `planned as ${idea.promotedTo}` : "parked: not planned, do not build it unless I ask";
      return `[Progressor] Idea ${idea.id ?? ""} ${quote(idea.title)} (${state}). ${lookUp(idea.ref, `${file}:${idea.line}`)}`.replace("Idea  ", "Idea ");
    }
    case "standing instruction": {
      const { instruction, file } = subject;
      return `[Progressor] Standing Instruction ${instruction.id ?? ""} ${quote(instruction.text)}. ${lookUp(instruction.ref, `${file}:${instruction.line}`)}`.replace("Instruction  ", "Instruction ");
    }
  }
}
