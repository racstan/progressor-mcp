// Desktop pop-ups when a goal is finished: which goals just finished, from one look at every
// project to the next, and what the pop-up says. The page shows them (App.tsx) while the Settings
// switch is on.

import { type Look, eventsBetween } from "../events.js";

type ProjectLike = { id: string; name: string; goals: GoalLike[] };
type GoalLike = { id: string; title: string; status: string };

/** What was seen at one look at every project (the shared diff is in events.ts). */
export type Snapshot = Look;

export function snapshot(projects: ProjectLike[]): Snapshot {
  return projects.map((p) => ({ id: p.id, name: p.name, goals: p.goals.map((g) => ({ id: g.id, title: g.title, status: g.status })) }));
}

/** Goals that were open at the last look and are finished now; nothing before the first look. */
export function newlyFinished<P extends ProjectLike>(before: Snapshot | undefined, projects: P[]): { project: P; goal: P["goals"][number] }[] {
  return eventsBetween(before, snapshot(projects)).flatMap((e) => {
    if (e.kind !== "goalFinished") return [];
    const project = projects.find((p) => p.id === e.project.id);
    const goal = project?.goals.find((g) => g.id === e.goal.id);
    return project && goal ? [{ project, goal }] : [];
  });
}

/** What the pop-up says; the tag makes several open dashboard tabs show it once. */
export function finishedNote({ project, goal }: { project: ProjectLike; goal: GoalLike }) {
  return { title: `Finished: ${goal.title}`, body: `In ${project.name}. Click to open it.`, tag: `progressor-finished/${project.id}/${goal.id}` };
}
