// "Working now": the AI chats working on this project right now, what each is on and since when, and
// the helpers at work against the project's helper limit (liveSessions.ts). Reads only; refreshes itself.
import { useEffect, useState } from "react";
import { getJson } from "./data.js";

interface SessionsView {
  sessions: { session: string; pid: number; since: string; seen: string; helper?: boolean; goals: { id: string; title: string; step?: { id: string; title: string } }[] }[];
  helpers: { busy: number; limit?: number };
}

/** How often the panel looks again; the heartbeats it reads are refreshed every 15 seconds. */
const EVERY_MS = 15_000;

/** "since 9:05", or "since Mon 9:05" when it started on another day. */
function sinceWords(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? `since ${time}` : `since ${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/** "1 helper" / "2 helpers", against the limit when there is one. */
export function helpersWords(h: SessionsView["helpers"]): string {
  const n = `${h.busy} ${h.busy === 1 ? "helper" : "helpers"} at work`;
  if (h.limit === undefined) return n;
  return h.busy > h.limit ? `${n}, over the limit of ${h.limit}` : `${n} of at most ${h.limit}`;
}

export function LiveSessions({ projectId, version, onOpenGoal }: { projectId: string; version: unknown; onOpenGoal: (goalId: string) => void }) {
  const [view, setView] = useState<SessionsView | null>();
  useEffect(() => {
    let alive = true;
    const look = () =>
      void getJson<SessionsView>(`/api/projects/${encodeURIComponent(projectId)}/sessions`)
        .then((v) => alive && setView(v ?? null))
        .catch(() => alive && setView(null));
    look();
    const timer = setInterval(look, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId, version]);
  // Nothing to show (the tour's sample, an older server, or no chat and no helper): the panel stays out of the way.
  if (!view || (view.sessions.length === 0 && view.helpers.busy === 0)) return null;
  const over = view.helpers.limit !== undefined && view.helpers.busy > view.helpers.limit;
  return (
    <section className={`live-sessions${over ? " over" : ""}`} aria-label="Working now">
      <h3>Working now</h3>
      <ul>
        {view.sessions.map((s) => (
          <li key={s.pid} className={s.goals.some((g) => g.step) ? "working" : ""}>
            <span className="who">{s.helper ? "Helper chat" : "AI chat"} <small className="quiet">{sinceWords(s.since)}</small></span>
            {s.goals.length === 0 ? (
              <span className="quiet">Looking around, no goal yet</span>
            ) : (
              s.goals.map((g) => (
                <button key={g.id} type="button" className="linkbtn" onClick={() => onOpenGoal(g.id)} title="Open this goal">
                  {g.title}
                  {g.step ? <small> · {g.step.title}</small> : null}
                </button>
              ))
            )}
          </li>
        ))}
      </ul>
      {(view.helpers.busy > 0 || view.helpers.limit !== undefined) && (
        <p className={`helpers${over ? " over" : ""}`} role={over ? "alert" : undefined}>{helpersWords(view.helpers)}</p>
      )}
    </section>
  );
}
