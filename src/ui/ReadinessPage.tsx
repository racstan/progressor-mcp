// Ready to launch?: one page that answers "can we ship?". A verdict line, which goals count, then what is
// left grouped by who it waits on: your AI, you, other people; and serious risks nothing is reducing.
// Your AI keeps it filled (it marks the goals a launch needs); the page only reads it.
import type { ReactNode } from "react";
import type { Blocker, Readiness } from "../readiness.js";
import { type RoadmapView, useReadiness } from "./data.js";
import { Loading } from "./Loading.js";
import { scopeLine } from "../readiness.js";

const INTRO =
  "What still stands between this project and its launch or next release, by who it waits on. Your AI keeps it filled: it marks the goals a launch needs, and with none marked every open goal counts.";

function Item({ b, onOpenGoal }: { b: Blocker; onOpenGoal: (id: string) => void }) {
  const what = b.kind === "hand test" ? "Try by hand: " : b.kind === "question" ? "Question: " : "";
  return (
    <li className={`ready-item ${b.kind.replace(" ", "-")}`}>
      <button className="linkbtn" onClick={() => onOpenGoal(b.goal)} title="Open this goal">
        {b.goalTitle}
      </button>
      <span className="ready-what">
        {what}
        {b.title}
        {b.need && <span className="muted"> · they need to: {b.need}</span>}
      </span>
    </li>
  );
}

function Group({ title, hint, children, count }: { title: string; hint: string; count: number; children: ReactNode }) {
  return (
    <section className="ready-group">
      <h2>
        {title} <span className="n">{count}</span>
      </h2>
      <p className="muted small">{hint}</p>
      {children}
    </section>
  );
}

function Summary({ r, onOpenGoal, onOpenRisks }: { r: Readiness; onOpenGoal: (id: string) => void; onOpenRisks: () => void }) {
  const list = (items: Blocker[]) => <ul className="ready-list">{items.map((b) => <Item key={`${b.kind}-${b.goal}-${b.id ?? ""}`} b={b} onOpenGoal={onOpenGoal} />)}</ul>;
  const waiting = r.others.reduce((n, o) => n + o.items.length, 0);
  return (
    <>
      <p className={`ready-verdict${r.ready ? " ready" : ""}`} role="status">
        {r.verdict}
      </p>
      <p className="muted">{scopeLine(r).replace(/^Counting: /, "Counting ")}</p>
      {r.you.length > 0 && <Group title="For you" hint="Things to try, questions and steps waiting on you." count={r.you.length}>{list(r.you)}</Group>}
      {r.ai.length > 0 && <Group title="For your AI" hint="Steps still to build or finish." count={r.ai.length}>{list(r.ai)}</Group>}
      {waiting > 0 && (
        <Group title="Waiting on others" hint="Steps waiting on someone other than you." count={waiting}>
          {r.others.map((o) => (
            <div key={o.person} className="ready-person">
              <h3>{o.person}</h3>
              {list(o.items)}
            </div>
          ))}
        </Group>
      )}
      {r.risks.length > 0 && (
        <Group title="Serious risks" hint="Likely and bad, and no goal is reducing them yet." count={r.risks.length}>
          <ul className="ready-list">
            {r.risks.map((x) => (
              <li key={x.id} className="ready-item risk">
                <button className="linkbtn" onClick={onOpenRisks} title="Open the Risks page">
                  {x.title}
                </button>
              </li>
            ))}
          </ul>
        </Group>
      )}
    </>
  );
}

export function ReadinessPage({ heading, projectId, roadmap, onOpenGoal, onOpenRisks }: { heading: string; projectId: string; roadmap: RoadmapView; onOpenGoal: (id: string) => void; onOpenRisks: () => void }) {
  const r = useReadiness(projectId, roadmap);
  return (
    <div className="page readiness">
      <h1 className="page-title">{heading}</h1>
      <p className="page-sub">{INTRO}</p>
      {r === undefined ? <Loading /> : r === null ? <p className="quiet">This could not be loaded. Try Refresh.</p> : <Summary r={r} onOpenGoal={onOpenGoal} onOpenRisks={onOpenRisks} />}
    </div>
  );
}
