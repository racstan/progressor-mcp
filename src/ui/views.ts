import type { DetourNode, GoalGraph, TaskNode } from "../dashboard/graph.js";

/** The ways to look at a Goal: the metro map either way round, or a plain checklist. */
export const VIEWS = ["horizontal", "vertical", "checklist"] as const;
export type View = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<View, string> = {
  horizontal: "Map, left to right",
  vertical: "Map, top to bottom",
  checklist: "List of steps",
};

const isView = (v: string | null | undefined): v is View => VIEWS.includes(v as View);

/** The view in the address wins, then the one this browser last used, else the horizontal map. */
export function pickView(search: string, stored: string | undefined): View {
  const fromUrl = new URLSearchParams(search).get("view");
  if (isView(fromUrl)) return fromUrl;
  return isView(stored) ? stored : "horizontal";
}

export interface ChecklistRow {
  /** Undefined for the row of Detours that hang off no Task (nothing was done when they started). */
  task: TaskNode | undefined;
  /** The Detours that branched off this Task, in the order they were declared. */
  detours: DetourNode[];
}

/** The Goal as a list in plan order, each Detour under the Task it hangs off on the map. */
export function checklistRows(graph: GoalGraph): ChecklistRow[] {
  const tasks = graph.nodes.filter((n): n is TaskNode => n.kind === "task").sort((a, b) => a.line - b.line);
  const detours = graph.nodes.filter((n): n is DetourNode => n.kind === "detour").sort((a, b) => a.line - b.line);
  const anchorOf = (d: DetourNode) => graph.edges.find((e) => e.kind === "detour" && e.to === d.id)?.from;
  const rows: ChecklistRow[] = tasks.map((task) => ({ task, detours: detours.filter((d) => anchorOf(d) === task.id) }));
  const loose = detours.filter((d) => !anchorOf(d) || !tasks.some((t) => t.id === anchorOf(d)));
  return loose.length > 0 ? [{ task: undefined, detours: loose }, ...rows] : rows;
}
