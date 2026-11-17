// Pull requests and CI checks for a goal's steps (ci.ts). Reads only.
//   GET /api/projects/:id/goals/:goalId/ci   the goal's pull requests, its latest checks, and each step's
//
// The answer comes from the kept file at once; when it is a few minutes old a refresh starts in the
// background, and open pages are told with a "ci" event when it brought something new.
import { type CiDeps, type CiTask, ciCacheFile, failedGoals, goalCi, kickCiRefresh, readCiCache, realCiDeps } from "../../ci.js";
import type { Project } from "../../project.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute, HubContext } from "../routes.js";

/** The steps that have an ID, in the shape ci.ts reads. */
const stepsOf = (tasks: readonly (Omit<CiTask, "id"> & { id?: string | undefined })[]): CiTask[] =>
  tasks.flatMap((t) => (t.id ? [{ id: t.id, status: t.status, commits: t.commits, branch: t.branch, finishedAt: t.finishedAt }] : []));

/** Every goal of the project with its steps; a plan that cannot be read counts as having none. */
export function goalsWithSteps(project: Project): { id: string; title: string; status: string; tasks: CiTask[] }[] {
  let goals: { id: string; title: string; status: string }[];
  try {
    goals = project.roadmap().goals;
  } catch {
    return [];
  }
  return goals.map(({ id, title, status }) => {
    let tasks: CiTask[] = [];
    try {
      tasks = stepsOf(project.plan(id).tasks);
    } catch {
      // a plan file that cannot be read has nothing to show
    }
    return { id, title, status, tasks };
  });
}

let realDeps: CiDeps | undefined;
const depsOf = (hub: Pick<HubContext, "ci">) => hub.ci ?? (realDeps ??= realCiDeps());

/** Whether pull requests and checks are looked up for this project (Settings › Pull requests and checks). */
export function ciOn(project: Project, settingsFile: string): boolean {
  try {
    return readSettings(settingsFile, project.root).ci.enabled;
  } catch {
    return true;
  }
}

/** Starts a background refresh of the project's pull requests and checks, when it is due and they are on. */
export function refreshProjectCi(project: Project, projectId: string, hub: Pick<HubContext, "ci" | "registryFile" | "settingsFile" | "send">): void {
  if (!ciOn(project, hub.settingsFile)) return;
  kickCiRefresh(
    project.root,
    () => goalsWithSteps(project).flatMap((g) => g.tasks),
    ciCacheFile(hub.registryFile, project.root),
    depsOf(hub),
    () => hub.send("ci", { project: projectId }),
  );
}

/** The open goals whose latest checks failed, from the kept file only: for Needs you. */
export function failedCheckLines(project: Project, registryFile: string, settingsFile: string): { id: string; title: string }[] {
  if (!ciOn(project, settingsFile)) return [];
  try {
    const cache = readCiCache(ciCacheFile(registryFile, project.root));
    // Nothing kept has failed: no need to read every plan (Home asks on every load).
    if (!JSON.stringify(cache).includes('"failed"')) return [];
    return failedGoals(goalsWithSteps(project), cache);
  } catch {
    return [];
  }
}

export const ciRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/ci$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      const goalId = ctx.match[2]!;
      // Only a goal on the Roadmap: the ID never becomes a path of its own.
      if (!project.roadmap().goals.some((g) => g.id === goalId)) throw new Error("No such goal in this project.");
      if (!ciOn(project, ctx.settingsFile)) return ctx.json(200, { prs: [], steps: {}, off: true });
      const tasks = stepsOf(project.plan(goalId).tasks);
      ctx.json(200, goalCi(tasks, readCiCache(ciCacheFile(ctx.registryFile, project.root))));
      refreshProjectCi(project, ctx.match[1]!, ctx);
    },
  },
];
