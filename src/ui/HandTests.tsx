import { useState } from "react";
import { type GoalView, type HandMark, markHandTest } from "./data.js";
import { RichText } from "./RichText.js";
import { HAND_WORD, handTestsLine, handTestsOpen } from "./words.js";

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

/**
 * The things only the person can try by hand, with the AI's reason for each. They mark each one
 * themselves: works, doesn't work (with a short note, which adds a step for the AI) or won't test,
 * and can undo a mark. Open while something is still to try, folded once everything is marked.
 */
export function HandTests({ projectId, goalId, view, onChanged }: Props) {
  const tests = view.handTests;
  if (tests.length === 0) return null;
  const open = handTestsOpen(tests);
  return (
    <details className="hand-tests" open={open > 0} key={open > 0 ? "open" : "done"}>
      <summary>
        <span className="title">Things to try by hand</span>
        <span className="count">{handTestsLine(tests)}</span>
      </summary>
      <ul>
        {tests.map((t) => (
          <Item key={t.id} test={t} about={stepTitle(view, t.task)} added={stepTitle(view, t.taskAdded)} projectId={projectId} goalId={goalId} onChanged={onChanged} />
        ))}
      </ul>
    </details>
  );
}

function Item({ test, about, added, projectId, goalId, onChanged }: { test: Test; about: string | undefined; added: string | undefined } & Pick<Props, "projectId" | "goalId" | "onChanged">) {
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
    <li className={`hand ${test.result.replace(/[' ]/g, "-")}`}>
      <RichText className="text" text={test.text} />
      {about && <div className="about">About the step: {about}</div>}
      {marked ? (
        <div className="result">
          <span className="badge">{HAND_WORD[test.result]}</span>
          {test.note && <span className="note">“{test.note}”</span>}
          {test.result === "doesn't work" && added && <span className="added">Added a step for your AI: {added}</span>}
          <button type="button" className="undo" disabled={busy} onClick={() => void mark("clear")}>Undo</button>
        </div>
      ) : asking ? (
        <form className="ask" onSubmit={(e) => { e.preventDefault(); void mark("doesn't work", note.trim()); }}>
          <label>
            What went wrong? <span className="quiet">(a few words; your AI reads this)</span>
            <input autoFocus value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example: it asked twice, then froze" />
          </label>
          <div className="buttons">
            <button type="submit" disabled={busy} className="bad">Doesn't work, add a step</button>
            <button type="button" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="buttons">
          <button type="button" disabled={busy} className="good" onClick={() => void mark("works")}>✓ Works</button>
          <button type="button" disabled={busy} className="bad" onClick={() => setAsking(true)}>✗ Doesn't work</button>
          <button type="button" disabled={busy} onClick={() => void mark("won't test")}>Won't test</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}
