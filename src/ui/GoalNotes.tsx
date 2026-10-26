import type { GoalView, RoadmapView } from "./data.js";
import { RichText } from "./RichText.js";
import { noteOrigin } from "./words.js";

type Goals = RoadmapView["goals"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the AI decided and what it noticed while working on a Goal, read-only. A list with nothing in
 * it is left out; with neither, so is the whole section. A note that is settled is dimmed and folded
 * away, and one found while working on another goal says which.
 */
export function GoalNotes({ view, goals, dock }: { view: Pick<GoalView, "decisions" | "notes">; goals: Goals; dock?: boolean }) {
  const { decisions, notes } = view;
  if (decisions.length === 0 && notes.length === 0) return null;
  const open = notes.filter((n) => !n.resolved);
  const settled = notes.filter((n) => n.resolved);
  const body = (
    <div className="notes-body">
      {decisions.length > 0 && (
        <div className="notes-col">
          <h3>Decisions <span className="count">{decisions.length}</span></h3>
          <ul className="decisions">
            {decisions.map((d, i) => (
              <li key={d.id ?? i}><RichText className="text" text={d.text} /></li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="notes-col">
          <h3>Notes <span className="count">{notes.length}</span></h3>
          {open.length > 0 && <ul className="notes">{open.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} />)}</ul>}
          {open.length === 0 && <p className="quiet">Nothing open. Every note here has been dealt with.</p>}
          {settled.length > 0 && (
            <details className="settled">
              <summary>{plural(settled.length, "note", "notes")} dealt with</summary>
              <ul className="notes resolved">{settled.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} />)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
  if (!dock) return <section className="goal-notes" aria-label="Decisions and notes">{body}</section>;
  const summary = [
    decisions.length > 0 && plural(decisions.length, "decision", "decisions"),
    notes.length > 0 && `${plural(notes.length, "note", "notes")}${open.length < notes.length ? ` (${open.length} open)` : ""}`,
  ].filter(Boolean).join(" · ");
  return (
    <details className="goal-notes dock" open>
      <summary>{summary}</summary>
      {body}
    </details>
  );
}

function Note({ note, goals }: { note: GoalView["notes"][number]; goals: Goals }) {
  const origin = noteOrigin(note.from, goals);
  return (
    <li className={note.resolved ? "resolved" : undefined}>
      <RichText className="text" text={note.text} />
      {origin && <div className="origin">{origin}</div>}
    </li>
  );
}
