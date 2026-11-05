import { useState } from "react";
import { addHotfix } from "./data.js";
import { useSend } from "./Talk.js";

/** The longest report the server keeps (planFile.ts MAX_REPORT). */
const MAX_REPORT = 8000;

/**
 * Reporting a bug to fix before anything else: a hotfix. The report is kept word for word; every AI
 * chat in the project is told, and the one that takes it finishes the step it is on, then writes a
 * test that shows the bug and fixes it.
 */
export function HotfixPage({ projectId, onAdded }: { projectId: string; onAdded: (goalId: string) => void }) {
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
      <h1 className="page-title">Report a bug</h1>
      <p className="page-sub">
        For a bug that should be fixed before anything else, such as one a customer reported. It goes to the top of your goals as a hotfix. Your AI finishes
        the step it is on, then writes a test that shows the bug, and fixes it.
      </p>
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
