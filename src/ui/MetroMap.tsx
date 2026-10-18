import { useLayoutEffect, useMemo, useRef } from "react";
import type { GoalGraph, GraphNode } from "../dashboard/graph.js";
import { STATUS_LABEL, edgePath, edgeStyle, laneColor, positionOf, wrapLabel } from "./geometry.js";
import { type PanZoom, type View, panZoom } from "./panZoom.js";
import { type BandEdge, rubberBand } from "./rubberBand.js";

/** Zoom and pan per Goal (and Detours setting) survive live updates and switching back and forth. */
const views = new Map<string, View>();

interface Props {
  graph: GoalGraph;
  viewKey: string;
  /** The stop to centre on when the map is first shown. */
  focusId: string | undefined;
  onOpen: (node: GraphNode, at: { x: number; y: number }) => void;
}

export function MetroMap({ graph, viewKey, focusId, onOpen }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const pz = useRef<PanZoom>(undefined);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const positions = useMemo(() => new Map(graph.nodes.map((n) => [n.id, positionOf(n)])), [graph]);
  const edges = useMemo(
    () =>
      graph.edges
        .filter((e) => byId.has(e.from) && byId.has(e.to))
        .map((e) => ({ ...e, style: edgeStyle(e.kind, byId.get(e.from)!, byId.get(e.to)!) })),
    [graph, byId],
  );

  // pan and zoom, kept per view
  useLayoutEffect(() => {
    let view = views.get(viewKey);
    if (!view) views.set(viewKey, (view = { s: 1, tx: 40, ty: 120, fitted: false }));
    const controls = panZoom(svgRef.current!, gRef.current!, view);
    pz.current = controls;
    let frame = 0;
    if (!view.fitted) {
      const focus = focusId ? positions.get(focusId) : undefined;
      const tryFit = () => {
        controls.fit(focus);
        if (!view.fitted) frame = requestAnimationFrame(tryFit);
      };
      tryFit();
    }
    return () => {
      cancelAnimationFrame(frame);
      controls.destroy();
    };
    // the focus only matters for the first fit of a view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  // rubber-band dragging, rebuilt whenever the map changes
  useLayoutEffect(() => {
    const bandEdges: BandEdge[] = edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind, width: e.style.width }));
    return rubberBand({
      root: gRef.current!,
      positions,
      edges: bandEdges,
      path: edgePath,
      scale: () => pz.current?.scale() ?? 1,
      onClick: (id, e) => {
        const n = byId.get(id);
        if (n) onOpenRef.current(n, { x: e.clientX, y: e.clientY });
      },
    });
  }, [edges, positions, byId]);

  const openFromKey = (n: GraphNode, el: Element) => {
    const r = el.getBoundingClientRect();
    onOpen(n, { x: r.right, y: r.top });
  };

  return (
    <>
      <svg ref={svgRef} className="map" role="group" aria-label="Metro map of the Goal's Tasks and Detours">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--detour)" />
          </marker>
        </defs>
        <g ref={gRef}>
          {edges.map((e, i) => (
            <path
              key={`${e.from}>${e.to}:${e.kind}`}
              data-edge={i}
              d={edgePath(positions.get(e.from)!, positions.get(e.to)!, e.kind)}
              fill="none"
              stroke={e.style.color}
              strokeWidth={e.style.width}
              strokeLinecap="round"
              strokeDasharray={e.style.dash || undefined}
              opacity={e.style.faded ? 0.55 : 1}
              markerEnd={e.style.arrow ? "url(#arrow)" : undefined}
            />
          ))}
          {graph.nodes.map((n) => (
            <Stop key={n.id} node={n} onKey={openFromKey} />
          ))}
        </g>
      </svg>
      <div className="zoombar">
        <button title="Zoom in" aria-label="Zoom in" onClick={() => pz.current?.zoomBy(1.25)}>
          +
        </button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => pz.current?.zoomBy(0.8)}>
          −
        </button>
        <button title="Fit the whole map" aria-label="Fit the whole map" onClick={() => pz.current?.fit()}>
          ⤢
        </button>
      </div>
    </>
  );
}

function Stop({ node: n, onKey }: { node: GraphNode; onKey: (n: GraphNode, el: Element) => void }) {
  const { x, y } = positionOf(n);
  const dropped = n.kind === "task" && n.status === "dropped";
  const active = n.kind === "task" && n.status === "in progress";
  const lines = wrapLabel(n.title);
  const label = `${n.kind === "task" ? "Task" : "Detour"} ${n.id}: ${n.title} (${STATUS_LABEL[n.status]})`;
  let shape;
  if (n.kind === "detour") {
    const diamond = { x: x - 13, y: y - 13, width: 26, height: 26, rx: 5, transform: `rotate(45 ${x} ${y})` };
    shape = (
      <>
        {n.status === "open" && <rect className="pulse" {...diamond} fill="var(--detour)" />}
        <rect className="shape" {...diamond} fill="var(--panel)" stroke="var(--detour)" strokeWidth={4} />
        <text x={x} y={y - 30} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: "var(--detour)" }}>
          {STATUS_LABEL[n.status]!.toUpperCase()}
        </text>
      </>
    );
  } else {
    const c = dropped ? "var(--faded)" : laneColor(n.lane);
    shape = (
      <>
        {active && <circle className="pulse" cx={x} cy={y} r={14} fill={c} />}
        <circle className="shape" cx={x} cy={y} r={active ? 15 : 12} fill={n.status === "done" ? c : "var(--panel)"} stroke={c} strokeWidth={5} />
        {n.status === "done" && <path d={`M${x - 5},${y} l4,4 l7,-8`} stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" />}
        {n.fromDetour && (
          <text x={x} y={y - 24} textAnchor="middle" fontSize={11} style={{ fill: "var(--detour)" }}>
            from Detour
          </text>
        )}
      </>
    );
  }
  return (
    <g
      className="node"
      data-node={n.id}
      opacity={dropped ? 0.5 : 1}
      tabIndex={0}
      role="button"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onKey(n, e.currentTarget);
        }
      }}
    >
      <title>{label}</title>
      {shape}
      <text x={x} y={y + 36} textAnchor="middle" fontSize={13} fontWeight={active ? 700 : 500} textDecoration={dropped ? "line-through" : undefined}>
        {lines.map((l, i) => (
          <tspan key={i} x={x} dy={i ? 15 : 0}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}
