// The plan check-up on a project's Statistics page: what the last check-up fixed and what is left to
// look at (checkup.ts). Your AI runs it by itself; "Check now" runs it from here.
import { useEffect, useState } from "react";
import { type CheckupView, getCheckup, runCheckup } from "./data.js";
import { checkupSummary, CHECKUP_KIND } from "./words.js";

export function CheckupCard({ projectId }: { projectId: string }) {
  const [last, setLast] = useState<CheckupView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    getCheckup(projectId).then((r) => live && setLast(r), () => live && setLast(null));
    return () => {
      live = false;
    };
  }, [projectId]);
  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setLast(await runCheckup(projectId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card checkup-card">
      <div className="checkup-head">
        <h2>Plan check-up</h2>
        <button className="btn ghost small" disabled={busy} onClick={() => void run()} title="Looks over this project's plan now, and repairs what is safe to repair">
          {busy ? "Checking…" : "Check now"}
        </button>
      </div>
      <p className="quiet">{checkupSummary(last ?? undefined)}</p>
      {error && <p className="error">{error}</p>}
      {last && last.findings.length > 0 && (
        <ul className="checkup-list">
          {last.findings.map((f, i) => (
            <li key={i} className={f.fixed ? "fixed" : "left"}>
              <b>{f.fixed ? "Fixed" : CHECKUP_KIND[f.kind] ?? "To look at"}</b> {f.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
