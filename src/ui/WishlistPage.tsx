import { useState } from "react";
import { addWish, changeWish, removeWish } from "./data.js";
import { useSend } from "./Talk.js";

type Wish = { id: string; text: string; granted: boolean };

/** MAX_WISH_LENGTH in wishlist.ts, which the page cannot import. */
const MAX_WISH = 300;

/**
 * What the person wants from the project as a whole, apart from goals and steps. Only they change
 * it; their AI reads it and may suggest goals from it.
 */
export function WishlistPage({ projectId, wishes, onChanged }: { projectId: string; wishes: Wish[] | undefined; onChanged: () => void }) {
  // An older Progressor still serving the dashboard sends no wishlist (the page comes from the newer files on disk).
  if (!wishes)
    return (
      <div className="page">
        <h1 className="page-title">Wishlist</h1>
        <p className="empty">
          The Progressor running this dashboard is older than this page and has no wishlist yet. Restart your AI chats, then Refresh this page.
        </p>
      </div>
    );
  const open = wishes.filter((w) => !w.granted);
  const granted = wishes.filter((w) => w.granted);
  return (
    <div className="page">
      <h1 className="page-title">Wishlist</h1>
      <p className="page-sub">
        What you want from this project as a whole, in your own words. It isn't a plan: your AI reads it and may suggest goals from it, but only you change it.
      </p>
      <section className="section">
        <h2>You wish for</h2>
        <AddWish projectId={projectId} onChanged={onChanged} />
        {open.length === 0 ? (
          <p className="empty">{granted.length > 0 ? "Every wish is ticked off. Add another above." : "No wishes yet. Write the first one above."}</p>
        ) : (
          <ul className="rules wishes">{open.map((w) => <WishRow key={w.id} projectId={projectId} wish={w} onChanged={onChanged} />)}</ul>
        )}
      </section>
      {granted.length > 0 && (
        <section className="section">
          <h2>You have these</h2>
          <ul className="rules wishes">{granted.map((w) => <WishRow key={w.id} projectId={projectId} wish={w} onChanged={onChanged} />)}</ul>
        </section>
      )}
    </div>
  );
}

function AddWish({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [text, setText] = useState("");
  const { busy, error, run } = useSend(onChanged);
  return (
    <form className="wish-add" onSubmit={(e) => {
      e.preventDefault();
      const sent = text.trim();
      // Clear only what was sent: the person may already be typing the next wish.
      if (sent) void run(() => addWish(projectId, sent)).then((ok) => ok && setText((now) => (now.trim() === sent ? "" : now)));
    }}>
      <input value={text} maxLength={MAX_WISH} onChange={(e) => setText(e.target.value)} aria-label="A new wish"
        placeholder="For example: People can use it on their phone" />
      <button type="submit" className="btn small" disabled={busy || !text.trim()}>Add wish</button>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

function WishRow({ projectId, wish: w, onChanged }: { projectId: string; wish: Wish; onChanged: () => void }) {
  const [mode, setMode] = useState<"edit" | "remove">();
  const [draft, setDraft] = useState(w.text);
  const { busy, error, run } = useSend(onChanged);
  if (mode === "edit")
    return (
      <li>
        <form className="wish-add" onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && draft.trim() !== w.text) void run(() => changeWish(projectId, w.id, { text: draft.trim() })).then((ok) => ok && setMode(undefined));
        }}>
          <input autoFocus value={draft} maxLength={MAX_WISH} onChange={(e) => setDraft(e.target.value)} aria-label="The wish"
            onKeyDown={(e) => e.key === "Escape" && setMode(undefined)} />
          <button type="submit" className="btn small" disabled={busy || !draft.trim() || draft.trim() === w.text}>Save</button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Cancel</button>
          {error && <div className="error" role="alert">{error}</div>}
        </form>
      </li>
    );
  return (
    <li className={w.granted ? "granted" : undefined}>
      <div className="rule-line">
        <label className="wish-tick" title={w.granted ? "Put it back on the wishlist" : "Tick it off: you have what you wished for"}>
          <input type="checkbox" checked={w.granted} disabled={busy}
            onChange={(e) => void run(() => changeWish(projectId, w.id, { granted: e.target.checked }))} />
          <span className="rule-text">{w.text}</span>
        </label>
        {!mode && (
          <span className="rule-actions">
            <button className="linkbtn" onClick={() => { setDraft(w.text); setMode("edit"); }}>Edit</button>
            <button className="linkbtn" onClick={() => setMode("remove")}>Remove</button>
          </span>
        )}
      </div>
      {mode === "remove" && (
        <div className="confirm" role="group" aria-label="Remove this wish?">
          <span>Remove this wish? Your AI is told you don't want it any more.</span>
          <button className="btn small" disabled={busy} onClick={() => void run(() => removeWish(projectId, w.id))}>Remove</button>
          <button className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Keep it</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}
