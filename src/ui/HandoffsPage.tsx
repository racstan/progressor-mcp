// The Handoffs page: the write-ups your AI saved for whoever picks the work up next (handoff.ts),
// newest first, one open at a time, and asking for a new one by dates or by the last few commits.
// Your AI writes them by itself (after each release, or when asked); asking here is optional.
import { useEffect, useState } from "react";
import { parseChangelog, releaseBody } from "./changelog.js";
import { type HandoffSummary, type RoadmapView, askForHandoff, getHandoff, useHandoffs } from "./data.js";
import { Icon } from "./Icon.js";
import { HANDOFFS_ASKED, HANDOFFS_EMPTY, HANDOFFS_INTRO, ago, exactDate } from "./words.js";


const DAY = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "2020-01-01 to 2026-11-07" as "1 Jan 2020 – 7 Nov 2026"; anything else (commit ranges) as written. */
export function prettyRange(range: string): string {
  return range.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => {
    const t = new Date(`${d}T12:00:00`);
    return Number.isNaN(t.getTime()) ? d : DAY.format(t);
  }).replace(/ to /, " – ");
}

/** A handoff's markdown as the page shows it: the header lines are shown as chips above it instead. */
function HandoffText({ text }: { text: string }) {
  const body = text.replace(/^#\s+.*$/m, "").replace(/^- (range|commits|written): .*$/gm, "");
  const doc = parseChangelog(body);
  return (
    <div className="handoff-text">
      {doc.intro.map((p, i) => <p key={i}>{p}</p>)}
      {doc.releases.map((r, i) => (
        <section key={i}>
          <h3>{r.title}</h3>
          {releaseBody(r)}
        </section>
      ))}
    </div>
  );
}

function Ask({ projectId, toast, onClose }: { projectId: string; toast: (text: string) => void; onClose?: () => void }) {
  const [how, setHow] = useState<"dates" | "commits">("dates");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [last, setLast] = useState(10);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    try {
      await askForHandoff(projectId, how === "commits" ? { last } : { ...(since ? { since } : {}), ...(until ? { until } : {}) });
      toast(HANDOFFS_ASKED);
      onClose?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="handoff-ask" aria-label="Ask for a handoff">
      <div className="handoff-ask-head">
        <h2>Ask for a handoff</h2>
        {onClose && <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button>}
      </div>
      <div className="handoff-how" role="radiogroup" aria-label="What it covers">
        <button role="radio" aria-checked={how === "dates"} onClick={() => setHow("dates")}>Between dates</button>
        <button role="radio" aria-checked={how === "commits"} onClick={() => setHow("commits")}>The last commits</button>
      </div>
      {how === "dates" ? (
        <div className="handoff-fields">
          <label className="field"><span>From</span><input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></label>
          <label className="field"><span>To</span><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <small className="handoff-hint">Leave From empty to start at the last handoff, and To empty for up to now.</small>
        </div>
      ) : (
        <div className="handoff-fields">
          <label className="field"><span>How many commits</span>
            <input type="number" min={1} max={500} value={last} onChange={(e) => setLast(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
          </label>
        </div>
      )}
      <div className="handoff-ask-actions">
        <button className="btn" disabled={busy} onClick={() => void ask()}>{busy ? "Asking…" : "Ask your AI"}</button>
        <small>Your AI writes it at its next step; it shows up here by itself.</small>
      </div>
    </section>
  );
}

export function HandoffsPage({ projectId, roadmap, toast }: { projectId: string; roadmap: RoadmapView; toast: (text: string) => void }) {
  const list = useHandoffs(projectId, roadmap);
  const [open, setOpen] = useState<string>();
  const [text, setText] = useState<string>();
  const [asking, setAsking] = useState(false);
  const shown: HandoffSummary | undefined = list?.find((h) => h.file === open) ?? list?.[0];
  useEffect(() => {
    if (!shown) return setText(undefined);
    let alive = true;
    setText(undefined);
    getHandoff(projectId, shown.file).then((t) => alive && setText(t ?? ""), () => alive && setText(""));
    return () => {
      alive = false;
    };
  }, [projectId, shown?.file, shown?.written]);
  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied. Paste it into any AI chat or message.");
    } catch {
      toast("Could not copy here; select the text instead.");
    }
  };
  const empty = list !== undefined && !list?.length;
  return (
    <div className="page wide handoffs-page">
      <div className="handoffs-head">
        <div>
          <h1 className="page-title">Handoffs</h1>
          <p className="page-sub">{HANDOFFS_INTRO}</p>
        </div>
        {!empty && !asking && (
          <button className="btn ghost" onClick={() => setAsking(true)}><Icon name="plus" size={16} /> Ask for a handoff</button>
        )}
      </div>
      {(asking || empty) && <Ask projectId={projectId} toast={toast} onClose={empty ? undefined : () => setAsking(false)} />}
      {list === undefined ? (
        <p className="quiet handoffs-loading">Loading…</p>
      ) : empty ? (
        <p className="handoffs-empty">{HANDOFFS_EMPTY}</p>
      ) : (
        <div className="handoffs-layout">
          <nav className="handoff-list" aria-label="Saved handoffs">
            <h2>Saved <span>{list!.length}</span></h2>
            {list!.map((h) => (
              <button key={h.file} className="handoff-row" aria-current={h.file === shown?.file} onClick={() => setOpen(h.file)}>
                <b>{h.title}</b>
                {h.range && <small>{prettyRange(h.range)}</small>}
                <small title={h.written ? exactDate(h.written) : undefined}>{h.written ? `Written ${ago(Date.parse(h.written))}` : h.file}</small>
              </button>
            ))}
          </nav>
          {shown && (
            <article className="handoff-view">
              <header className="handoff-view-head">
                <h2>{shown.title}</h2>
                <button className="btn ghost small" disabled={!text} onClick={() => void copy()}>Copy</button>
              </header>
              <ul className="handoff-chips" aria-label="About this handoff">
                {shown.range && <li><span>Covers</span> {prettyRange(shown.range)}</li>}
                {shown.commits !== undefined && shown.commits > 0 && <li><span>Commits</span> {shown.commits}</li>}
                {shown.written && <li title={exactDate(shown.written)}><span>Written by your AI</span> {exactDate(shown.written)}</li>}
              </ul>
              {text === undefined ? <p className="quiet">Loading…</p> : text ? <HandoffText text={text} /> : <p className="quiet">This handoff could not be read.</p>}
            </article>
          )}
        </div>
      )}
    </div>
  );
}
