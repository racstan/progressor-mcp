import { useState } from "react";
import type { DetourNode, TaskNode } from "../dashboard/graph.js";
import { parseCodeRef } from "../dashboard/editor.js";
import { copyAsPrompt } from "../dashboard/prompt.js";
import type { GoalView } from "./data.js";
import { Dates } from "./Dates.js";
import { Icon } from "./Icon.js";
import { type PictureItem, Pictures } from "./Pictures.js";
import { RichText } from "./RichText.js";
import { plainText } from "./text.js";
import { checklistRows } from "./views.js";
import { SIDE_TRIP_HINT, STEP_HINT, STEP_WORD, elsewhereTag, evidenceLine, helperLine, statusClass, stepTime } from "./words.js";

export type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

/** The few words at the end of a step's row; quiet for steps to do and done, which the mark says. */
const END: Record<string, string> = {
  "in progress": "Working on it",
  "with a helper": "With a helper",
  "waiting on you": "Needs you",
  checked: "Checked",
  dropped: "Cancelled",
};

/** The round mark in front of a step: empty to do, a dot while worked on, a tick once done. */
export function StepIcon({ status }: { status: string }) {
  const tick = status === "done" || status === "released" || status === "checked";
  return (
    <span className={`step-icon ${statusClass(status)}`} aria-hidden="true">
      {tick && <Icon name="check" size={12} />}
      {status === "waiting on you" && "!"}
    </span>
  );
}

/**
 * A goal's steps in plan order, each a row that opens to show what it does, what was checked and the
 * files it changed. Side trips sit under the step they left from. Cancelled steps wait behind a link.
 */
export function Steps({ view, fileLink, onCopy, onReveal }: { view: GoalView; fileLink: FileLink; onCopy: (text: string) => void; onReveal: () => void }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [cancelled, setCancelled] = useState(false);
  const rows = checklistRows(view.graph);
  const dropped = rows.filter((r) => r.task?.status === "dropped").length;
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const copy = (node: TaskNode | DetourNode) => onCopy(copyAsPrompt({ kind: "node", node, goal: view.goal, graph: view.graph }));
  if (rows.length === 0)
    return <p className="quiet">No steps yet. Your AI adds them as it plans, and this page updates by itself.</p>;
  return (
    <>
      <ol className="steps" aria-label="Steps in order">
        {rows.flatMap((row) => [
          ...(row.task && (cancelled || row.task.status !== "dropped")
            ? [<Step key={row.task.id} task={row.task} open={open.has(row.task.id)} onToggle={() => toggle(row.task!.id)} pictures={view.pictures.filter((p) => p.task === row.task!.id)} fileLink={fileLink} onCopy={() => copy(row.task!)} onReveal={onReveal} />]
            : []),
          ...row.detours.map((d) => <SideTrip key={d.id} detour={d} open={open.has(d.id)} onToggle={() => toggle(d.id)} onCopy={() => copy(d)} />),
        ])}
      </ol>
      {dropped > 0 && (
        <div className="steps-foot">
          <button className="linkbtn" onClick={() => setCancelled(!cancelled)}>
            {cancelled ? "Hide cancelled steps" : `Show ${dropped} cancelled ${dropped === 1 ? "step" : "steps"}`}
          </button>
        </div>
      )}
    </>
  );
}

function Step({ task: t, open, onToggle, pictures, fileLink, onCopy, onReveal }: { task: TaskNode; open: boolean; onToggle: () => void; pictures: PictureItem[]; fileLink: FileLink; onCopy: () => void; onReveal: () => void }) {
  const elsewhere = elsewhereTag(t.updatedFrom);
  const meta = [stepTime(t), helperLine(t.helper), t.fromDetour && "Added after a side trip", elsewhere?.label].filter(Boolean).join(" · ");
  const cls = t.status === "in progress" ? "now" : t.status === "waiting on you" ? "you" : statusClass(t.status);
  return (
    <li className={`step ${cls}`}>
      <button className="step-row" aria-expanded={open} onClick={onToggle} title={STEP_HINT[t.status]}>
        <StepIcon status={t.status} />
        <span className="t">{t.title}</span>
        <span className="end">{END[t.status] ?? ""}</span>
      </button>
      {open && (
        <div className="step-detail">
          {t.summary ? <RichText className="summary" text={t.summary} /> : <p className="summary">No details yet.</p>}
          {evidenceLine(t.evidence) && <div className="meta">{evidenceLine(t.evidence)}</div>}
          {t.status === "dropped" && t.reason && <div className="meta">Why it was cancelled: {plainText(t.reason)}</div>}
          {meta && <div className="meta">{meta}</div>}
          <Dates item={t} />
          {t.code.length > 0 && (
            <div className="file-chips">
              {t.code.map((c) => {
                const ref = parseCodeRef(c);
                return <a key={c} className="file-chip" title={`Open ${c} in your code editor`} {...fileLink(ref.path, ref.line)}>{c}</a>;
              })}
            </div>
          )}
          <Pictures pictures={pictures} />
          <div className="actions">
            <button className="btn ghost small" onClick={onCopy} title="Copies a short pointer to this step; paste it into your AI chat and say what you want"><Icon name="copy" size={14} /> Copy for your AI</button>
            <button className="btn ghost small" onClick={onReveal} title="Opens the folder this step's plan is saved in"><Icon name="folder" size={14} /> Show in folder</button>
          </div>
        </div>
      )}
    </li>
  );
}

function SideTrip({ detour: d, open, onToggle, onCopy }: { detour: DetourNode; open: boolean; onToggle: () => void; onCopy: () => void }) {
  return (
    <li className="step side">
      <button className="step-row" aria-expanded={open} onClick={onToggle} title={SIDE_TRIP_HINT[d.status]}>
        <span className={`step-icon side ${d.status === "open" ? "open" : ""}`} aria-hidden="true" />
        <span className="t">Side trip: {d.title}</span>
        <span className="end">{STEP_WORD[d.status]}</span>
      </button>
      {open && (
        <div className="step-detail">
          {d.reason ? <RichText className="summary" text={`Why: ${d.reason}`} /> : <p className="summary">{SIDE_TRIP_HINT[d.status]}</p>}
          <div className="actions">
            <button className="btn ghost small" onClick={onCopy}><Icon name="copy" size={14} /> Copy for your AI</button>
          </div>
        </div>
      )}
    </li>
  );
}
