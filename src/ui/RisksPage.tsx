// The Risks page: what could go wrong in the project, how likely and how bad, what would reduce it and
// the goals that do. Your AI keeps the list (save_risk); this page only reads it.
import { type RiskView, type RoadmapView, useRisks } from "./data.js";
import { RISK_WHY } from "./home.js";
import { Loading } from "./Loading.js";
import { RISKS_EMPTY, RISKS_INTRO, RISK_NOT_REDUCING, goalStateWords, gridCell, impactWords, likelihoodWords, riskStatusWords, scoreWords, splitRisks } from "./risks.js";

/** A 3 by 3 grid with this risk's square filled: likely to the right, severe at the top. Works in greys. */
function Grid({ risk }: { risk: RiskView }) {
  const at = gridCell(risk.likelihood, risk.impact);
  return (
    <span className="risk-grid" role="img" aria-label={scoreWords(risk.likelihood, risk.impact, risk.score)} title={scoreWords(risk.likelihood, risk.impact, risk.score)}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={Math.floor(i / 3) === at.row && i % 3 === at.col ? "on" : undefined} />)}
    </span>
  );
}

function RiskCard({ risk, onOpenGoal }: { risk: RiskView; onOpenGoal: (id: string) => void }) {
  const quiet = risk.status !== "open";
  return (
    <li className={`risk${quiet ? " quiet-risk" : ""}${risk.serious ? " serious" : ""}`}>
      <Grid risk={risk} />
      <div className="risk-body">
        <div className="risk-head">
          <span className="risk-title">{risk.title}</span>
          {quiet && <span className="risk-status">{riskStatusWords(risk.status)}</span>}
        </div>
        <p className="risk-facts">
          <span>How likely: <b>{likelihoodWords(risk.likelihood)}</b></span> · <span>How bad: <b>{impactWords(risk.impact)}</b></span>
          {risk.owner && <> · <span>Looked after by {risk.owner}</span></>}
        </p>
        {risk.serious && <p className="risk-warn">{RISK_WHY}. It is also listed in Needs you.</p>}
        {risk.mitigation && <p className="risk-reduce"><span className="label">What would reduce it:</span> {risk.mitigation}</p>}
        {risk.goals.length > 0 ? (
          <p className="risk-goals">
            <span className="label">Goals that reduce it:</span>{" "}
            {risk.goals.map((g) =>
              g.title ? (
                <button key={g.id} className="linkbtn risk-goal" onClick={() => onOpenGoal(g.id)} title={`Open this goal. ${goalStateWords(g.status)}.`}>
                  {g.title} <small>({goalStateWords(g.status)})</small>
                </button>
              ) : (
                <span key={g.id} className="risk-goal gone">{g.id} <small>({goalStateWords(undefined)})</small></span>
              ),
            )}
          </p>
        ) : (
          !quiet && !risk.serious && <p className="risk-goals muted">{RISK_NOT_REDUCING}</p>
        )}
      </div>
    </li>
  );
}

export function RisksPage({ heading, projectId, roadmap, onOpenGoal }: { heading: string; projectId: string; roadmap: RoadmapView; onOpenGoal: (id: string) => void }) {
  const risks = useRisks(projectId, roadmap);
  const { open, quiet } = splitRisks(risks ?? []);
  return (
    <div className="page risks">
      <h1 className="page-title">{heading}</h1>
      <p className="page-sub">{RISKS_INTRO}</p>
      {risks === undefined ? (
        <Loading />
      ) : risks === null ? (
        <p className="quiet">The risks could not be loaded. Try Refresh.</p>
      ) : risks.length === 0 ? (
        <p className="empty">{RISKS_EMPTY}</p>
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="risk-list">{open.map((r) => <RiskCard key={r.id} risk={r} onOpenGoal={onOpenGoal} />)}</ul>
          ) : (
            <p className="quiet">Nothing open right now.</p>
          )}
          {quiet.length > 0 && (
            <details className="risk-folded">
              <summary>Reduced and closed ({quiet.length})</summary>
              <ul className="risk-list">{quiet.map((r) => <RiskCard key={r.id} risk={r} onOpenGoal={onOpenGoal} />)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
