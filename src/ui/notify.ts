// Desktop pop-ups when a goal is finished: which goals just finished, from one look at every
// project to the next, and what the pop-up says. The page shows them (App.tsx) while the Settings
// switch is on.

type ProjectLike = { id: string; name: string; goals: GoalLike[] };
type GoalLike = { id: string; title: string; status: string };

/** Each goal's status by "project/goal", from one look at every project. */
export type Snapshot = Record<string, string>;

export function snapshot(projects: ProjectLike[]): Snapshot {
  return Object.fromEntries(projects.flatMap((p) => p.goals.map((g) => [`${p.id}/${g.id}`, g.status])));
}

/** Goals that were open at the last look and are finished now; nothing before the first look. */
export function newlyFinished<P extends ProjectLike>(before: Snapshot | undefined, projects: P[]): { project: P; goal: P["goals"][number] }[] {
  if (!before) return [];
  return projects.flatMap((project) =>
    project.goals
      .filter((g) => g.status === "done" && before[`${project.id}/${g.id}`] !== undefined && before[`${project.id}/${g.id}`] !== "done")
      .map((goal) => ({ project, goal })),
  );
}

/** What the pop-up says; the tag makes several open dashboard tabs show it once. */
export function finishedNote({ project, goal }: { project: ProjectLike; goal: GoalLike }) {
  return { title: `Finished: ${goal.title}`, body: `In ${project.name}. Click to open it.`, tag: `progressor-finished/${project.id}/${goal.id}` };
}
