// Goals that come back (routines.ts), on the Project notes page. Your AI makes and runs them by
// itself; the person may pause one, let it carry on, or stop it for good.
import { useState } from "react";
import { type RoutineView, changeRoutine, useRoutines } from "./data.js";
import { useSend } from "./Talk.js";
import { ROUTINES_EMPTY, ROUTINES_LEAD, ROUTINES_TITLE, routineWhen } from "./words.js";

export function RoutinesCard({ projectId, version }: { projectId: string; version: unknown }) {
  const [routines, reload] = useRoutines(projectId, version);
  if (routines === undefined) return null;
  return (
    <section className="section routines">
      <h2>{ROUTINES_TITLE}</h2>
      <p className="quiet">{routines.length === 0 ? ROUTINES_EMPTY : ROUTINES_LEAD}</p>
      {routines.length > 0 && (
        <ul className="routine-list">
          {routines.map((r) => (
            <RoutineRow key={r.id} projectId={projectId} routine={r} onChanged={reload} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoutineRow({ projectId, routine: r, onChanged }: { projectId: string; routine: RoutineView; onChanged: () => void }) {
  const [stopping, setStopping] = useState(false);
  const { busy, error, run } = useSend(onChanged);
  const act = (action: "pause" | "resume" | "stop") => void run(() => changeRoutine(projectId, r.id, action));
  return (
    <li className={r.paused ? "paused" : undefined}>
      <div className="routine-head">
        <b>{r.title}</b>
        <span className="routine-pace">{r.words}</span>
        <span className="sp" />
        {stopping ? (
          <>
            <span className="quiet">Stop it for good?</span>
            <button className="btn small" disabled={busy} onClick={() => act("stop")}>Stop it</button>
            <button className="btn ghost small" disabled={busy} onClick={() => setStopping(false)}>Keep it</button>
          </>
        ) : (
          <>
            <button className="btn ghost small" disabled={busy} onClick={() => act(r.paused ? "resume" : "pause")}
              title={r.paused ? "Your AI's routine adds goals again when they are due" : "No new goals from it until you let it carry on"}>
              {r.paused ? "Let it carry on" : "Pause"}
            </button>
            <button className="btn ghost small" disabled={busy} onClick={() => setStopping(true)} title="Takes it off the plan; the goals it made stay">
              Stop
            </button>
          </>
        )}
      </div>
      <p className="quiet routine-when">
        {routineWhen(r)}
        {r.steps.length > 0 && ` · ${r.steps.length} ${r.steps.length === 1 ? "step" : "steps"} each time`}
        {r.lastGoal && (
          <>
            {" · "}
            <a href={`#/goal/${encodeURIComponent(r.lastGoal)}`}>Latest goal</a>
          </>
        )}
      </p>
      {error && <p className="error">{error}</p>}
    </li>
  );
}
