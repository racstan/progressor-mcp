import { useState } from "react";
import { type GoalView, type HandMark, markHandTest } from "./data.js";
import { Icon } from "./Icon.js";
import { RichText } from "./RichText.js";
import { HAND_WORD, handTestsLine } from "./words.js";

type Test = GoalView["handTests"][number];

interface Props {
  projectId: string;
  goalId: string;
  view: Pick<GoalView, "handTests" | "graph">;
  /** Loads the plan again now, so a mark shows before the server's change notice arrives. */
  onChanged: () => void;
}

/** The title of a step, for "About: ...". */
function stepTitle(view: Props["view"], id: string | undefined): string | undefined {
  const node = id ? view.graph.nodes.find((n) => n.kind === "task" && n.id === id) : undefined;
  return node?.title;
}

/** The things to try not marked yet, for where the goal says what needs the person. */
export function UntriedTests({ projectId, goalId, view, onChanged }: Props) {
  return (
    <>
      {view.handTests.filter((t) => t.result === "pending").map((t) => (
        <Item key={t.id} test={t} about={stepTitle(view, t.task)} added={undefined} projectId={projectId} goalId={goalId} onChanged={onChanged} needs />
      ))}
    </>
  );
}

/**
 * The things only the person can try by hand, with the AI's reason for each. They mark each one
 * themselves: works, doesn't work (with a short note, which adds a step for the AI) or won't test,
 * and can undo a mark.
 */
export function HandTests({ projectId, goalId, view, onChanged }: Props) {
  const tests = view.handTests;
  if (tests.length === 0) return null;
  return (
    <section className="notes-block">
      <h3>Things to try by hand <span className="quiet">· {handTestsLine(tests)}</span></h3>
      <ul className="hand-list">
        {tests.map((t) => (
          <Item key={t.id} test={t} about={stepTitle(view, t.task)} added={stepTitle(view, t.taskAdded)} projectId={projectId} goalId={goalId} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function Item({ test, about, added, projectId, goalId, onChanged, needs }: { test: Test; about: string | undefined; added: string | undefined; needs?: boolean } & Pick<Props, "projectId" | "goalId" | "onChanged">) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const mark = async (m: HandMark, text?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await markHandTest(projectId, goalId, test.id!, m, text);
      setAsking(false);
      setNote("");
      onChanged();
    } catch (e) {
      setError(`That did not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const marked = test.result !== "pending";
  return (
    <li className={`hand ${test.result.replace(/[' ]/g, "-")} ${needs ? "needs-item" : ""}`}>
      {needs && <div className="kind">Try this by hand</div>}
      <RichText className="text" text={test.text} />
      {about && <div className="about">About the step: {about}</div>}
      {marked ? (
        <div className="result">
          <span className="badge">{HAND_WORD[test.result]}</span>
          {test.note && <span className="note">“{test.note}”</span>}
          {test.result === "doesn't work" && added && <span className="added">Added a step for your AI: {added}</span>}
          <button type="button" className="linkbtn undo" disabled={busy} onClick={() => void mark("clear")}>Undo</button>
        </div>
      ) : asking ? (
        <form className="ask" onSubmit={(e) => { e.preventDefault(); void mark("doesn't work", note.trim()); }}>
          <label>
            What went wrong? <span className="quiet">(a few words; your AI reads this)</span>
            <input autoFocus value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example: it asked twice, then froze" />
          </label>
          <div className="buttons">
            <button type="submit" disabled={busy} className="btn">Doesn't work, add a step</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="buttons">
          <button type="button" disabled={busy} className="btn ghost" onClick={() => void mark("works")}><Icon name="check" /> Works</button>
          <button type="button" disabled={busy} className="btn ghost" onClick={() => setAsking(true)}><Icon name="close" /> Doesn't work</button>
          <button type="button" disabled={busy} className="linkbtn" onClick={() => void mark("won't test")}>Won't test</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}
