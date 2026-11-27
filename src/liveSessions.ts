// The AI chats working on a project right now. Each chat's Progressor server keeps a heartbeat record
// (servers.ts, refreshed every 15 s and dropped a minute after it stops); this joins the fresh records
// for the project with the goals each chat holds and the step it is on. Reads only.
import { pathKey } from "./dashboard/registry.js";
import type { Project } from "./project.js";
import type { ServerRecord } from "./servers.js";
import { branchMatchesStep } from "./stepSync.js";

export interface LiveSession {
  /** The chat's session ID. */
  session: string;
  pid: number;
  /** For a helper chat working in a git worktree of the project: that folder and its branch. */
  worktree?: string;
  branch?: string;
  /** When its server started. */
  since: string;
  /** Its last heartbeat. */
  seen: string;
  /** A helper chat in a worktree, shown on the step its branch is for (in a goal another chat holds). */
  helper?: boolean;
  /** The goals it holds, each with the step in progress when there is one. */
  goals: { id: string; title: string; step?: { id: string; title: string } }[];
}

/** The chats working on this project, oldest first; `records` come from listServers (live and fresh only). */
export function liveSessions(project: Project, records: readonly ServerRecord[]): LiveSession[] {
  const here = pathKey(project.root);
  const mine = records.filter((r) => r.kind === "session" && r.session && pathKey(r.root) === here);
  if (mine.length === 0) return [];
  const goals = project.roadmap().goals.filter((g) => g.claim && g.status !== "done" && g.status !== "dropped");
  return [...mine]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.pid - b.pid)
    .map((r) => {
      const held = goals
        .filter((g) => g.claim!.session === r.session)
        .map((g) => {
          let step: { id: string; title: string } | undefined;
          try {
            const t = project.plan(g.id).tasks.find((x) => x.status === "in progress");
            if (t?.id) step = { id: t.id, title: t.title };
          } catch {
            // a plan file that can't be read shows the goal without its step
          }
          return { id: g.id, title: g.title, ...(step ? { step } : {}) };
        });
      const helping = held.length === 0 && r.worktree && r.branch ? helperStep(project, goals, r.branch) : undefined;
      return {
        session: r.session!,
        pid: r.pid,
        ...(r.worktree ? { worktree: r.worktree } : {}),
        ...(r.branch ? { branch: r.branch } : {}),
        since: r.startedAt,
        seen: r.beatAt,
        ...(helping ? { helper: true } : {}),
        goals: helping ? [helping] : held,
      };
    });
}

/**
 * The step a helper chat's branch is for, in one of the goals some chat holds: the unfinished step that
 * records that branch, else the one the branch name names (t3-export is t3).
 */
function helperStep(project: Project, goals: { id: string; title: string }[], branch: string): LiveSession["goals"][number] | undefined {
  let byName: LiveSession["goals"][number] | undefined;
  for (const g of goals) {
    let tasks;
    try {
      tasks = project.plan(g.id).tasks;
    } catch {
      continue;
    }
    for (const t of tasks) {
      if (!t.id || t.status === "done" || t.status === "dropped") continue;
      const found = { id: g.id, title: g.title, step: { id: t.id, title: t.title } };
      if (t.helper?.branch === branch) return found;
      if (!byName && !t.helper?.branch && branchMatchesStep(branch, t.id)) byName = found;
    }
  }
  return byName;
}
