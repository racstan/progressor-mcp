import { useState } from "react";
import { hardFirst } from "../roadmap.js";
import { contextBlocks, contextWithCopied, rulesToCopy } from "./context.js";
import { addRule, changeRule, removeRule, saveContext, useGlobal } from "./data.js";
import { Highlighted, RichText } from "./RichText.js";
import { RoutinesCard } from "./RoutinesCard.js";
import { RemoveLink, useSend } from "./Talk.js";
import { busyClass } from "./Loading.js";

type Rule = { id?: string; text: string; hard?: boolean; helpersAtOnce?: number };

/** Where rule and context changes go: one project's notes, or the ones for every project (Home). */
export interface NotesApi {
  add(text: string, hard: boolean): Promise<void>;
  change(id: string, text: string, hard: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  saveContext(text: string): Promise<void>;
}

const projectNotes = (projectId: string): NotesApi => ({
  add: (text, hard) => addRule(projectId, text, hard),
  change: (id, text, hard) => changeRule(projectId, id, text, hard),
  remove: (id) => removeRule(projectId, id),
  saveContext: (text) => saveContext(projectId, text),
});

/** MAX_CONTEXT_LENGTH in project.ts, which the page cannot import. */
const MAX_CONTEXT = 4000;
const TOLD = "Your AI is told about each change at its next step.";

const code = (text: string) => <Highlighted text={text} />;

/**
 * The project's rules and background. The AI keeps them, and the person can add, reword and remove
 * rules and rewrite the background here; the server tells the AI about each change.
 */
export function ContextPage({ projectId, rules, context, onChanged, version, heading }: { projectId: string; heading: string; rules: Rule[]; context: string; onChanged: () => void; version?: unknown }) {
  const [adding, setAdding] = useState(false);
  const api = projectNotes(projectId);
  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
      <p className="page-sub">Your AI keeps these up to date, and you can change them too. {TOLD}</p>
      <section className="section">
        <h2>Rules your AI follows</h2>
        {rules.length === 0 && !adding && <p className="empty">No rules yet. Add one here, or tell your AI a lasting rule in the chat.</p>}
        {rules.length > 0 && (
          <ol className="rules">
            {hardFirst(rules.map((r) => ({ ...r, hard: r.hard === true }))).map((r, i) => (
              <RuleRow key={r.id ?? i} api={api} rule={r} onChanged={onChanged} />
            ))}
          </ol>
        )}
        {adding ? (
          <RuleForm submit="Add rule" onCancel={() => setAdding(false)}
            save={(text, hard) => api.add(text, hard)} onSaved={() => { setAdding(false); onChanged(); }} />
        ) : (
          <button className="btn ghost small add-rule" onClick={() => setAdding(true)}>+ Add a rule</button>
        )}
      </section>
      <CopyFromEverything api={api} rules={rules} context={context} onChanged={onChanged} />
      <About api={api} context={context} onChanged={onChanged} title="About this project" told={TOLD}
        empty="Nothing here yet. This is the project's background: what it is, key facts and choices that hold for the whole project. Your AI fills it in, or press Edit to write it yourself."
        placeholder="What the project is, key facts and choices that hold for all of it. Start a line with - for a list, and put code in `backticks`." />
      <RoutinesCard projectId={projectId} version={version} />
    </div>
  );
}

export function RuleRow({ api, rule: r, onChanged, told = TOLD }: { api: NotesApi; rule: Rule & { hard: boolean }; onChanged: () => void; told?: string }) {
  const [mode, setMode] = useState<"edit" | "remove">();
  const { busy, error, run } = useSend(onChanged);
  if (mode === "edit" && r.id)
    return (
      <li className={r.hard ? "must" : undefined}>
        <RuleForm submit="Save" text={r.text} hard={r.hard} onCancel={() => setMode(undefined)} told={told}
          save={(text, hard) => api.change(r.id!, text, hard)} onSaved={() => { setMode(undefined); onChanged(); }} />
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
          <button className={busyClass("btn small", busy)} disabled={busy} onClick={() => void run(() => api.remove(r.id!))}>Remove</button>
          <button className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Keep it</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}

/** Writing a rule: its words, and whether it must never be broken. */
export function RuleForm({ submit, text: start = "", hard: startHard = false, save, onSaved, onCancel, told = TOLD }: {
  submit: string;
  told?: string;
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
        <button type="submit" className={busyClass("btn small", busy)} disabled={busy || !text.trim() || !changed}>{submit}</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={onCancel}>Cancel</button>
        <span className="hint">{told}</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

/** The background text: shown with its lists and code, and edited in place. */
/**
 * Copies chosen rules and parts of the context for everything (Home) into this project's own notes.
 * They already apply here; a copy keeps them with this project's plan and can be changed for it alone.
 */
function CopyFromEverything({ api, rules, context, onChanged }: { api: NotesApi; rules: Rule[]; context: string; onChanged: () => void }) {
  const [global] = useGlobal();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<string>();
  const { busy, error, run } = useSend(onChanged);
  if (!global) return null;
  const toCopy = rulesToCopy(global.rules, rules);
  const parts = [
    { id: "computer", title: "About this computer", text: global.computer },
    { id: "me", title: "About me and how I work", text: global.me },
  ].filter((p) => p.text.trim() && !context.includes(p.text.trim()));
  if (toCopy.length === 0 && parts.length === 0 && !done) return null;
  const flip = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const copy = () =>
    void run(async () => {
      const rulesPicked = toCopy.filter((r) => picked.has(`rule:${r.id}`));
      const partsPicked = parts.filter((p) => picked.has(`part:${p.id}`));
      const merged = contextWithCopied(context, partsPicked, MAX_CONTEXT);
      if (!merged.fits) throw new Error(`This project's background would be over ${MAX_CONTEXT} characters. Shorten it first, or copy less.`);
      for (const r of rulesPicked) await api.add(r.text, r.hard);
      if (merged.added > 0) await api.saveContext(merged.text);
      const said = [rulesPicked.length > 0 && `${rulesPicked.length} ${rulesPicked.length === 1 ? "rule" : "rules"}`, merged.added > 0 && `${merged.added} ${merged.added === 1 ? "part" : "parts"} of the background`].filter(Boolean).join(" and ");
      setDone(`Copied ${said}. ${TOLD}`);
    }).then((ok) => {
      if (ok) {
        setPicked(new Set());
        setOpen(false);
      }
    });
  return (
    <section className="section copy-everything">
      {!open ? (
        <>
          {(toCopy.length > 0 || parts.length > 0) && (
            <button className="btn ghost small" onClick={() => { setOpen(true); setDone(undefined); }}>Copy from Rules and context for everything…</button>
          )}
          {done && <p className="hint" role="status">{done}</p>}
        </>
      ) : (
        <div className="copy-panel">
          <h2>Copy from Rules and context for everything</h2>
          <p className="hint">These already apply in every project. Copy one here to keep it with this project's plan, or to change it for this project only.</p>
          {toCopy.map((r) => (
            <label key={r.id} className="option">
              <input type="checkbox" checked={picked.has(`rule:${r.id}`)} onChange={() => flip(`rule:${r.id}`)} />
              <span><b>{r.hard ? "Must: " : ""}{r.text}</b><small>A rule</small></span>
            </label>
          ))}
          {parts.map((p) => (
            <label key={p.id} className="option">
              <input type="checkbox" checked={picked.has(`part:${p.id}`)} onChange={() => flip(`part:${p.id}`)} />
              <span><b>{p.title}</b><small>{p.text.length > 140 ? `${p.text.slice(0, 140)}…` : p.text}. Added to About this project.</small></span>
            </label>
          ))}
          <div className="form-actions">
            <button className={busyClass("btn small", busy)} disabled={busy || picked.size === 0} onClick={copy}>
              {picked.size === 0 ? "Pick what to copy" : `Copy ${picked.size} into this project`}
            </button>
            <button className="btn ghost small" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </div>
      )}
    </section>
  );
}

export function About({ api, context, onChanged, title, empty, placeholder, told }: {
  api: NotesApi;
  context: string;
  onChanged: () => void;
  title: string;
  /** What shows while there is no text. */
  empty: string;
  placeholder: string;
  told: string;
}) {
  const blocks = contextBlocks(context);
  const [draft, setDraft] = useState<string>();
  const { busy, error, run } = useSend(onChanged);
  const editing = draft !== undefined;
  return (
    <section className="section context-body">
      <h2>
        {title}
        {!editing && <button className="linkbtn" onClick={() => setDraft(context)}>Edit</button>}
        {!editing && context.trim() && <RemoveLink what={`everything in “${title}”`} told={told} onRemove={() => api.saveContext("")} onChanged={onChanged} />}
      </h2>
      {editing ? (
        <form className="note-form" onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.saveContext(draft)).then((ok) => ok && setDraft(undefined));
        }}>
          <textarea rows={Math.min(24, Math.max(6, draft.split("\n").length + 1))} autoFocus value={draft} maxLength={MAX_CONTEXT}
            onChange={(e) => setDraft(e.target.value)} aria-label={title}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
              if (e.key === "Escape") setDraft(undefined);
            }} />
          <div className="form-actions">
            <button type="submit" className={busyClass("btn small", busy)} disabled={busy || draft.trim() === context.trim()}>Save</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setDraft(undefined)}>Cancel</button>
            <span className="hint">{draft.length} of {MAX_CONTEXT} characters · {told}</span>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </form>
      ) : blocks.length === 0 ? (
        <p className="empty">{empty}</p>
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
