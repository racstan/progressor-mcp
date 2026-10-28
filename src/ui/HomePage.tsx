import type { OverviewView, SearchView, WorkspaceEntry } from "./data.js";
import { type PutOff, homeSections, needsWhy, progressWords } from "./home.js";
import { Ring } from "./Icon.js";
import { sortProjects } from "./projectList.js";

/**
 * The page the dashboard opens on: what needs the person across every project, what is being worked
 * on, and the projects themselves. "Not now" puts off things to try on one goal, in this browser only.
 */
export function Home({ overview, workspaces, only, query, hits, putOff, onPutOff, onOpen, onShowAll }: {
  overview: OverviewView | undefined;
  workspaces: WorkspaceEntry[];
  /** The Workspace the page was opened on, if any. */
  only: string | undefined;
  /** The search typed in the top bar, and its results; the projects narrow to the ones with a result. */
  query: string;
  hits: SearchView | undefined;
  putOff: PutOff;
  onPutOff: (key: string, untried: number) => void;
  onOpen: (projectId: string, goalId?: string) => void;
  onShowAll: () => void;
}) {
  if (!overview) return <div className="placeholder">Loading…</div>;
  const inWorkspace = only ? overview.filter((p) => p.workspace === only) : overview;
  const s = homeSections(sortProjects(inWorkspace), putOff);
  const found = query.trim() && hits ? new Set(hits.map((h) => h.project.id)) : undefined;
  const projects = found ? s.projects.filter((p) => found.has(p.id)) : s.projects;
  const workspace = only ? workspaces.find((w) => w.id === only) : undefined;
  return (
    <div className="page wide">
      <h1 className="page-title">{workspace ? workspace.name : "Home"}</h1>
      <p className="page-sub">{s.summary}</p>
      {only && overview.length > inWorkspace.length && (
        <button className="linkbtn" onClick={onShowAll}>Show all {overview.length} projects</button>
      )}

      {s.needsYou.length > 0 && (
        <section className="section needs">
          <h2>Needs you</h2>
          <ul className="list">
            {s.needsYou.map(({ project, goal, why, canPutOff }) => (
              <li key={`${project.id}/${goal.id}`} className={canPutOff ? "with-action" : undefined}>
                <button className="list-row" onClick={() => onOpen(project.id, goal.id)}>
                  <Ring done={goal.done} total={goal.total} />
                  <span className="t">{goal.title}</span>
                  <span className="end">{project.name}</span>
                  <span className="sub you">{why}</span>
                </button>
                {canPutOff && (
                  <button className="linkbtn put-off" title="Takes this goal out of Needs you until your AI adds something new to try. The plan is unchanged; only this browser remembers."
                    onClick={() => onPutOff(`${project.id}/${goal.id}`, goal.untriedTests ?? 0)}>
                    Not now
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.inProgress.length > 0 && (
        <section className="section">
          <h2>In progress</h2>
          <ul className="list">
            {s.inProgress.map(({ project, goal }) => (
              <li key={`${project.id}/${goal.id}`}>
                <button className="list-row working" onClick={() => onOpen(project.id, goal.id)}>
                  <Ring done={goal.done} total={goal.total} />
                  <span className="t">{goal.title}</span>
                  <span className="end">{project.name}</span>
                  <span className="sub">{progressWords(goal)}{putOffNote(goal, putOff[`${project.id}/${goal.id}`])}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Projects</h2>
        {inWorkspace.length === 0 ? (
          <p className="quiet">Nothing here yet. Tell your AI what you want to build: a project shows up here as soon as it plans the first goal.</p>
        ) : projects.length === 0 ? (
          <p className="quiet">No project matches “{query.trim()}”.</p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              const you = s.needsYou.filter((x) => x.project.id === p.id).length;
              return (
                <button key={p.id} className="project-card" onClick={() => onOpen(p.id)} title={p.root}>
                  <span className="t">{p.name}</span>
                  <span className="path">{p.root}</span>
                  <span className="c">
                    {p.goals.length === 0 ? "No goals yet" : [`${p.open} open`, p.finished > 0 && `${p.finished} finished`].filter(Boolean).join(" · ")}
                  </span>
                  {you > 0 && <span className="you">{you === 1 ? "1 goal needs you" : `${you} goals need you`}</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** " · 2 things to try, put off", so a put-off goal still says so quietly. */
function putOffNote(goal: Parameters<typeof needsWhy>[0], putOff: number | undefined): string {
  if (putOff === undefined || !goal.untriedTests || needsWhy(goal, putOff).why) return "";
  return ` · ${goal.untriedTests === 1 ? "1 thing" : `${goal.untriedTests} things`} to try, put off`;
}
