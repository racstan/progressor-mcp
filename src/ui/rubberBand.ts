// Rubber-band dragging on the metro map. The dragged stop follows the pointer, its neighbours are
// tugged along, the lines stretch (and thin out), and on release everything springs back to where
// the layout put it, with a wobble. It is purely a toy for the eye: nothing is saved.
import type { EdgeKind } from "../dashboard/graph.js";
import type { Point } from "./geometry.js";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

export interface BandEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  width: number;
}

const STIFFNESS = 170;
const DAMPING = 13;
const SUBSTEP = 1 / 120;

export interface RubberBandOptions {
  root: SVGGElement;
  positions: Map<string, Point>;
  edges: BandEdge[];
  path: (p: Point, q: Point, kind: EdgeKind) => string;
  /** The map's current zoom, to turn pointer movement into map units. */
  scale: () => number;
  /** A press on a stop that did not turn into a drag. */
  onClick: (id: string, event: PointerEvent) => void;
}

/** Wires rubber-band dragging to the `[data-node]` and `[data-edge]` elements under `root`. Returns a cleanup. */
export function rubberBand({ root, positions, edges, path, scale, onClick }: RubberBandOptions): () => void {
  const ids = [...positions.keys()];
  const bodies = new Map<string, Body>(ids.map((id) => [id, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }]));
  const neighbours = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbours.has(e.from)) neighbours.set(e.from, new Set());
    if (!neighbours.has(e.to)) neighbours.set(e.to, new Set());
    neighbours.get(e.from)!.add(e.to);
    neighbours.get(e.to)!.add(e.from);
  }
  const nodeEls = new Map(ids.map((id) => [id, root.querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`)]));
  const edgeEls = edges.map((_, i) => root.querySelector<SVGPathElement>(`[data-edge="${i}"]`));
  const restLength = edges.map((e) => {
    const p = positions.get(e.from)!;
    const q = positions.get(e.to)!;
    return Math.hypot(q.x - p.x, q.y - p.y) || 1;
  });

  let drag: { id: string; sx: number; sy: number; lx: number; ly: number; t: number; moved: boolean } | undefined;
  let frame = 0;
  let last = 0;

  const draw = () => {
    for (const id of ids) {
      const b = bodies.get(id)!;
      const c = positions.get(id)!;
      const el = nodeEls.get(id);
      if (!el) continue;
      // squash and stretch along the direction of travel
      const s = Math.min(Math.hypot(b.vx, b.vy) / 2500, 0.25);
      const a = (Math.atan2(b.vy, b.vx) * 180) / Math.PI;
      el.setAttribute(
        "transform",
        b.x === 0 && b.y === 0 && s === 0
          ? ""
          : `translate(${b.x},${b.y}) translate(${c.x},${c.y}) rotate(${a}) scale(${1 + s},${1 - s * 0.6}) rotate(${-a}) translate(${-c.x},${-c.y})`,
      );
    }
    edges.forEach((e, i) => {
      const el = edgeEls[i];
      if (!el) return;
      const p = positions.get(e.from)!;
      const q = positions.get(e.to)!;
      const bp = bodies.get(e.from)!;
      const bq = bodies.get(e.to)!;
      const P = { x: p.x + bp.x, y: p.y + bp.y };
      const Q = { x: q.x + bq.x, y: q.y + bq.y };
      el.setAttribute("d", path(P, Q, e.kind));
      const ratio = restLength[i]! / (Math.hypot(Q.x - P.x, Q.y - P.y) || 1);
      el.setAttribute("stroke-width", (e.width * Math.max(0.35, Math.min(1.25, ratio ** 0.7))).toFixed(2));
    });
  };

  const tick = (now: number) => {
    let moving = !!drag;
    // fixed substeps over the real elapsed time, so a throttled tab still settles
    const steps = Math.min(30, Math.max(1, Math.round(((now - (last || now - 16)) / 1000) / SUBSTEP)));
    last = now;
    for (const [id, b] of bodies) {
      if (drag?.id === id) {
        b.vx *= 0.82; // the stretch relaxes while the pointer rests
        b.vy *= 0.82;
        continue;
      }
      for (let i = 0; i < steps; i++) {
        b.vx += (STIFFNESS * (b.tx - b.x) - DAMPING * b.vx) * SUBSTEP;
        b.vy += (STIFFNESS * (b.ty - b.y) - DAMPING * b.vy) * SUBSTEP;
        b.x += b.vx * SUBSTEP;
        b.y += b.vy * SUBSTEP;
      }
      if (Math.abs(b.x - b.tx) + Math.abs(b.y - b.ty) + Math.abs(b.vx) + Math.abs(b.vy) > 0.05) moving = true;
      else Object.assign(b, { x: b.tx, y: b.ty, vx: 0, vy: 0 });
    }
    draw();
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!frame) last = 0;
  };
  const kick = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  /** Neighbours follow 40% of the drag, their neighbours 14%. */
  const pull = (id: string, ox: number, oy: number) => {
    const one = neighbours.get(id) ?? new Set<string>();
    const two = new Set<string>();
    for (const a of one) for (const b of neighbours.get(a) ?? []) if (b !== id && !one.has(b)) two.add(b);
    for (const [other, b] of bodies) {
      const k = one.has(other) ? 0.4 : two.has(other) ? 0.14 : 0;
      b.tx = ox * k;
      b.ty = oy * k;
    }
  };

  const nodeId = (e: Event) => (e.target as Element).closest?.("[data-node]")?.getAttribute("data-node") ?? undefined;

  const down = (e: PointerEvent) => {
    const id = nodeId(e);
    if (!id || !bodies.has(id) || e.button !== 0) return;
    e.stopPropagation(); // not a pan
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const b = bodies.get(id)!;
    const k = scale();
    drag = { id, sx: e.clientX - b.x * k, sy: e.clientY - b.y * k, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const b = bodies.get(drag.id)!;
    const k = scale();
    const now = performance.now();
    const dt = Math.max(1, now - drag.t) / 1000;
    b.x = (e.clientX - drag.sx) / k;
    b.y = (e.clientY - drag.sy) / k;
    b.vx = (e.clientX - drag.lx) / k / dt;
    b.vy = (e.clientY - drag.ly) / k / dt;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.t = now;
    if (Math.hypot(b.x, b.y) > 4) drag.moved = true;
    pull(drag.id, b.x, b.y);
    kick();
  };
  const up = (e: PointerEvent) => {
    if (!drag) return;
    const { id, moved } = drag;
    drag = undefined;
    for (const b of bodies.values()) {
      b.tx = 0;
      b.ty = 0;
    }
    kick();
    if (!moved) onClick(id, e);
  };

  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
  };
}
