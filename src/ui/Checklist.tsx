import type { DetourNode, GoalGraph, GraphNode, TaskNode } from "../dashboard/graph.js";
import { RichText } from "./RichText.js";
import { plainText } from "./text.js";
import { checklistRows } from "./views.js";
import { StepKey } from "./StepKey.js";
import { SIDE_TRIP_HINT, STEP_HINT, STEP_MARK, STEP_WORD, elsewhereTag, evidenceLine, helperLine, isBadge, statusClass } from "./words.js";

type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

interface Props {
  graph: GoalGraph;
  fileLink: FileLink;
  /** Whether each step shows the files it changes. */
  files: boolean;
  /** Opens the item's popover (Open in file, Copy as prompt). */
  onOpen: (node: GraphNode, at: { x: number; y: number }) => void;
  /** Shown under the list, such as the Goal's decisions and notes. */
  footer?: React.ReactNode;
}

/** The selected Goal as a plain list in plan order, with each Detour indented under its Task. */
export function Checklist({ graph, fileLink, files, onOpen, footer }: Props) {
  const open = (n: GraphNode) => (e: React.MouseEvent) => onOpen(n, { x: e.clientX, y: e.clientY });
  return (
    <div className="checklist-wrap">
      <ol className="checklist" aria-label="Steps in order">
        {checklistRows(graph).map((row) => (
          <li key={row.task?.id ?? "start"} className={`row ${row.task ? `task ${statusClass(row.task.status)}` : "loose"}`}>
            {row.task && <TaskLine task={row.task} fileLink={fileLink} files={files} onOpen={open(row.task)} />}
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
      <StepKey statuses={graph.nodes.flatMap((n) => (n.kind === "task" ? [n.status] : []))} className="checklist-key" />
      {footer}
    </div>
  );
}

function TaskLine({ task: t, fileLink, files, onOpen }: { task: TaskNode; fileLink: FileLink; files: boolean; onOpen: (e: React.MouseEvent) => void }) {
  const elsewhere = elsewhereTag(t.updatedFrom);
  const helper = helperLine(t.helper);
  const evidence = evidenceLine(t.evidence);
  return (
    <>
      <div className="line">
        <span className={`mark ${statusClass(t.status)} ${isBadge(t.status) ? "mk" : ""}`} aria-hidden="true">
          {STEP_MARK[t.status]}
        </span>
        <button className="title" onClick={onOpen} aria-label={`Step: ${t.title} (${STEP_WORD[t.status]})`}>
          {t.title}
        </button>
        {t.status === "in progress" && <span className="tag now">working on it</span>}
        {isBadge(t.status) && <span className={`tag state ${statusClass(t.status)}`} title={STEP_HINT[t.status]}>{STEP_WORD[t.status]!.toLowerCase()}</span>}
        {t.fromDetour && <span className="tag detour" title="The AI added this step after a side trip">from a side trip</span>}
        {elsewhere && <span className="tag elsewhere" title={elsewhere.hint}>{elsewhere.label}</span>}
        {t.status === "dropped" && <span className="tag" title={t.reason ? plainText(t.reason) : "This step will not be done"}>cancelled</span>}
      </div>
      {((files && t.code.length > 0) || t.summary || helper || evidence) && (
        <div className="detail">
          {t.summary && <RichText className="summary" text={t.summary} />}
          {evidence && <div className="evidence" title="What the AI checked before it called this step checked">{evidence}</div>}
          {helper && <div className="helper-info" title="Where the helper's work is">{helper}</div>}
          {files && t.code.length > 0 && (
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
    <li className={`detour ${statusClass(d.status)}`}>
      <div className="line">
        <span className="mark detour" aria-hidden="true">
          ◆
        </span>
        <button className="title" onClick={onOpen} aria-label={`Side trip: ${d.title} (${STEP_WORD[d.status]})`}>
          {d.title}
        </button>
        <span className="tag ending" title={SIDE_TRIP_HINT[d.status]}>{STEP_WORD[d.status]}</span>
      </div>
      {d.reason && <RichText className="reason" text={d.reason} />}
    </li>
  );
}
