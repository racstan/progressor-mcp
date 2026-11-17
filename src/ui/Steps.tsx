import { useState } from "react";
import type { DetourNode, TaskNode } from "../dashboard/graph.js";
import { parseCodeRef } from "../dashboard/editor.js";
import { copyAsPrompt } from "../dashboard/prompt.js";
import { type GoalView, type StepCiView, useStored } from "./data.js";
import { ChecksBadge, PullRequestLinks } from "./CiBadges.js";
import { STEPS_VIEW_DEFAULT, STEPS_VIEW_KEY, type StepsView, isStepsView, stepDayGroups } from "./goalList.js";
import { Dates } from "./Dates.js";
import { Icon } from "./Icon.js";
import { type PictureItem, Pictures } from "./Pictures.js";
import { RichText } from "./RichText.js";
import { waitingLine } from "./others.js";
import { plainText } from "./text.js";
import { checklistRows } from "./views.js";
import { NOT_SAVED, NOT_SAVED_HINT, SIDE_TRIP_HINT, STEP_HINT, STEP_WORD, commitsLabel, elsewhereTag, evidenceLine, finishedAt, helperLine, statusClass, stepTime, stepTimes, stepWhen, testsLabel } from "./words.js";

export type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

/** The round mark in front of a step: empty to do, a dot while worked on, a tick once done. */
export function StepIcon({ status }: { status: string }) {
  const tick = status === "done" || status === "released" || status === "checked";
  return (
    <span className={`step-icon ${statusClass(status)}`} aria-hidden="true">
      {tick && <Icon name="check" size={12} />}
      {status === "waiting on you" && "!"}
      {status === "waiting on someone" && "…"}
    </span>
  );
}

/**
 * A goal's steps in plan order, each a row that opens to show what it does, what was checked and the
 * files it changed. Side trips sit under the step they left from. Cancelled steps wait behind a link.
 */
export function Steps({ view, ci = {}, fileLink, onCopy, onReveal }: { view: GoalView; ci?: Record<string, StepCiView>; fileLink: FileLink; onCopy: (text: string) => void; onReveal: () => void }) {
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
  const [stored, setStored] = useStored<StepsView>(STEPS_VIEW_KEY, undefined);
  const stepsView: StepsView = isStepsView(stored) ? stored : STEPS_VIEW_DEFAULT;
  if (rows.length === 0)
    return <p className="quiet">No steps yet. Your AI adds them as it plans, and this page updates by itself.</p>;
  const shown = rows.filter((row) => !row.task || cancelled || row.task.status !== "dropped" || row.detours.length > 0);
  const items = (list: typeof rows) =>
    list.flatMap((row) => [
      ...(row.task && (cancelled || row.task.status !== "dropped")
        ? [<Step key={row.task.id} task={row.task} open={open.has(row.task.id)} onToggle={() => toggle(row.task!.id)} pictures={view.pictures.filter((p) => p.task === row.task!.id)} fileLink={fileLink} onCopy={() => copy(row.task!)} onReveal={onReveal} commitLink={view.commitLink} ci={ci[row.task.id]} />]
        : []),
      ...row.detours.map((d) => <SideTrip key={d.id} detour={d} open={open.has(d.id)} onToggle={() => toggle(d.id)} onCopy={() => copy(d)} />),
    ]);
  const pick = (v: StepsView) => setStored(v === STEPS_VIEW_DEFAULT ? undefined : v);
  const finishedRow = (row: (typeof rows)[number]) => !!row.task && finishedAt(row.task) !== undefined;
  return (
    <>
      <div className="steps-view" role="group" aria-label="How the steps are shown">
        <button className="linkbtn" aria-pressed={stepsView === "plan"} onClick={() => pick("plan")}>In plan order</button>
        <button className="linkbtn" aria-pressed={stepsView === "newest"} onClick={() => pick("newest")}>By day finished, newest first</button>
        <button className="linkbtn" aria-pressed={stepsView === "oldest"} onClick={() => pick("oldest")}>By day finished, oldest first</button>
      </div>
      {stepsView === "plan" ? (
        <ol className="steps" aria-label="Steps in order">{items(rows)}</ol>
      ) : (
        stepDayGroups(shown, finishedRow, (row) => (row.task ? finishedAt(row.task) : undefined), stepsView).map((g) => (
          <section key={g.key} className="steps-day-group">
            <h4 className="steps-day">{g.heading}</h4>
            <ol className="steps" aria-label={g.heading}>{items(g.items)}</ol>
          </section>
        ))
      )}
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

/** What git said when a step was finished: its commits (linked when the project's remote is known), branch and tests. */
function GitFacts({ task: t, commitLink, ci }: { task: TaskNode; commitLink: string | undefined; ci: StepCiView | undefined }) {
  const saved = commitsLabel(t);
  const tests = testsLabel(t.tests);
  if (!saved && !tests && !t.uncommitted && !ci) return null;
  return (
    <div className="meta git-facts">
      {saved && <span>Saved in git: {saved}</span>}
      {t.commits?.map((c) =>
        commitLink ? (
          <a key={c} className="commit" href={`${commitLink}${c}`} target="_blank" rel="noopener noreferrer" title={`See commit ${c}`}>{c}</a>
        ) : (
          <code key={c} className="commit">{c}</code>
        ),
      )}
      {ci && <PullRequestLinks prs={ci.prs} />}
      {ci && <ChecksBadge checks={ci.checks} />}
      {tests && <span>{tests}</span>}
      {t.uncommitted && <span className="not-saved" title={NOT_SAVED_HINT}>{NOT_SAVED}</span>}
    </div>
  );
}

function Step({ task: t, open, onToggle, pictures, fileLink, onCopy, onReveal, commitLink, ci }: { task: TaskNode; open: boolean; onToggle: () => void; pictures: PictureItem[]; fileLink: FileLink; onCopy: () => void; onReveal: () => void; commitLink?: string; ci?: StepCiView | undefined }) {
  const elsewhere = elsewhereTag(t.updatedFrom);
  const meta = [stepTime(t), helperLine(t.helper), t.fromDetour && "Added after a side trip", elsewhere?.label].filter(Boolean).join(" · ");
  const cls = t.status === "in progress" ? "now" : t.status === "waiting on you" ? "you" : statusClass(t.status);
  const times = stepTimes(t);
  return (
    <li className={`step ${cls}`}>
      <button className="step-row" aria-expanded={open} onClick={onToggle} title={STEP_HINT[t.status]}>
        <StepIcon status={t.status} />
        <span className="t">
          {t.title}
          {/* Checks that failed or still run show on the row itself; passed ones wait in the details. */}
          {ci?.checks && ci.checks !== "passed" && <ChecksBadge checks={ci.checks} />}
        </span>
        <span className="end" title={times.title || undefined}>{stepWhen(t)}</span>
        {t.status === "waiting on someone" && <span className="holder">{waitingLine(t.waitingFor, t.need)}</span>}
      </button>
      {open && (
        <div className="step-detail">
          {t.summary ? <RichText className="summary" text={t.summary} /> : <p className="summary">No details yet.</p>}
          {evidenceLine(t.evidence) && <div className="meta">{evidenceLine(t.evidence)}</div>}
          <GitFacts task={t} commitLink={commitLink} ci={ci} />
          {t.status === "dropped" && t.reason && <div className="meta">Why it was cancelled: {plainText(t.reason)}</div>}
          {meta && <div className="meta">{meta}</div>}
          {times.line && <div className="meta" title={times.title}>{times.line}</div>}
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
