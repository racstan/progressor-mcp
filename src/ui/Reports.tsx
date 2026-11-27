// A step's reports: the write-ups a helper (or any chat) attached to it (reports.ts). Each is listed
// by title and time; clicking one opens it, rendered as markdown the way the Handoffs page shows one.
import { useEffect, useState } from "react";
import { markdownBlocks, releaseBody } from "./changelog.js";
import type { ReportItem } from "./data.js";
import { Loading } from "./Loading.js";
import { REPORTS_HEADING, REPORT_HINT, REPORT_UNREADABLE, ago, exactDate } from "./words.js";

/** A report's markdown without the lines that make up its header (title, step, written); lists show as lists. */
function ReportText({ text }: { text: string }) {
  const body = text.replace(/^#\s+.*$/m, "").replace(/^- (step|written): .*$/gm, "");
  return <div className="handoff-text report-text">{releaseBody({ title: "", version: "", blocks: markdownBlocks(body) })}</div>;
}

function Report({ report: r, read }: { report: ReportItem; read: (id: string) => Promise<string | undefined> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>();
  useEffect(() => {
    if (!open || text !== undefined) return;
    let alive = true;
    read(r.id).then((t) => alive && setText(t ?? ""), () => alive && setText(""));
    return () => {
      alive = false;
    };
  }, [open, text, r.id, read]);
  const at = Date.parse(r.written);
  return (
    <li className="report">
      <button type="button" className="report-row" aria-expanded={open} onClick={() => setOpen(!open)} title={REPORT_HINT}>
        <span className="report-title">{r.title}</span>
        {!Number.isNaN(at) && <span className="report-when" title={exactDate(r.written)}>{ago(at)}</span>}
      </button>
      {open && (text === undefined ? <Loading size="inline" label="Reading it" /> : text ? <ReportText text={text} /> : <p className="quiet">{REPORT_UNREADABLE}</p>)}
    </li>
  );
}

export function Reports({ reports, read }: { reports: ReportItem[]; read: (id: string) => Promise<string | undefined> }) {
  if (reports.length === 0) return null;
  return (
    <div className="step-reports">
      <div className="meta">{REPORTS_HEADING}</div>
      <ul>
        {reports.map((r) => <Report key={r.id} report={r} read={read} />)}
      </ul>
    </div>
  );
}
