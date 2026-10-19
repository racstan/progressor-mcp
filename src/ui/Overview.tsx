import type { OverviewView, SearchView, WorkspaceEntry } from "./data.js";
import { readJson } from "./data.js";
import { type Seen, doneMark } from "./goalList.js";
import { sortProjects } from "./projectList.js";

type ProjectOverview = OverviewView[number];

/** Finished Goals this browser has not looked at yet, by the same rule as the sidebar's green dots. */
function unseen(p: ProjectOverview, finishedWaits: boolean): number {
  const seen = readJson<Seen>(`progressor.seen.${p.id}`);
  if (!finishedWaits || !seen) return 0; // a project never opened here counts its finished Goals as seen
  return p.goals.filter((g) => g.status === "done" && seen[g.id] !== doneMark(g)).length;
}

/** Every project at a glance: what is being worked on and how far along it is. */
export function Overview({ overview, workspaces, only, query, hits, finishedWaits, onOpen, onShowAll }: {
  overview: OverviewView | undefined;
  workspaces: WorkspaceEntry[];
  /** The Workspace the page was opened on, if any. */
  only: string | undefined;
  /** The search typed in the top bar, and its results; the cards narrow to the projects with a result. */
  query: string;
  hits: SearchView | undefined;
  finishedWaits: boolean;
  onOpen: (projectId: string, goalId?: string) => void;
  onShowAll: () => void;
}) {
  if (!overview) return <div className="placeholder">Loading…</div>;
  const inWorkspace = only ? overview.filter((p) => p.workspace === only) : overview;
  const found = query.trim() && hits ? new Set(hits.map((h) => h.project.id)) : undefined;
  const shown = sortProjects(found ? inWorkspace.filter((p) => found.has(p.id)) : inWorkspace);
  const workspace = only ? workspaces.find((w) => w.id === only) : undefined;
  return (
    <div className="overview">
      <div className="overview-head">
        <h2>{workspace ? workspace.name : "All projects"}</h2>
        {workspace && <span className="path">{workspace.root}</span>}
        {only && overview.length > shown.length && (
          <button className="btn ghost" onClick={onShowAll}>Show all {overview.length} projects</button>
        )}
      </div>
      {shown.length === 0 && inWorkspace.length > 0 && <p className="empty">No project matches “{query.trim()}”.</p>}
      {inWorkspace.length === 0 && (
        <p className="empty">
          No projects here yet. A folder shows up once an Agent using Progressor adds a Goal in it, which creates its <code>.progressor/</code> folder.
        </p>
      )}
      {shown.length > 0 && (
          <div className="project-cards">
            {shown.map((p) => {
              const working = p.goals.filter((x) => x.status === "active" || x.status === "paused");
              const planned = p.goals.filter((x) => x.status === "planned").length;
              const done = p.goals.filter((x) => x.status === "done").length;
              const fresh = unseen(p, finishedWaits);
              return (
                <div key={p.id} className="project-card">
                  <button className="head" onClick={() => onOpen(p.id)} title={p.root}>
                    <span className="t">{p.name}</span>
                    {fresh > 0 && (
                      <span className="fresh-note">
                        <span className="fresh-dot" aria-hidden="true" /> {fresh} finished
                      </span>
                    )}
                    <span className="path">{p.root}</span>
                  </button>
                  {working.map((x) => {
                    const pct = x.total ? Math.round((100 * x.done) / x.total) : 0;
                    return (
                      <button key={x.id} className={`goal ${x.status}`} onClick={() => onOpen(p.id, x.id)}>
                        <div className="t">{x.title}</div>
                        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                        <div className="s">
                          <span>{x.status === "active" ? "Active" : "Paused"}</span>
                          <span>{x.total ? `${x.done}/${x.total} · ${pct}%` : "no Tasks"}</span>
                        </div>
                      </button>
                    );
                  })}
                  <div className="counts">
                    {working.length === 0 && <span>Nothing in progress</span>}
                    {planned > 0 && <span>{planned} planned</span>}
                    {done > 0 && <span>{done} done</span>}
                    {p.goals.length === 0 && <span>No Goals yet</span>}
                  </div>
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
}
