// Who holds what: the project's steps waiting on someone other than the Developer (people.ts). Read only;
// the lines ride in the roadmap and overview payloads, so there is no route of its own.
import type { Person } from "../../people.js";
import type { Project } from "../../project.js";
import type { WaitLine } from "../../ui/others.js";

/** Every step waiting on someone, in each open goal's plan order, with its goal; goals that are over are left out. */
export function waitingOnOthersLines(project: Project): WaitLine[] {
  const lines: WaitLine[] = [];
  for (const goal of project.roadmap().goals) {
    if (goal.status === "done" || goal.status === "dropped") continue;
    try {
      for (const t of project.plan(goal.id).tasks) {
        if (t.status !== "waiting on someone") continue;
        lines.push({ goal: goal.id, goalTitle: goal.title, step: t.id ?? t.ref ?? `line-${t.line}`, title: t.title, ...(t.waitingFor ? { waitingFor: t.waitingFor } : {}), ...(t.need ? { need: t.need } : {}) });
      }
    } catch {
      // a goal whose plan cannot be read shows nothing
    }
  }
  return lines;
}

/** The people file, or none when it cannot be read. */
export function peopleList(project: Project): Person[] {
  try {
    return project.people();
  } catch {
    return [];
  }
}
