import type { Detour, DetourStatus, Task, TaskStatus } from "../planFile.js";

interface NodeBase {
  id: string;
  ref: string | undefined;
  title: string;
  /** Line of the item in its Plan File. */
  line: number;
  /** Column on the map, left to right. */
  step: number;
  /** Row on the map; the original plan is lane 0 and branches sit below it. */
  lane: number;
}

export interface TaskNode extends NodeBase {
  kind: "task";
  status: TaskStatus;
  /** One or two sentences on the fix or change the Task makes. */
  summary: string | undefined;
  /** The files the Task touches. */
  code: string[];
  addedBy: string | undefined;
  droppedBy: string | undefined;
  reason: string | undefined;
  /** Added to the end of the plan by a Detour's Return, rather than starting a new line. */
  fromDetour: boolean;
}

export interface DetourNode extends NodeBase {
  kind: "detour";
  status: DetourStatus;
  branchedFrom: string | undefined;
  reason: string | undefined;
}

export type GraphNode = TaskNode | DetourNode;

/**
 * plan: from one Task to the next on a line. detour: from a Task to the Detour that branched off it.
 * merge: a merged-back Detour rejoining its line. return: a returned Detour going back to the Task it
 * branched from. recalibrate: a recalibrated Detour starting the new line of Tasks.
 */
export type EdgeKind = "plan" | "detour" | "merge" | "return" | "recalibrate";

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface GoalGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Builds the metro map of a Goal from its Plan File. The original Task list is one line; every
 * Recalibration starts a new line with the Tasks it added, and later Tasks join the newest line.
 * Detours are stops on branches below the line they split off from.
 */
export function buildGoalGraph(plan: { tasks: Task[]; detours: Detour[] }): GoalGraph {
  const detours: DetourNode[] = plan.detours.map((d) => ({
    kind: "detour",
    id: d.id ?? `line${d.line}`,
    ref: d.ref,
    title: d.title,
    status: d.status,
    line: d.line,
    branchedFrom: d.branchedFrom,
    reason: d.reason,
    step: 0,
    lane: 0,
  }));
  const detourById = new Map(detours.map((d) => [d.id, d]));
  const endedBy = (id: string | undefined, status: DetourStatus) => (id ? detourById.get(id)?.status === status : false);

  const tasks: TaskNode[] = plan.tasks.map((t) => ({
    kind: "task",
    id: t.id ?? `line${t.line}`,
    ref: t.ref,
    title: t.title,
    status: t.status,
    line: t.line,
    summary: t.summary,
    code: t.code,
    addedBy: t.addedBy,
    droppedBy: t.droppedBy,
    reason: t.reason,
    fromDetour: endedBy(t.addedBy, "returned"),
    step: 0,
    lane: 0,
  }));

  // Lines: the original plan, then one per Recalibration, in the order their Tasks appear.
  const lines: { tasks: TaskNode[]; startedBy: DetourNode | undefined }[] = [{ tasks: [], startedBy: undefined }];
  const lineOfDetour = new Map<string, number>();
  for (const t of tasks) {
    if (t.addedBy && endedBy(t.addedBy, "recalibrated") && !lineOfDetour.has(t.addedBy)) {
      lineOfDetour.set(t.addedBy, lines.length);
      lines.push({ tasks: [], startedBy: detourById.get(t.addedBy) });
    }
    lines[lines.length - 1]!.tasks.push(t);
  }
  const lineOfTask = new Map<string, number>();
  lines.forEach((l, i) => l.tasks.forEach((t) => lineOfTask.set(t.id, i)));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // A Detour hangs off the Task it branched from; without one, off the last finished Task.
  const anchorOf = new Map<string, TaskNode | undefined>();
  for (const d of detours) {
    let anchor = d.branchedFrom ? taskById.get(d.branchedFrom) : undefined;
    if (!anchor) {
      const before = tasks.filter((t) => t.status === "done" && lineOfTask.get(t.id) === lines.length - 1);
      anchor = before[before.length - 1];
    }
    anchorOf.set(d.id, anchor);
  }
  // The stop a merged-back Detour rejoins: the Task after its anchor on the same line.
  const rejoinOf = (d: DetourNode): TaskNode | undefined => {
    const anchor = anchorOf.get(d.id);
    if (!anchor) return undefined;
    const line = lines[lineOfTask.get(anchor.id)!]!.tasks;
    return line[line.indexOf(anchor) + 1];
  };

  // Steps: every stop sits right of the one before it, a Detour right of its anchor, and the stop
  // after a Detour that ended (merge back, or the first Task of a new line) right of the Detour.
  // Constraints only push stops right, so repeating until nothing moves settles the layout.
  for (let changed = true; changed; ) {
    changed = false;
    const push = (n: GraphNode, step: number) => {
      if (n.step < step) {
        n.step = step;
        changed = true;
      }
    };
    for (const l of lines) {
      if (l.startedBy && l.tasks[0]) push(l.tasks[0], l.startedBy.step + 1);
      l.tasks.forEach((t, i) => i > 0 && push(t, l.tasks[i - 1]!.step + 1));
    }
    for (const d of detours) {
      const anchor = anchorOf.get(d.id);
      if (anchor) push(d, anchor.step + 1);
      const rejoin = d.status === "merged back" ? rejoinOf(d) : undefined;
      if (rejoin) push(rejoin, d.step + 1);
    }
  }

  // Lanes: each branch takes the nearest free lane below the line it splits off from. A Detour
  // occupies its own step; a Recalibration also holds its lane for the whole of its new line.
  const taken: { lane: number; from: number; to: number }[] = [];
  const free = (lane: number, from: number, to: number) =>
    !taken.some((r) => r.lane === lane && r.from <= to && from <= r.to);
  const lastStep = (l: { tasks: TaskNode[] }) => l.tasks[l.tasks.length - 1]?.step ?? 0;
  taken.push({ lane: 0, from: 0, to: lastStep(lines[0]!) });
  for (const d of detours) {
    const anchor = anchorOf.get(d.id);
    const parentLane = anchor ? anchor.lane : 0;
    const line = lineOfDetour.has(d.id) ? lines[lineOfDetour.get(d.id)!] : undefined;
    const to = line ? Math.max(d.step, lastStep(line)) : d.step;
    let lane = parentLane + 1;
    while (!free(lane, d.step, to)) lane++;
    taken.push({ lane, from: d.step, to });
    d.lane = lane;
    line?.tasks.forEach((t) => (t.lane = lane));
  }

  const edges: GraphEdge[] = [];
  for (const l of lines)
    l.tasks.forEach((t, i) => i > 0 && edges.push({ from: l.tasks[i - 1]!.id, to: t.id, kind: "plan" }));
  for (const d of detours) {
    const anchor = anchorOf.get(d.id);
    if (anchor) edges.push({ from: anchor.id, to: d.id, kind: "detour" });
    if (d.status === "merged back") {
      const to = rejoinOf(d) ?? anchor;
      if (to) edges.push({ from: d.id, to: to.id, kind: "merge" });
    } else if (d.status === "returned" && anchor) {
      edges.push({ from: d.id, to: anchor.id, kind: "return" });
    } else if (d.status === "recalibrated") {
      const first = lineOfDetour.has(d.id) ? lines[lineOfDetour.get(d.id)!]!.tasks[0] : undefined;
      if (first) edges.push({ from: d.id, to: first.id, kind: "recalibrate" });
    }
  }
  return { nodes: [...tasks, ...detours], edges };
}

/** The same map with the Detours left out: each new line joins the Task its Recalibration branched from. */
/**
 * The map without its dropped Tasks: each one's line joins straight around it, a Detour that
 * branched off it hangs off the stop before, and the empty columns close up.
 */
export function withoutDropped(graph: GoalGraph): GoalGraph {
  const hidden = graph.nodes.filter((n) => n.kind === "task" && n.status === "dropped").map((n) => n.id);
  let edges = graph.edges;
  for (const h of hidden) {
    const into = edges.filter((e) => e.to === h);
    const out = edges.filter((e) => e.from === h);
    edges = edges.filter((e) => e.from !== h && e.to !== h);
    for (const i of into)
      for (const o of out)
        if (!edges.some((e) => e.from === i.from && e.to === o.to))
          edges.push({ from: i.from, to: o.to, kind: o.kind === "plan" ? i.kind : o.kind });
  }
  const nodes = graph.nodes.filter((n) => !hidden.includes(n.id));
  const steps = [...new Set(nodes.map((n) => n.step))].sort((a, b) => a - b);
  return { nodes: nodes.map((n) => ({ ...n, step: steps.indexOf(n.step) })), edges };
}

export function withoutDetours(graph: GoalGraph): GoalGraph {
  const hidden = new Set(graph.nodes.filter((n) => n.kind === "detour").map((n) => n.id));
  const edges = graph.edges.filter((e) => !hidden.has(e.from) && !hidden.has(e.to));
  for (const h of hidden) {
    const into = graph.edges.filter((e) => e.to === h).map((e) => e.from);
    const out = graph.edges.filter((e) => e.from === h && e.kind === "recalibrate").map((e) => e.to);
    for (const from of into) for (const to of out) edges.push({ from, to, kind: "plan" });
  }
  return { nodes: graph.nodes.filter((n) => !hidden.has(n.id)), edges };
}
