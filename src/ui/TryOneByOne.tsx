import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type GoalView, type HandMark, loadGoalView, markHandTest } from "./data.js";
import { Dates } from "./Dates.js";
import { Icon } from "./Icon.js";
import { type PictureItem, Pictures } from "./Pictures.js";
import { RichText } from "./RichText.js";
import { type WalkItem, type WalkState, mark, orderItems, progress, queue, skip } from "./walkthrough.js";

type Test = GoalView["handTests"][number];

/** A goal to look through for things to try. */
export interface WalkGoal {
  projectId: string;
  projectName: string;
  goalId: string;
  goalTitle: string;
}

interface Loaded {
  item: WalkItem;
  test: Test;
  about: string | undefined;
  pictures: PictureItem[];
}

/** The key of one thing to try across every project and goal. */
const keyOf = (g: WalkGoal, testId: string) => `${g.projectId}/${g.goalId}/${testId}`;

async function load(goals: readonly WalkGoal[]): Promise<Loaded[]> {
  const views = await Promise.all(goals.map((g) => loadGoalView(g.projectId, g.goalId).catch(() => undefined)));
  const all: Loaded[] = [];
  goals.forEach((g, i) => {
    const view = views[i];
    if (!view) return;
    for (const test of view.handTests) {
      if (test.result !== "pending" || !test.id) continue;
      const task = test.task ? view.graph.nodes.find((n) => n.kind === "task" && n.id === test.task) : undefined;
      all.push({
        item: { key: keyOf(g, test.id), projectId: g.projectId, goalId: g.goalId, goalTitle: g.goalTitle, projectName: g.projectName, testId: test.id, ...(test.added?.at ? { added: test.added.at } : {}) },
        test,
        about: task?.title,
        pictures: view.pictures.filter((p) => p.handTest === test.id),
      });
    }
  });
  const order = orderItems(all.map((l) => l.item));
  return order.map((item) => all.find((l) => l.item.key === item.key)!);
}

/**
 * "Try them one by one": one untried thing to try at a time, oldest first across the given goals.
 * Marking uses the same call as the goal's own list, so a failure still adds a step. Esc closes it.
 * Everything here is optional: the things stay on their goals whether or not this is used.
 */
export function Walkthrough({ goals, showProject, onClose, onChanged }: { goals: readonly WalkGoal[]; showProject: boolean; onClose: () => void; onChanged: () => void }) {
  const [loaded, setLoaded] = useState<Loaded[]>();
  const [state, setState] = useState<WalkState>({ handled: [], skipped: [] });
  const [tally, setTally] = useState({ works: 0, broken: 0, wont: 0 });
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const card = useRef<HTMLDivElement>(null);
  // Only what was untried when the walkthrough opened: new ones the AI adds meanwhile wait for the next time.
  useEffect(() => {
    let alive = true;
    void load(goals).then((l) => alive && setLoaded(l));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => (loaded ?? []).map((l) => l.item), [loaded]);
  const line = queue(items, state);
  const current = line[0];
  const shown = current ? loaded?.find((l) => l.item.key === current.key) : undefined;
  const where = progress(items.length, state);

  // Esc closes (or, while a note is being written, goes back to the buttons).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (asking) setAsking(false);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [asking, onClose]);

  // Each new thing, and the end, takes the keyboard focus so Tab starts at its buttons.
  useEffect(() => {
    card.current?.focus();
  }, [current?.key, loaded === undefined]);

  const answer = async (m: HandMark, text?: string) => {
    if (!current) return;
    setBusy(true);
    setError(undefined);
    try {
      await markHandTest(current.projectId, current.goalId, current.testId, m, text);
      setState((s) => mark(s, current.key));
      setTally((t) => (m === "works" ? { ...t, works: t.works + 1 } : m === "doesn't work" ? { ...t, broken: t.broken + 1 } : { ...t, wont: t.wont + 1 }));
      setAsking(false);
      setNote("");
      onChanged();
    } catch (e) {
      setError(`That did not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const title = "Try them one by one";
  // Over the whole page, whichever panel the button sits in.
  return createPortal(
    <div className="walk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="walk-card" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={card}>
        <div className="walk-head">
          <h2>{title}</h2>
          {loaded && items.length > 0 && !where.done && (
            <span className="walk-progress" aria-live="polite">
              {where.position} of {where.total}
              <span className="walk-bar" aria-hidden="true"><i style={{ width: `${(100 * state.handled.length) / where.total}%` }} /></span>
            </span>
          )}
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Close (Esc)"><Icon name="close" size={14} /> Close</button>
        </div>

        {!loaded ? (
          <p className="quiet">Looking for things to try…</p>
        ) : items.length === 0 ? (
          <div className="walk-done">
            <p><b>Nothing left to try.</b></p>
            <p className="quiet">Your AI has not asked you to try anything by hand right now.</p>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </div>
        ) : !current || !shown ? (
          <div className="walk-done">
            <p><b>All done.</b> You went through {items.length} {items.length === 1 ? "thing" : "things"} to try.</p>
            <p className="quiet">
              {[tally.works > 0 && `${tally.works} work`, tally.broken > 0 && `${tally.broken} did not work, so your AI has ${tally.broken === 1 ? "a step" : "steps"} to fix`, tally.wont > 0 && `${tally.wont} you won't test`]
                .filter(Boolean).join(" · ")}
            </p>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="walk-item" key={current.key}>
            <div className="walk-where">
              {showProject && <span>{current.projectName} › </span>}
              <span>{current.goalTitle}</span>
            </div>
            {shown.about && <div className="about">About the step: {shown.about}</div>}
            <RichText className="text walk-text" text={shown.test.text} />
            <Pictures pictures={shown.pictures} />
            <Dates item={shown.test} className="origin" />
            {asking ? (
              <form className="ask" onSubmit={(e) => { e.preventDefault(); void answer("doesn't work", note.trim()); }}>
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
              <div className="buttons walk-buttons">
                <button type="button" disabled={busy} className="btn ghost" onClick={() => void answer("works")}><Icon name="check" /> Works</button>
                <button type="button" disabled={busy} className="btn ghost" onClick={() => setAsking(true)}><Icon name="close" /> Doesn't work</button>
                <button type="button" disabled={busy} className="btn ghost" onClick={() => void answer("won't test")}>Won't test</button>
                <button type="button" disabled={busy || line.length < 2} className="linkbtn" title="Comes back at the end" onClick={() => setState((s) => skip(s, current.key))}>Skip for now</button>
              </div>
            )}
            {error && <div className="error" role="alert">{error}</div>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The button that opens the walkthrough, where something is untried; nothing otherwise. */
export function TryOneByOne({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button type="button" className="btn small try-one" title="Shows one untried thing at a time, oldest first, so you can mark each quickly" onClick={onClick}>
      <Icon name="play" size={14} /> Try them one by one
    </button>
  );
}
