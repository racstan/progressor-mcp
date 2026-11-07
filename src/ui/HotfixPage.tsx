import { useState } from "react";
import { type RoadmapView, addHotfix } from "./data.js";
import { ago, exactDate } from "./words.js";
import { useSend } from "./Talk.js";

/** The longest report the server keeps (planFile.ts MAX_REPORT). */
const MAX_REPORT = 8000;

/**
 * Hotfixes: urgent bugs in the Developer's own project (one a customer of theirs reported, say), to fix
 * before anything else. Lists this project's hotfixes, open first, and adds a new one. The report is
 * kept word for word; every AI chat in the project is told, and the one that takes it finishes the step
 * it is on, then writes a test that shows the bug and fixes it.
 */
export function HotfixPage({ projectId, goals, onOpen, onAdded }: {
  projectId: string;
  goals: RoadmapView["goals"];
  onOpen: (goalId: string) => void;
  onAdded: (goalId: string) => void;
}) {
  const [report, setReport] = useState("");
  const [title, setTitle] = useState("");
  const { busy, error, run } = useSend(() => undefined);
  const long = report.trim().length > MAX_REPORT;
  const submit = () => {
    const sent = report.trim();
    if (!sent || long) return;
    void run(async () => {
      const { id } = await addHotfix(projectId, sent, title);
      setReport("");
      setTitle("");
      // Opens the new hotfix, so the person sees it at the top of their goals.
      onAdded(id);
    });
  };
  return (
    <div className="page">
      <h1 className="page-title">Hotfixes</h1>
      <p className="page-sub">
        Urgent bugs in this project, such as one your own customers or users ran into, fixed before anything else. A new one goes to the top of your goals.
        Your AI finishes the step it is on, then writes a test that shows the bug, and fixes it. Your AI can also add one by itself; adding one here is optional.
      </p>
      <HotfixList goals={goals} onOpen={onOpen} />
      <h2 className="hotfix-add-title">Add a hotfix</h2>
      <form className="section hotfix-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>What goes wrong</span>
          <textarea value={report} rows={8} onChange={(e) => setReport(e.target.value)} aria-label="The bug report"
            placeholder={"Paste the report as it was written, with how to make it happen if you know.\nFor example: Checkout fails with an error when the cart has a coupon."}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && (e.preventDefault(), submit())} />
        </label>
        <label className="field">
          <span>A short name <span className="muted">(optional; the report's first line otherwise)</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Coupon breaks checkout" />
        </label>
        <div className="wish-actions">
          {long && <span className="error">The report is {report.trim().length} characters; keep it to {MAX_REPORT}.</span>}
          <button type="submit" className="btn small" disabled={busy || !report.trim() || long}>Add hotfix</button>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
      </form>
    </div>
  );
}

/** This project's hotfixes: the ones still open, then the fixed and cancelled ones, newest first. */
function HotfixList({ goals, onOpen }: { goals: RoadmapView["goals"]; onOpen: (goalId: string) => void }) {
  const hotfixes = goals.filter((g) => g.hotfix);
  const when = (g: RoadmapView["goals"][number]) => g.updated?.at ?? g.added?.at ?? "";
  const open = hotfixes.filter((g) => g.status !== "done" && g.status !== "dropped");
  const closed = hotfixes.filter((g) => g.status === "done" || g.status === "dropped").sort((a, b) => when(b).localeCompare(when(a)));
  if (!hotfixes.length) return <p className="quiet hotfix-none">No hotfixes in this project yet.</p>;
  const row = (g: RoadmapView["goals"][number]) => (
    <li key={g.id}>
      <button className={`hotfix-row ${g.status}`} onClick={() => onOpen(g.id)}>
        <span className="hotfix-state">{g.status === "done" ? "Fixed" : g.status === "dropped" ? "Cancelled" : g.status === "active" ? "Being fixed" : g.status === "testing" ? "Waiting on your tests" : "Waiting"}</span>
        <b>{g.title}</b>
        {when(g) && <small title={exactDate(when(g))}>{ago(Date.parse(when(g)))}</small>}
      </button>
    </li>
  );
  return (
    <div className="hotfix-lists">
      {open.length > 0 && <section><h2>Open ({open.length})</h2><ul className="hotfix-list">{open.map(row)}</ul></section>}
      {closed.length > 0 && <section><h2>Fixed ({closed.length})</h2><ul className="hotfix-list">{closed.map(row)}</ul></section>}
    </div>
  );
}
