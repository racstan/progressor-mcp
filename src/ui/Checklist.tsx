import type { DetourNode, GoalGraph, GraphNode, TaskNode } from "../dashboard/graph.js";
import { STATUS_LABEL } from "./geometry.js";
import { checklistRows } from "./views.js";

type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

interface Props {
  graph: GoalGraph;
  fileLink: FileLink;
  /** Opens the item's popover (Open in file, Copy as prompt). */
  onOpen: (node: GraphNode, at: { x: number; y: number }) => void;
}

const MARK: Record<TaskNode["status"], string> = { done: "✓", "in progress": "▶", pending: "○", dropped: "✕" };

/** The selected Goal as a plain list in plan order, with each Detour indented under its Task. */
export function Checklist({ graph, fileLink, onOpen }: Props) {
  const open = (n: GraphNode) => (e: React.MouseEvent) => onOpen(n, { x: e.clientX, y: e.clientY });
  return (
    <div className="checklist-wrap">
      <ol className="checklist" aria-label="Tasks in plan order">
        {checklistRows(graph).map((row) => (
          <li key={row.task?.id ?? "start"} className={`row ${row.task ? `task ${row.task.status.replace(" ", "-")}` : "loose"}`}>
            {row.task && <TaskLine task={row.task} fileLink={fileLink} onOpen={open(row.task)} />}
            {row.detours.length > 0 && (
              <ul className="detours">
                {row.detours.map((d) => (
                  <DetourBlock key={d.id} detour={d} onOpen={open(d)} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TaskLine({ task: t, fileLink, onOpen }: { task: TaskNode; fileLink: FileLink; onOpen: (e: React.MouseEvent) => void }) {
  return (
    <>
      <div className="line">
        <span className={`mark ${t.status.replace(" ", "-")}`} aria-hidden="true">
          {MARK[t.status]}
        </span>
        <button className="title" onClick={onOpen} aria-label={`Task ${t.id}: ${t.title} (${STATUS_LABEL[t.status]})`}>
          {t.title}
        </button>
        <span className="tag">{t.id}</span>
        {t.status === "in progress" && <span className="tag now">in progress</span>}
        {t.fromDetour && <span className="tag detour">from Detour</span>}
        {t.status === "dropped" && <span className="tag">dropped{t.droppedBy ? ` by ${t.droppedBy}` : ""}</span>}
      </div>
      {(t.code.length > 0 || t.summary) && (
        <div className="detail">
          {t.summary && <p className="summary">{t.summary}</p>}
          {t.code.length > 0 && (
            <div className="file-chips">
              {t.code.map((c) => {
                const m = /^(.+?)(?::(\d+))?$/.exec(c);
                return (
                  <a key={c} className="file-chip" title={`Open ${c}`} {...fileLink(m?.[1] ?? c, m?.[2] ? Number(m[2]) : undefined)}>
                    {c}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DetourBlock({ detour: d, onOpen }: { detour: DetourNode; onOpen: (e: React.MouseEvent) => void }) {
  return (
    <li className={`detour ${d.status.replace(" ", "-")}`}>
      <div className="line">
        <span className="mark detour" aria-hidden="true">
          ◆
        </span>
        <button className="title" onClick={onOpen} aria-label={`Detour ${d.id}: ${d.title} (${STATUS_LABEL[d.status]})`}>
          {d.title}
        </button>
        <span className="tag">{d.id}</span>
        <span className="tag ending">{STATUS_LABEL[d.status]}</span>
      </div>
      {d.reason && <p className="reason">{d.reason}</p>}
    </li>
  );
}
