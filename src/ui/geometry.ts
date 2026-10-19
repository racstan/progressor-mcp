import type { EdgeKind, GraphNode } from "../dashboard/graph.js";

export interface Point {
  x: number;
  y: number;
}

/** Which way the metro map runs: plan left to right with branches below, or top to bottom with branches to the right. */
export type Orientation = "horizontal" | "vertical";

export const STEP_X = 180;
export const LANE_Y = 120;
/** The vertical map needs room beside each stop for its label, and less between stops. */
export const LANE_X_VERTICAL = 260;
export const STEP_Y_VERTICAL = 120;

/**
 * How a long plan wraps on the horizontal map: `columns` stops to a row, rows `rowHeight` apart.
 * Rows run like a snake: left to right, then back right to left, and so on.
 */
export interface Wrap {
  columns: number;
  rowHeight: number;
}

/** Room in a row besides its lanes: the tags above the line and the labels and chips below the lowest lane. */
const ROW_EXTRA = 150;

/**
 * The wrap that shows a plan of `steps` stops and `lanes` lanes at the largest scale in a box of the
 * map's size. A plan that fits at full size stays on one line.
 */
export function chooseWrap(steps: number, lanes: number, box: { width: number; height: number }): Wrap {
  const rowHeight = (Math.max(1, lanes) - 1) * LANE_Y + ROW_EXTRA;
  const scaleFor = (columns: number) =>
    Math.min(1.4, (box.width - 80) / (columns * STEP_X), (box.height - 100) / (Math.ceil(steps / columns) * rowHeight));
  let columns = Math.max(1, steps);
  if (steps <= 3 || scaleFor(columns) >= 1) return { columns, rowHeight };
  let best = scaleFor(columns);
  // fewer columns means more rows; on a tie the longer rows win
  for (let c = steps - 1; c >= 3; c--) {
    const scale = scaleFor(c);
    if (scale > best + 1e-9) [columns, best] = [c, scale];
  }
  return { columns, rowHeight };
}

const rowOf = (y: number, wrap: Wrap) => Math.max(0, Math.floor(y / wrap.rowHeight));
/** 1 on rows that run left to right, -1 on rows that run back. */
const directionOf = (row: number) => (row % 2 ? -1 : 1);

export function positionOf(n: Pick<GraphNode, "step" | "lane">, orientation: Orientation = "horizontal", wrap?: Wrap): Point {
  if (orientation === "vertical") return { x: n.lane * LANE_X_VERTICAL, y: n.step * STEP_Y_VERTICAL };
  if (!wrap) return { x: n.step * STEP_X, y: n.lane * LANE_Y };
  const row = Math.floor(n.step / wrap.columns);
  const column = n.step % wrap.columns;
  return {
    x: (directionOf(row) > 0 ? column : wrap.columns - 1 - column) * STEP_X,
    y: row * wrap.rowHeight + n.lane * LANE_Y,
  };
}

export const laneColor = (lane: number) => `var(--lane${lane % 4})`;

/**
 * Lines run along the plan; a Return (or a merge that rejoins behind) loops back into its Task from
 * the branch side.
 */
export function edgePath(p: Point, q: Point, kind: EdgeKind, orientation: Orientation = "horizontal", wrap?: Wrap): string {
  if (orientation === "horizontal" && wrap) return wrappedEdgePath(p, q, kind, wrap);
  const back = kind === "return" || (kind === "merge" && (orientation === "vertical" ? q.y <= p.y : q.x <= p.x));
  if (orientation === "vertical") {
    if (back) return `M${p.x},${p.y} C${p.x},${p.y + 90} ${q.x + 80},${q.y + 40} ${q.x + 18},${q.y + 6}`;
    const my = (p.y + q.y) / 2;
    return `M${p.x},${p.y} C${p.x},${my} ${q.x},${my} ${q.x},${q.y}`;
  }
  if (back) return `M${p.x},${p.y} C${p.x + 90},${p.y} ${q.x + 40},${q.y + 80} ${q.x + 6},${q.y + 18}`;
  const mx = (p.x + q.x) / 2;
  return `M${p.x},${p.y} C${mx},${p.y} ${mx},${q.y} ${q.x},${q.y}`;
}

/** Edges on a wrapped map: loops back follow each row's direction, and the line turns round the end of a row. */
function wrappedEdgePath(p: Point, q: Point, kind: EdgeKind, wrap: Wrap): string {
  const [rowP, rowQ] = [rowOf(p.y, wrap), rowOf(q.y, wrap)];
  const along = (pt: Point, row: number) => row * 1e6 + directionOf(row) * pt.x;
  const back = kind === "return" || (kind === "merge" && along(q, rowQ) <= along(p, rowP));
  if (back) {
    const d = directionOf(rowQ);
    return `M${p.x},${p.y} C${p.x + d * 90},${p.y} ${q.x + d * 40},${q.y + 80} ${q.x + d * 6},${q.y + 18}`;
  }
  if (rowP !== rowQ) {
    const side = directionOf(rowP) * 90;
    return `M${p.x},${p.y} C${p.x + side},${p.y} ${q.x + side},${q.y} ${q.x},${q.y}`;
  }
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
