import { useState } from "react";
import { hardFirst } from "../roadmap.js";
import { contextBlocks } from "./context.js";
import { addRule, changeRule, removeRule, saveContext } from "./data.js";
import { RichText } from "./RichText.js";
import { useSend } from "./Talk.js";
import { inlineCode } from "./text.js";

type Rule = { id?: string; text: string; hard?: boolean; helpersAtOnce?: number };

/** MAX_CONTEXT_LENGTH in project.ts, which the page cannot import. */
const MAX_CONTEXT = 4000;
const TOLD = "Your AI is told about each change at its next step.";

const code = (text: string) => inlineCode(text).map((s, i) => (s.code ? <code key={i}>{s.text}</code> : s.text));

/**
 * The project's rules and background. The AI keeps them, and the person can add, reword and remove
 * rules and rewrite the background here; the server tells the AI about each change.
 */
export function ContextPage({ projectId, rules, context, onChanged }: { projectId: string; rules: Rule[]; context: string; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const blocks = contextBlocks(context);
  return (
    <div className="page">
      <h1 className="page-title">Project notes</h1>
      <p className="page-sub">Your AI keeps these up to date, and you can change them too. {TOLD}</p>
      <section className="section">
        <h2>Rules your AI follows</h2>
        {rules.length === 0 && !adding && <p className="empty">No rules yet. Add one here, or tell your AI a lasting rule in the chat.</p>}
        {rules.length > 0 && (
          <ol className="rules">
            {hardFirst(rules.map((r) => ({ ...r, hard: r.hard === true }))).map((r, i) => (
              <RuleRow key={r.id ?? i} projectId={projectId} rule={r} onChanged={onChanged} />
            ))}
          </ol>
        )}
        {adding ? (
          <RuleForm submit="Add rule" onCancel={() => setAdding(false)}
            save={(text, hard) => addRule(projectId, text, hard)} onSaved={() => { setAdding(false); onChanged(); }} />
        ) : (
          <button className="btn ghost small add-rule" onClick={() => setAdding(true)}>+ Add a rule</button>
        )}
      </section>
      <About projectId={projectId} context={context} blocks={blocks} onChanged={onChanged} />
    </div>
  );
}

function RuleRow({ projectId, rule: r, onChanged }: { projectId: string; rule: Rule & { hard: boolean }; onChanged: () => void }) {
  const [mode, setMode] = useState<"edit" | "remove">();
  const { busy, error, run } = useSend(onChanged);
  if (mode === "edit" && r.id)
    return (
      <li className={r.hard ? "must" : undefined}>
        <RuleForm submit="Save" text={r.text} hard={r.hard} onCancel={() => setMode(undefined)}
          save={(text, hard) => changeRule(projectId, r.id!, text, hard)} onSaved={() => { setMode(undefined); onChanged(); }} />
      </li>
    );
  return (
    <li className={r.hard ? "must" : undefined}>
      <div className="rule-line">
        <span className="rule-text">
          {r.hard && <b className="must-badge" title="A rule your AI must never break, as opposed to a preference">Must</b>}
          {code(r.text)}
          {r.helpersAtOnce && (
            <b className="limit-badge" title="Your AI hands at most this many steps to helpers at a time, so checking and merging their work keeps up">
              At most {r.helpersAtOnce} {r.helpersAtOnce === 1 ? "helper" : "helpers"} at once
            </b>
          )}
        </span>
        {r.id && !mode && (
          <span className="rule-actions">
            <button className="linkbtn" onClick={() => setMode("edit")}>Edit</button>
            <button className="linkbtn" onClick={() => setMode("remove")}>Remove</button>
          </span>
        )}
      </div>
      {mode === "remove" && (
        <div className="confirm" role="group" aria-label="Remove this rule?">
          <span>Remove this rule? Your AI stops following it.</span>
          <button className="btn small" disabled={busy} onClick={() => void run(() => removeRule(projectId, r.id!))}>Remove</button>
          <button className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Keep it</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}

/** Writing a rule: its words, and whether it must never be broken. */
function RuleForm({ submit, text: start = "", hard: startHard = false, save, onSaved, onCancel }: {
  submit: string;
  text?: string;
  hard?: boolean;
  save: (text: string, hard: boolean) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(start);
  const [hard, setHard] = useState(startHard);
  const { busy, error, run } = useSend(() => undefined);
  const changed = text.trim() !== start.trim() || hard !== startHard;
  return (
    <form className="note-form" onSubmit={(e) => {
      e.preventDefault();
      if (text.trim() && changed) void run(() => save(text.trim(), hard)).then((ok) => ok && onSaved());
    }}>
      <textarea rows={2} autoFocus value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
        placeholder="For example: Always ask before deleting files" aria-label="The rule"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          if (e.key === "Escape") onCancel();
        }} />
      <label className="check" title="A rule your AI must never break. Leave it unticked for a preference it follows when it can.">
        <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} /> Must never be broken
      </label>
      <div className="form-actions">
        <button type="submit" className="btn small" disabled={busy || !text.trim() || !changed}>{submit}</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={onCancel}>Cancel</button>
        <span className="hint">{TOLD}</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

function About({ projectId, context, blocks, onChanged }: { projectId: string; context: string; blocks: ReturnType<typeof contextBlocks>; onChanged: () => void }) {
  const [draft, setDraft] = useState<string>();
  const { busy, error, run } = useSend(onChanged);
  const editing = draft !== undefined;
  return (
    <section className="section context-body">
      <h2>
        About this project
        {!editing && <button className="linkbtn" onClick={() => setDraft(context)}>Edit</button>}
      </h2>
      {editing ? (
        <form className="note-form" onSubmit={(e) => {
          e.preventDefault();
          void run(() => saveContext(projectId, draft)).then((ok) => ok && setDraft(undefined));
        }}>
          <textarea rows={Math.min(24, Math.max(6, draft.split("\n").length + 1))} autoFocus value={draft} maxLength={MAX_CONTEXT}
            onChange={(e) => setDraft(e.target.value)} aria-label="About this project"
            placeholder="What the project is, key facts and choices that hold for all of it. Start a line with - for a list, and put code in `backticks`."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
              if (e.key === "Escape") setDraft(undefined);
            }} />
          <div className="form-actions">
            <button type="submit" className="btn small" disabled={busy || draft.trim() === context.trim()}>Save</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setDraft(undefined)}>Cancel</button>
            <span className="hint">{draft.length} of {MAX_CONTEXT} characters · {TOLD}</span>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </form>
      ) : blocks.length === 0 ? (
        <p className="empty">Nothing here yet. This is the project's background: what it is, key facts and choices that hold for the whole project. Your AI fills it in, or press Edit to write it yourself.</p>
      ) : (
        blocks.map((b, i) =>
          b.kind === "paragraph" ? (
            <RichText key={i} className="para" text={b.text} />
          ) : b.ordered ? (
            <ol key={i} className="ctx-list">{b.items.map((t, j) => <li key={j}>{code(t)}</li>)}</ol>
          ) : (
            <ul key={i} className="ctx-list">{b.items.map((t, j) => <li key={j}>{code(t)}</li>)}</ul>
          ),
        )
      )}
    </section>
  );
}
