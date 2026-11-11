import { useState } from "react";
import { type GoalView, type RoadmapView, changeDecision, changeNote, deleteDecision, deleteNote } from "./data.js";
import { Dates } from "./Dates.js";
import { RichText } from "./RichText.js";
import { RemoveLink, useSend } from "./Talk.js";
import { elsewhereTag, noteOrigin } from "./words.js";

type Goals = RoadmapView["goals"];
type Where = { projectId: string; goalId: string; onChanged: () => void };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TOLD = "Your AI is told at its next step.";

/**
 * What the AI noticed and decided while working on a Goal. The person can reword or delete each one,
 * and mark a note dealt with or open again; the AI is told of each change. A list with nothing in it
 * is left out. A note that is settled is folded away, and one found while working on another goal says which.
 */
export function GoalNotes({ view, goals, ...where }: { view: Pick<GoalView, "decisions" | "notes">; goals: Goals } & Where) {
  const { decisions, notes } = view;
  if (decisions.length === 0 && notes.length === 0) return null;
  const open = notes.filter((n) => !n.resolved);
  const settled = notes.filter((n) => n.resolved);
  return (
    <>
      {notes.length > 0 && (
        <section className="notes-block">
          <h3>Noticed along the way <span className="quiet">· {open.length} open</span></h3>
          {open.length > 0 ? <ul>{open.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} {...where} />)}</ul> : <p className="quiet">Nothing open. Every note here has been dealt with.</p>}
          {settled.length > 0 && (
            <details className="settled">
              <summary>{plural(settled.length, "note", "notes")} dealt with</summary>
              <ul>{settled.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} {...where} />)}</ul>
            </details>
          )}
        </section>
      )}
      {decisions.length > 0 && (
        <section className="notes-block">
          <h3>Decisions <span className="quiet">· {decisions.length}</span></h3>
          <ul>{decisions.map((d, i) => <Decision key={d.id ?? i} decision={d} {...where} />)}</ul>
        </section>
      )}
    </>
  );
}

function Note({ note, goals, projectId, goalId, onChanged }: { note: GoalView["notes"][number]; goals: Goals } & Where) {
  const origin = noteOrigin(note.from, goals);
  const [editing, setEditing] = useState(false);
  const { busy, error, run } = useSend(onChanged);
  if (editing && note.id)
    return (
      <li className={note.resolved ? "resolved" : undefined}>
        <EditText start={note.text} label="The note" onCancel={() => setEditing(false)} save={(text) => changeNote(projectId, goalId, note.id!, { text })} onSaved={() => { setEditing(false); onChanged(); }} />
      </li>
    );
  return (
    <li className={note.resolved ? "resolved" : undefined}>
      <RichText className="text" text={note.text} />
      {origin && <div className="origin">{origin}</div>}
      <Dates item={note} className="origin" />
      <Elsewhere item={note} />
      {note.id && (
        <div className="item-actions">
          <button type="button" className="linkbtn" disabled={busy} onClick={() => void run(() => changeNote(projectId, goalId, note.id!, { resolved: !note.resolved }))}>
            {note.resolved ? "Open again" : "Dealt with"}
          </button>
          <button type="button" className="linkbtn reveal-on-hover" onClick={() => setEditing(true)}>Edit</button>
          <RemoveLink what="this note" told={TOLD} onRemove={() => deleteNote(projectId, goalId, note.id!)} onChanged={onChanged} />
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}

function Decision({ decision: d, projectId, goalId, onChanged }: { decision: GoalView["decisions"][number] } & Where) {
  const [editing, setEditing] = useState(false);
  if (editing && d.id)
    return (
      <li>
        <EditText start={d.text} label="The decision" onCancel={() => setEditing(false)} save={(text) => changeDecision(projectId, goalId, d.id!, text)} onSaved={() => { setEditing(false); onChanged(); }} />
      </li>
    );
  return (
    <li>
      <RichText className="text" text={d.text} />
      <Dates item={d} className="origin" />
      <Elsewhere item={d} />
      {d.id && (
        <div className="item-actions">
          <button type="button" className="linkbtn reveal-on-hover" onClick={() => setEditing(true)}>Edit</button>
          <RemoveLink what="this decision" told={TOLD} onRemove={() => deleteDecision(projectId, goalId, d.id!)} onChanged={onChanged} />
        </div>
      )}
    </li>
  );
}

/** Rewording a note or decision in place. */
function EditText({ start, label, save, onSaved, onCancel }: { start: string; label: string; save: (text: string) => Promise<void>; onSaved: () => void; onCancel: () => void }) {
  const [text, setText] = useState(start);
  const { busy, error, run } = useSend(() => undefined);
  const changed = text.trim() !== start.trim();
  return (
    <form className="note-form" onSubmit={(e) => {
      e.preventDefault();
      if (text.trim() && changed) void run(() => save(text.trim())).then((ok) => ok && onSaved());
    }}>
      <textarea rows={3} autoFocus value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          if (e.key === "Escape") onCancel();
        }} />
      <div className="form-actions">
        <button type="submit" className="btn small" disabled={busy || !text.trim() || !changed}>Save</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={onCancel}>Cancel</button>
        <span className="hint">{TOLD}</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

/** "Updated from rachitkdeaichat", under a decision or note an AI chat in another project changed. */
function Elsewhere({ item }: { item: { updatedFrom?: GoalView["notes"][number]["updatedFrom"] } }) {
  const tag = elsewhereTag(item.updatedFrom);
  return tag ? <div className="origin elsewhere" title={tag.hint}>{tag.label}</div> : null;
}
