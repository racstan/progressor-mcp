// Recurring goals on the dashboard (routines.ts). The AI makes and runs routines by itself; the
// Developer may pause, resume or stop one here.
//   GET  /api/projects/:id/routines                             every routine, with its pace in words
//   POST /api/projects/:id/routines/:routine/(pause|resume|stop)
// Also: the hub's timer adds the goals of due routines (runRoutinesIn), so they come back on time
// even while no AI chat is open.
import { Project } from "../../project.js";
import { everyWords } from "../../routines.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

const LABEL = { pause: "Paused a routine", resume: "Let a routine carry on", stop: "Stopped a routine" } as const;

export const routinesRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/routines$/,
    handle(ctx) {
      ctx.json(200, { routines: projectOf(ctx).routines().map((r) => ({ ...r, words: everyWords(r.every) })) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/routines\/([^/]+)\/(pause|resume|stop)$/,
    header: "routines",
    handle(ctx) {
      const project = projectOf(ctx);
      const [, , id, action] = ctx.match as [string, string, string, keyof typeof LABEL];
      const routine = project.transaction(LABEL[action], () =>
        action === "stop" ? project.stopRoutine(id) : project.pauseRoutine(id, action === "pause"),
      );
      ctx.json(200, { routine });
    },
  },
];

/**
 * Adds the goals of the routines due in one project, as the AI (the routine is the AI's, nobody is
 * asked), when routines are on and the dashboard may add them. Never throws.
 */
export function runRoutinesIn(root: string, settingsFile: string, now?: () => Date): number {
  try {
    const settings = readSettings(settingsFile, root);
    if (!settings.routines.enabled || !settings.routines.createFromDashboard) return 0;
    const project = new Project({
      root,
      session: { id: "routines", pid: process.pid },
      actor: "AI",
      clearStaleClaims: false,
      history: (r) => readSettings(settingsFile, r).history,
      ...(now ? { now } : {}),
    });
    if (project.routines().length === 0) return 0;
    return project.runRoutines().length;
  } catch {
    return 0; // a plan that can't be read adds nothing
  }
}
