import { sayDuration } from "../estimate.js";
import { type RoadmapView, type StatsView, useStats } from "./data.js";
import { SIDE_TRIP_HINT, driftWords, estimateWords } from "./words.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "28 Oct" from "2026-10-28". */
const dayWords = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]}`;
};
/** How side trips ended, in a few words after their count. */
const ENDING = { "merged back": "went back to the plan as it was", returned: "added steps to the plan", recalibrated: "changed the plan", open: "still under way" } as const;
export const time = (minutes: number | undefined) => (minutes ? sayDuration(minutes) : "–");
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A project's statistics, worked out from its plan: a few headline numbers, what was finished each
 * day, how the time taken compares with the estimates, how often work drifted, the longest steps and
 * a line per goal. Read-only; it follows the plan as it changes.
 */
export function StatsPage({ projectId, roadmap, onOpenGoal }: { projectId: string; roadmap: RoadmapView; onOpenGoal: (id: string) => void }) {
  const stats = useStats(projectId, roadmap);
  return (
    <div className="page stats">
      <h1 className="page-title">Statistics</h1>
      <p className="page-sub">Worked out from this project's plan: how long steps take, how often the work stepped off the plan, and what was finished each day.</p>
      {stats === undefined ? (
        <p className="quiet">Working them out…</p>
      ) : stats === null ? (
        <p className="quiet">The statistics could not be loaded. Try Refresh.</p>
      ) : (
        <Stats stats={stats} onOpenGoal={onOpenGoal} />
      )}
    </div>
  );
}

function Stats({ stats: s, onOpenGoal }: { stats: StatsView; onOpenGoal: (id: string) => void }) {
  const fortnight = s.perDay.reduce((n, d) => n + d.count, 0);
  return (
    <>
      <div className="stat-tiles">
        <Tile value={String(s.steps.done)} label="Steps done" sub={`${s.steps.open} to go · ${s.steps.cancelled} cancelled`} />
        <Tile value={time(s.time.spent)} label="Time worked" sub="On every step, so far" />
        <Tile value={String(s.goals.finished)} label="Goals finished" sub={`${s.goals.open} open · ${s.goals.cancelled} cancelled`} />
        <Tile value={String(s.drift.sideTrips)} label={s.drift.sideTrips === 1 ? "Side trip" : "Side trips"} sub={`In ${s.drift.goalsWithSideTrips} of ${plural(s.drift.goals, "goal")}`} />
      </div>

      <section className="section">
        <h2>Finished each day</h2>
        <p className="stat-lead">{fortnight === 0 ? "Nothing finished in the last two weeks." : `${plural(fortnight, "step")} finished in the last two weeks.`}</p>
        <Bars days={s.perDay} />
      </section>

      <section className="section">
        <h2>Estimates</h2>
        <p className="stat-lead">{estimateWords(s.time.compared)}</p>
        {s.time.compared.steps > 0 && (
          <p className="quiet">Those {plural(s.time.compared.steps, "step")} were estimated at {time(s.time.compared.estimated)} and took {time(s.time.compared.spent)}.</p>
        )}
      </section>

      <section className="section">
        <h2>Side trips</h2>
        <p className="stat-lead">{driftWords(s.drift)}</p>
        {s.drift.sideTrips > 0 && (
          <ul className="stat-chips">
            {(["merged back", "returned", "recalibrated", "open"] as const).filter((k) => s.drift.endings[k] > 0).map((k) => (
              <li key={k} title={SIDE_TRIP_HINT[k]}><b>{s.drift.endings[k]}</b> {ENDING[k]}</li>
            ))}
          </ul>
        )}
        <p className="quiet">
          {plural(s.drift.stepsAdded, "step")} added after a side trip · {plural(s.drift.stepsCancelled, "step")} cancelled
        </p>
      </section>

      {s.longest.length > 0 && (
        <section className="section">
          <h2>Longest steps</h2>
          <ol className="stat-list">
            {s.longest.map((l) => (
              <li key={`${l.goal}/${l.id}`}>
                <button className="linkrow" onClick={() => onOpenGoal(l.goal)} title={`Open the goal "${l.goalTitle}"`}>
                  <span className="t">{l.title}<small>{l.goalTitle}</small></span>
                  <span className="v">{time(l.spent)}{l.estimate !== undefined && <small>estimated {time(l.estimate)}</small>}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.perGoal.length > 0 && (
        <section className="section">
          <h2>Each goal <span className="quiet">· newest first</span></h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr><th>Goal</th><th>Steps</th><th>Time</th><th>Estimated</th><th>Side trips</th></tr>
              </thead>
              <tbody>
                {[...s.perGoal].reverse().map((g) => (
                  <tr key={g.id} className={g.status === "done" ? "finished" : undefined}>
                    <td><button className="linkbtn" onClick={() => onOpenGoal(g.id)}>{g.title}</button></td>
                    <td>{g.done}/{g.total}</td>
                    <td>{time(g.spent)}</td>
                    <td>{time(g.estimate)}</td>
                    <td>{g.sideTrips || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function Tile({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="stat-tile">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      <div className="s">{sub}</div>
    </div>
  );
}

/** One bar per day, oldest first, with the count above the busiest day and today; hover any bar for its day and count. */
export function Bars({ days }: { days: StatsView["perDay"] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const busiest = days.reduce((b, d, i) => (d.count > days[b]!.count ? i : b), 0);
  const last = days.length - 1;
  return (
    <div className="bars" role="img" aria-label={days.map((d) => `${dayWords(d.day)}: ${d.count}`).join(", ")}>
      {days.map((d, i) => {
        const words = `${i === last ? "Today" : dayWords(d.day)}: ${plural(d.count, "step")} finished`;
        return (
          <div key={d.day} className={`bar-col ${i === last ? "today" : ""}`} title={words}>
            <span className="n">{d.count > 0 && (i === busiest || i === last) ? d.count : ""}</span>
            <span className="track"><span className="bar" style={{ height: `${(100 * d.count) / max}%`, animationDelay: `${i * 25}ms` }} data-empty={d.count === 0 || undefined} /></span>
            <span className="d">{i === last ? "Today" : i === 0 || i === 7 ? dayWords(d.day) : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
