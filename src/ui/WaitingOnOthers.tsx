import type { Person } from "../people.js";
import { StepIcon } from "./Steps.js";
import { type WaitLine, groupByPerson, othersWaitingWords } from "./others.js";

/** One project's steps waiting on others, and its people. */
export interface OthersBlock {
  projectId: string;
  projectName: string;
  lines: WaitLine[];
  people: Person[];
}

/**
 * "Waiting on others": the steps held by someone other than you, grouped by person with what each needs
 * to do, apart from Needs you (nothing here needs you). Click a step to open its goal. Hidden when
 * nothing waits on anyone. With several projects (Home) each project is named.
 */
export function WaitingOnOthers({ blocks, showProject, onOpen }: { blocks: OthersBlock[]; showProject: boolean; onOpen: (projectId: string, goalId: string) => void }) {
  const shown = blocks.filter((b) => b.lines.length > 0);
  if (shown.length === 0) return null;
  const all = groupByPerson(shown.flatMap((b) => b.lines), shown.flatMap((b) => b.people));
  return (
    <section className="section others" aria-label="Waiting on others">
      <h2>Waiting on others</h2>
      <p className="page-sub">{othersWaitingWords(all)}. None of these needs you.</p>
      {shown.map((b) => (
        <div key={b.projectId} className="others-project">
          {showProject && <h3 className="others-proj">{b.projectName}</h3>}
          {groupByPerson(b.lines, b.people).map((g) => (
            <div key={g.name} className="others-person">
              <h3>{g.name}{g.role && <span className="role"> · {g.role}</span>}</h3>
              <ul className="list">
                {g.steps.map((s) => (
                  <li key={`${s.goal}/${s.step}`}>
                    <button className="list-row" onClick={() => onOpen(b.projectId, s.goal)} title="Open this step's goal">
                      <StepIcon status="waiting on someone" />
                      <span className="t">{s.title}</span>
                      <span className="end">{s.goalTitle}</span>
                      <span className="sub">{s.need?.trim() || "Waiting on them"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
