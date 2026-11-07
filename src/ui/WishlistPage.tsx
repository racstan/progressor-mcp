import { useRef, useState } from "react";
import { addWish, attachFile, attachmentUrl, changeWish, removeAttachment, removeWish } from "./data.js";
import { useSend } from "./Talk.js";

type Attachment = { file: string; name: string; size: number };
type Wish = { id: string; text: string; granted: boolean; attachments?: Attachment[] };

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

const sizeText = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * What the person wants from the project as a whole, apart from goals and steps. Only they change
 * it; their AI reads it and may suggest goals from it.
 */
export function WishlistPage({ projectId, wishes, onChanged, heading }: { projectId: string; heading: string; wishes: Wish[] | undefined; onChanged: () => void }) {
  // An older Progressor still serving the dashboard sends no wishlist (the page comes from the newer files on disk).
  if (!wishes)
    return (
      <div className="page">
        <h1 className="page-title">{heading}</h1>
        <p className="empty">
          The Progressor running this dashboard is older than this page and has no wishlist yet. Restart your AI chats, then Refresh this page.
        </p>
      </div>
    );
  const open = wishes.filter((w) => !w.granted);
  const granted = wishes.filter((w) => w.granted);
  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
      <p className="page-sub">
        What you want from this project as a whole, in your own words, as long as you like. It isn't a plan: your AI reads it and may suggest goals from it, but only you change it.
        Attach images, PDFs or any file: they stay on this computer, and your AI is only told where each one is, so it opens one only when it needs to.
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

/** Picks files with the system's file chooser; the button label says what it does. */
function FilePicker({ label, disabled, onPick }: { label: string; disabled?: boolean; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" multiple hidden onChange={(e) => {
        onPick([...(e.target.files ?? [])]);
        e.target.value = ""; // so the same file can be picked again
      }} />
      <button type="button" className="btn ghost small" disabled={disabled} onClick={() => input.current?.click()}>{label}</button>
    </>
  );
}

function AddWish({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { busy, error, run } = useSend(onChanged);
  const submit = () => {
    const sent = text.trim();
    const sentFiles = files;
    if (!sent) return;
    void run(async () => {
      const { id } = await addWish(projectId, sent);
      // The wish is saved: clear only what was sent (the person may already be typing the next one), then attach.
      setText((now) => (now.trim() === sent ? "" : now));
      setFiles((now) => (now === sentFiles ? [] : now));
      for (const f of sentFiles) await attachFile(projectId, id, f).catch((e: Error) => {
        throw new Error(`The wish was added, but this file was not attached: ${e.message}`);
      });
    });
  };
  return (
    <form className="wish-add wish-new" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea value={text} rows={2} onChange={(e) => setText(e.target.value)} aria-label="A new wish"
        placeholder="For example: People can use it on their phone"
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && (e.preventDefault(), submit())} />
      <div className="wish-actions">
        <FilePicker label="Attach files" disabled={busy} onPick={(picked) => setFiles((now) => [...now, ...picked])} />
        <button type="submit" className="btn small" disabled={busy || !text.trim()}>Add wish</button>
      </div>
      {files.length > 0 && (
        <ul className="wish-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span className="file-name">{f.name}</span> <span className="muted">{sizeText(f.size)}</span>
              <button type="button" className="linkbtn" disabled={busy} onClick={() => setFiles((now) => now.filter((_, j) => j !== i))}>Leave out</button>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

function Files({ projectId, wish: w, busy, run }: { projectId: string; wish: Wish; busy: boolean; run: (change: () => Promise<void>) => Promise<boolean> }) {
  if (!w.attachments?.length) return null;
  return (
    <ul className="wish-files">
      {w.attachments.map((a) => {
        const url = attachmentUrl(projectId, w.id, a.file);
        return (
          <li key={a.file}>
            <a href={url} target="_blank" rel="noreferrer" className="file-link" title={a.name}>
              {IMAGE.test(a.file) && <img src={url} alt={a.name} loading="lazy" />}
              <span className="file-name">{a.name}</span>
            </a>
            <span className="muted">{sizeText(a.size)}</span>
            <button type="button" className="linkbtn" disabled={busy} onClick={() => void run(() => removeAttachment(projectId, w.id, a.file))}>Remove</button>
          </li>
        );
      })}
    </ul>
  );
}

function WishRow({ projectId, wish: w, onChanged }: { projectId: string; wish: Wish; onChanged: () => void }) {
  const [mode, setMode] = useState<"edit" | "remove">();
  const [draft, setDraft] = useState(w.text);
  const { busy, error, run } = useSend(onChanged);
  if (mode === "edit")
    return (
      <li>
        <form className="wish-add wish-new" onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && draft.trim() !== w.text) void run(() => changeWish(projectId, w.id, { text: draft.trim() })).then((ok) => ok && setMode(undefined));
        }}>
          <textarea autoFocus value={draft} rows={3} onChange={(e) => setDraft(e.target.value)} aria-label="The wish"
            onKeyDown={(e) => e.key === "Escape" && setMode(undefined)} />
          <div className="wish-actions">
            <button type="submit" className="btn small" disabled={busy || !draft.trim() || draft.trim() === w.text}>Save</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Cancel</button>
          </div>
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
            <FilePicker label="Attach" disabled={busy} onPick={(picked) => void run(async () => {
              for (const f of picked) await attachFile(projectId, w.id, f);
            })} />
            <button className="linkbtn" onClick={() => { setDraft(w.text); setMode("edit"); }}>Edit</button>
            <button className="linkbtn" onClick={() => setMode("remove")}>Remove</button>
          </span>
        )}
      </div>
      <Files projectId={projectId} wish={w} busy={busy} run={run} />
      {mode === "remove" && (
        <div className="confirm" role="group" aria-label="Remove this wish?">
          <span>Remove this wish{w.attachments?.length ? " and its files" : ""}? Your AI is told you don't want it any more.</span>
          <button className="btn small" disabled={busy} onClick={() => void run(() => removeWish(projectId, w.id))}>Remove</button>
          <button className="btn ghost small" disabled={busy} onClick={() => setMode(undefined)}>Keep it</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}
