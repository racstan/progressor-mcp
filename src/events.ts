// What happened between one look at every project and the next, as plain data: the AI asked a
// question, something is ready to try by hand, a goal finished, a hotfix arrived, alternatives were
// offered. Pure, with no file or network use, so the page (desktop pop-ups, ui/notify.ts) and the
// dashboard server (phone pushes, ntfy.ts) share one diff.

export type EventKind = "question" | "handTest" | "goalFinished" | "hotfix" | "alternatives";

/** One goal as seen at a look: its state and the IDs of what waits on the Developer. */
export interface LookGoal {
  id: string;
  title: string;
  status: string;
  hotfix?: boolean;
  /** Open questions (their IDs). */
  questions?: string[];
  /** Hand tests still to try (their IDs). */
  tests?: string[];
  /** Alternatives offered and not yet chosen (their IDs); the alternatives feature fills this in. */
  alternatives?: string[];
}

export interface LookProject {
  id: string;
  name: string;
  goals: LookGoal[];
}

export type Look = LookProject[];

export interface PlanEvent {
  kind: EventKind;
  /** Stable for this one happening, so it is never announced twice. */
  key: string;
  project: { id: string; name: string };
  goal: { id: string; title: string };
}

/** The new happenings between two looks. Nothing on the first look; new projects are not announced. */
export function eventsBetween(before: Look | undefined, after: Look): PlanEvent[] {
  if (!before) return [];
  const events: PlanEvent[] = [];
  for (const project of after) {
    const was = before.find((p) => p.id === project.id);
    if (!was) continue;
    const at = { id: project.id, name: project.name };
    for (const goal of project.goals) {
      const old = was.goals.find((g) => g.id === goal.id);
      const base = { project: at, goal: { id: goal.id, title: goal.title } };
      const prefix = `${project.id}/${goal.id}`;
      if (!old && goal.hotfix) events.push({ ...base, kind: "hotfix", key: `hotfix/${prefix}` });
      if (old && old.status !== "done" && goal.status === "done") events.push({ ...base, kind: "goalFinished", key: `goalFinished/${prefix}` });
      const added = (kind: EventKind, now: string[] | undefined, then: string[] | undefined) => {
        for (const id of now ?? []) if (!(then ?? []).includes(id)) events.push({ ...base, kind, key: `${kind}/${prefix}/${id}` });
      };
      added("question", goal.questions, old?.questions);
      added("handTest", goal.tests, old?.tests);
      added("alternatives", goal.alternatives, old?.alternatives);
    }
  }
  return events;
}
