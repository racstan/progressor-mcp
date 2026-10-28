import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseCodeRef } from "../dashboard/editor.js";
import type { TaskNode } from "../dashboard/graph.js";
import { type PromptSubject, copyAsPrompt } from "../dashboard/prompt.js";
import { Dates } from "./Dates.js";
import { Icon } from "./Icon.js";
import { RichText } from "./RichText.js";
import { StepMark } from "./StepKey.js";
import type { FileLink } from "./Steps.js";
import { plainText } from "./text.js";
import { GOAL_WORD, SIDE_TRIP_HINT, STEP_HINT, STEP_WORD, elsewhereTag, evidenceLine, helperLine, stepTime, stepTimes } from "./words.js";

const tasksOf = (g: { nodes: { kind: string }[] }) => g.nodes.filter((n): n is TaskNode => n.kind === "task");

// The details of a stop clicked on the map: what it is, where it stands, and Copy for your AI.

interface Location {
  path: string;
  line?: number;
  label: string;
}

function describe(subject: PromptSubject): { title: string; meta: string; state?: string; time?: string; summary?: string; evidence?: string; helper?: string; reason?: string; locations: Location[] } {
  switch (subject.kind) {
    case "node": {
      const { node: n, goal, graph } = subject;
      const main = { path: goal.planFile, line: n.line, label: `${goal.planFile}:${n.line}` };
      if (n.kind === "detour")
        return { title: n.title, meta: `Side trip · ${STEP_WORD[n.status]}`, summary: SIDE_TRIP_HINT[n.status], reason: n.reason && `Why: ${n.reason}`, locations: [main] };
      const code = n.code.map((c) => ({ ...parseCodeRef(c), label: c }));
      const live = tasksOf(graph).filter((t) => t.status !== "dropped").sort((a, b) => a.line - b.line);
      const number = live.findIndex((t) => t.id === n.id);
      const which = number >= 0 ? `Step ${number + 1} of ${live.length}` : "Step";
      const elsewhere = elsewhereTag(n.updatedFrom);
      return {
        title: n.title,
        meta: `${which} · ${STEP_WORD[n.status]}${n.fromDetour ? " · added after a side trip" : ""}${elsewhere ? ` · ${elsewhere.label.toLowerCase()}` : ""}`,
        state: n.status,
        time: stepTime(n),
        summary: n.summary,
        evidence: evidenceLine(n.evidence),
        helper: helperLine(n.helper),
        reason: n.status === "dropped" && n.reason ? `Why it was cancelled: ${plainText(n.reason)}` : undefined,
        locations: [main, ...code],
      };
    }
    case "goal":
      return {
        title: subject.goal.title,
        meta: `Goal · ${GOAL_WORD[subject.goal.status]}`,
        summary: subject.goal.outcome && `Finished when: ${subject.goal.outcome}`,
        locations: [{ path: subject.goal.planFile, label: subject.goal.planFile }],
      };
    default:
      return { title: "", meta: "", locations: [] };
  }
}

export function Popover({ subject, at, onClose, fileLink, files, onCopy, onReveal }: {
  subject: PromptSubject;
  at: { x: number; y: number };
  onClose: () => void;
  fileLink: FileLink;
  /** Whether to show the files and the buttons that open them. */
  files: boolean;
  onCopy: (text: string) => void;
  /** Opens the file manager at a file of the project. */
  onReveal?: (path: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x + 12, top: at.y + 12 });
  const d = describe(subject);
  const prompt = copyAsPrompt(subject);

  useLayoutEffect(() => {
    const el = ref.current!;
    setPos({
      left: Math.max(10, Math.min(at.x + 12, innerWidth - el.offsetWidth - 10)),
      top: Math.max(10, Math.min(at.y + 12, innerHeight - el.offsetHeight - 10)),
    });
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".pop") && !t.closest("[data-node]") && !t.closest(".card")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);

  const [first] = d.locations;
  return (
    <div ref={ref} className="pop" role="dialog" aria-label={d.title} tabIndex={-1} style={pos}>
      <button className="iconbtn x" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
      <h4>{d.title}</h4>
      <div className="meta">{d.meta}</div>
      {subject.kind === "node" && subject.node.kind === "task" && stepTimes(subject.node).line && (
        <div className="meta" title={stepTimes(subject.node).title}>{stepTimes(subject.node).line}</div>
      )}
      <Dates item={subject.kind === "node" && subject.node.kind === "task" ? subject.node : undefined} />
      {d.time && <div className="meta time" title="How long your AI expected this step to take, and how long it has taken. Time paused (back to To do) does not count.">{d.time}</div>}
      {d.state && STEP_HINT[d.state] && (
        <div className="meta"><StepMark status={d.state} /> {STEP_HINT[d.state]}</div>
      )}
      {d.summary && <RichText className="summary" text={d.summary} />}
      {d.evidence && <div className="meta">{d.evidence}</div>}
      {d.helper && <div className="meta">{d.helper}</div>}
      {d.reason && <RichText className="reason" text={d.reason} />}
      {files && <div className="locs">
        {d.locations.map((l) => (
          <a key={l.label} {...fileLink(l.path, l.line)}>
            {l.label}
          </a>
        ))}
      </div>}
      <details>
        <summary>What gets copied</summary>
        <pre>{prompt}</pre>
      </details>
      <div className="row">
        <button className="btn" title="Copies a short pointer to this; paste it into your AI chat and say what you want" onClick={() => onCopy(prompt)}>Copy for your AI</button>
        {files && first && <a className="btn ghost" title="Open it in your code editor" {...fileLink(first.path, first.line)}>Open in file</a>}
        {onReveal && first && <button className="btn ghost" title="Opens the folder it is saved in" onClick={() => onReveal(first.path)}>Show in folder</button>}
      </div>
    </div>
  );
}
