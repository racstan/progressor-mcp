import type { GoalView, RoadmapView } from "./data.js";
import { Dates } from "./Dates.js";
import { RichText } from "./RichText.js";
import { elsewhereTag, noteOrigin } from "./words.js";

type Goals = RoadmapView["goals"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the AI noticed and decided while working on a Goal, read-only. A list with nothing in it is
 * left out. A note that is settled is folded away, and one found while working on another goal says which.
 */
export function GoalNotes({ view, goals }: { view: Pick<GoalView, "decisions" | "notes">; goals: Goals }) {
  const { decisions, notes } = view;
  if (decisions.length === 0 && notes.length === 0) return null;
  const open = notes.filter((n) => !n.resolved);
  const settled = notes.filter((n) => n.resolved);
  return (
    <>
      {notes.length > 0 && (
        <section className="notes-block">
          <h3>Noticed along the way <span className="quiet">· {open.length} open</span></h3>
          {open.length > 0 ? <ul>{open.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} />)}</ul> : <p className="quiet">Nothing open. Every note here has been dealt with.</p>}
          {settled.length > 0 && (
            <details className="settled">
              <summary>{plural(settled.length, "note", "notes")} dealt with</summary>
              <ul>{settled.map((n, i) => <Note key={n.id ?? i} note={n} goals={goals} />)}</ul>
            </details>
          )}
        </section>
      )}
      {decisions.length > 0 && (
        <section className="notes-block">
          <h3>Decisions <span className="quiet">· {decisions.length}</span></h3>
          <ul>
            {decisions.map((d, i) => (
              <li key={d.id ?? i}><RichText className="text" text={d.text} /><Dates item={d} className="origin" /><Elsewhere item={d} /></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Note({ note, goals }: { note: GoalView["notes"][number]; goals: Goals }) {
  const origin = noteOrigin(note.from, goals);
  return (
    <li className={note.resolved ? "resolved" : undefined}>
      <RichText className="text" text={note.text} />
      {origin && <div className="origin">{origin}</div>}
      <Dates item={note} className="origin" />
      <Elsewhere item={note} />
    </li>
  );
}

/** "Updated from rachitkdeaichat", under a decision or note an AI chat in another project changed. */
function Elsewhere({ item }: { item: { updatedFrom?: GoalView["notes"][number]["updatedFrom"] } }) {
  const tag = elsewhereTag(item.updatedFrom);
  return tag ? <div className="origin elsewhere" title={tag.hint}>{tag.label}</div> : null;
}
