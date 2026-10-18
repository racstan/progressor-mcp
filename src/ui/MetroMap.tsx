import { useLayoutEffect, useMemo, useRef } from "react";
import type { EdgeKind, GoalGraph, GraphNode } from "../dashboard/graph.js";
import { type Orientation, type Point, STATUS_LABEL, edgePath, edgeStyle, laneColor, positionOf, wrapLabel } from "./geometry.js";
import { type PanZoom, type View, panZoom } from "./panZoom.js";
import { type BandEdge, rubberBand } from "./rubberBand.js";
import { plainText } from "./text.js";

/** Zoom and pan per Goal (and view and Detours setting) survive live updates and switching back and forth. */
const views = new Map<string, View>();

interface Props {
  graph: GoalGraph;
  orientation: Orientation;
  viewKey: string;
  /** The stop to centre on when the map is first shown. */
  focusId: string | undefined;
  onOpen: (node: GraphNode, at: { x: number; y: number }) => void;
}

export function MetroMap({ graph, orientation, viewKey, focusId, onOpen }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const pz = useRef<PanZoom>(undefined);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const positions = useMemo(() => new Map(graph.nodes.map((n) => [n.id, positionOf(n, orientation)])), [graph, orientation]);
  const path = useMemo(() => (p: Point, q: Point, kind: EdgeKind) => edgePath(p, q, kind, orientation), [orientation]);
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
    const controls = panZoom(svgRef.current!, gRef.current!, view, orientation === "vertical" ? "scroll" : "zoom");
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
      path,
      scale: () => pz.current?.scale() ?? 1,
      onClick: (id, e) => {
        const n = byId.get(id);
        if (n) onOpenRef.current(n, { x: e.clientX, y: e.clientY });
      },
    });
  }, [edges, positions, byId, path]);

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
              d={path(positions.get(e.from)!, positions.get(e.to)!, e.kind)}
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
            <Stop key={n.id} node={n} at={positions.get(n.id)!} vertical={orientation === "vertical"} onKey={openFromKey} />
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

const CHIP_FONT = 10.5;
const chipWidth = (text: string) => Math.round(text.length * CHIP_FONT * 0.62 + 12);
/** A file's chip label: its name (and line), not its whole path. */
const chipText = (file: string) => file.replace(/\\/g, "/").split("/").pop() ?? file;

/** Up to two small file chips in a row starting at (x, y), with "+N" for the rest; anchored left or centred. */
function FileChips({ files, x, y, centred }: { files: string[]; x: number; y: number; centred: boolean }) {
  if (files.length === 0) return null;
  const labels = files.slice(0, 2).map(chipText);
  if (files.length > 2) labels.push(`+${files.length - 2}`);
  const widths = labels.map(chipWidth);
  const total = widths.reduce((a, b) => a + b, 0) + 4 * (labels.length - 1);
  let left = centred ? x - total / 2 : x;
  return (
    <g className="chips" aria-hidden="true">
      {labels.map((label, i) => {
        const w = widths[i]!;
        const chip = (
          <g key={i}>
            <rect x={left} y={y} width={w} height={16} rx={8} className="chip-bg" />
            <text x={left + w / 2} y={y + 11.5} textAnchor="middle" fontSize={CHIP_FONT} className="chip-text">
              {label}
            </text>
          </g>
        );
        left += w + 4;
        return chip;
      })}
    </g>
  );
}

function Stop({ node: n, at, vertical, onKey }: { node: GraphNode; at: Point; vertical: boolean; onKey: (n: GraphNode, el: Element) => void }) {
  const { x, y } = at;
  const dropped = n.kind === "task" && n.status === "dropped";
  const active = n.kind === "task" && n.status === "in progress";
  const lines = wrapLabel(n.title, vertical ? 26 : 20);
  const label = `${n.kind === "task" ? "Task" : "Detour"} ${n.id}: ${n.title} (${STATUS_LABEL[n.status]})`;
  // Labels sit under the stop on the horizontal map and beside it on the vertical one.
  const textX = vertical ? x + 26 : x;
  const anchor = vertical ? "start" : "middle";
  const titleY = vertical ? y + 5 : y + 36;
  const tagY = vertical ? y - 12 : y - 26;
  let shape;
  if (n.kind === "detour") {
    const diamond = { x: x - 13, y: y - 13, width: 26, height: 26, rx: 5, transform: `rotate(45 ${x} ${y})` };
    shape = (
      <>
        {n.status === "open" && <rect className="pulse" {...diamond} fill="var(--detour)" />}
        <rect className="shape" {...diamond} fill="var(--panel)" stroke="var(--detour)" strokeWidth={4} />
        <text x={textX} y={vertical ? tagY : y - 30} textAnchor={anchor} fontSize={11} fontWeight={700} style={{ fill: "var(--detour)" }}>
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
          <text x={textX} y={tagY} textAnchor={anchor} fontSize={11} style={{ fill: "var(--detour)" }}>
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
      <title>{n.kind === "task" && n.summary ? `${label}\n${plainText(n.summary)}` : label}</title>
      {shape}
      <text x={textX} y={titleY} textAnchor={anchor} fontSize={13} fontWeight={active ? 700 : 500} textDecoration={dropped ? "line-through" : undefined}>
        {lines.map((l, i) => (
          <tspan key={i} x={textX} dy={i ? 15 : 0}>
            {l}
          </tspan>
        ))}
      </text>
      {n.kind === "task" && <FileChips files={n.code} x={textX} y={titleY + (lines.length - 1) * 15 + 7} centred={!vertical} />}
    </g>
  );
}
