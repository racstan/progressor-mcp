// The Handoffs page: the write-ups your AI saved for whoever picks the work up next (handoff.ts),
// newest first, one open at a time, and asking for a new one by dates or by the last few commits.
// Your AI writes them by itself (after each release, or when asked); asking here is optional.
import { useEffect, useState } from "react";
import { parseChangelog, releaseBody } from "./changelog.js";
import { type HandoffSummary, type RoadmapView, askForHandoff, getHandoff, useHandoffs } from "./data.js";
import { HANDOFFS_ASKED, HANDOFFS_EMPTY, HANDOFFS_INTRO, ago, exactDate, handoffMeta } from "./words.js";

/** The address of the Handoffs page, after the project. */
export const HANDOFFS_HASH = "#/handoffs";

/** A handoff's markdown as the page shows it: the header lines become the meta line above it. */
function HandoffText({ text }: { text: string }) {
  const body = text.replace(/^- (range|commits|written): .*$/gm, "");
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

function Ask({ projectId, toast }: { projectId: string; toast: (text: string) => void }) {
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
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card handoff-ask">
      <h2>Ask for a handoff</h2>
      <div className="handoff-how" role="radiogroup">
        <label><input type="radio" checked={how === "dates"} onChange={() => setHow("dates")} /> Between dates</label>
        <label><input type="radio" checked={how === "commits"} onChange={() => setHow("commits")} /> The last commits</label>
      </div>
      {how === "dates" ? (
        <div className="handoff-fields">
          <label>From <input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></label>
          <label>To <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <small className="quiet">Leave From empty to start at the last handoff, and To empty for now.</small>
        </div>
      ) : (
        <div className="handoff-fields">
          <label>The last <input type="number" min={1} max={500} value={last} onChange={(e) => setLast(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} /> commits</label>
        </div>
      )}
      <button className="btn" disabled={busy} onClick={() => void ask()}>{busy ? "Asking…" : "Ask your AI"}</button>
    </section>
  );
}

export function HandoffsPage({ projectId, roadmap, toast }: { projectId: string; roadmap: RoadmapView; toast: (text: string) => void }) {
  const list = useHandoffs(projectId, roadmap);
  const [open, setOpen] = useState<string>();
  const [text, setText] = useState<string>();
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
  return (
    <div className="page handoffs-page">
      <h1 className="page-title">Handoffs</h1>
      <p className="page-sub">{HANDOFFS_INTRO}</p>
      <div className="handoffs-layout">
        <nav className="handoff-list" aria-label="Saved handoffs">
          {list === undefined ? (
            <p className="quiet">Loading…</p>
          ) : !list?.length ? (
            <p className="quiet">{HANDOFFS_EMPTY}</p>
          ) : (
            list.map((h) => (
              <button key={h.file} className="handoff-row" aria-current={h.file === shown?.file} onClick={() => setOpen(h.file)}>
                <b>{h.title}</b>
                <small title={h.written ? exactDate(h.written) : undefined}>{h.written ? ago(Date.parse(h.written)) : h.file}</small>
              </button>
            ))
          )}
        </nav>
        <div className="handoff-view">
          {shown && (
            <article className="card">
              <p className="quiet handoff-meta">{handoffMeta(shown)}</p>
              {text === undefined ? <p className="quiet">Loading…</p> : <HandoffText text={text} />}
            </article>
          )}
          <Ask projectId={projectId} toast={toast} />
        </div>
      </div>
    </div>
  );
}
