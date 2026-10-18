import type { EdgeKind, GraphNode } from "../dashboard/graph.js";

export interface Point {
  x: number;
  y: number;
}

export const STEP_X = 180;
export const LANE_Y = 120;

export const positionOf = (n: Pick<GraphNode, "step" | "lane">): Point => ({ x: n.step * STEP_X, y: n.lane * LANE_Y });

export const laneColor = (lane: number) => `var(--lane${lane % 4})`;

/** Lines run left to right; a Return (or a merge that rejoins behind) loops back into its Task from below. */
export function edgePath(p: Point, q: Point, kind: EdgeKind): string {
  if (kind === "return" || (kind === "merge" && q.x <= p.x))
    return `M${p.x},${p.y} C${p.x + 90},${p.y} ${q.x + 40},${q.y + 80} ${q.x + 6},${q.y + 18}`;
  const mx = (p.x + q.x) / 2;
  return `M${p.x},${p.y} C${mx},${p.y} ${mx},${q.y} ${q.x},${q.y}`;
}

export interface EdgeStyle {
  color: string;
  width: number;
  dash: string;
  faded: boolean;
  arrow: boolean;
}

export function edgeStyle(kind: EdgeKind, from: GraphNode, to: GraphNode): EdgeStyle {
  const dropped = (n: GraphNode) => n.kind === "task" && n.status === "dropped";
  switch (kind) {
    case "detour":
      return { color: "var(--detour)", width: 3, dash: "2 7", faded: dropped(from), arrow: false };
    case "merge":
    case "return":
      return { color: "var(--detour)", width: 3, dash: "2 7", faded: false, arrow: true };
    case "recalibrate":
      return { color: laneColor(to.lane), width: 5, dash: "", faded: false, arrow: false };
    case "plan": {
      const faded = dropped(from) || dropped(to);
      return { color: faded ? "var(--faded)" : laneColor(to.lane), width: faded ? 3 : 6, dash: faded ? "6 8" : "", faded, arrow: false };
    }
  }
}

/** Splits a title into at most three lines of about `max` characters. */
export function wrapLabel(text: string, max = 20): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length <= 3) return lines;
  return [...lines.slice(0, 2), `${lines[2]!.slice(0, max - 1)}…`];
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  "in progress": "In progress",
  done: "Done",
  dropped: "Dropped",
  open: "Open Detour",
  "merged back": "Merge back",
  returned: "Returned",
  recalibrated: "Recalibrated",
};
