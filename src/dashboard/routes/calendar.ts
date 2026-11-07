// The Calendar on the dashboard (calendar.ts).
//   GET /api/projects/:id/calendar   every dated thing in the project's plan, as events
import { calendarEvents } from "../../calendar.js";
import { listHandoffs } from "../../handoff.js";
import type { Project } from "../../project.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute } from "../routes.js";

/** The project's events now; a goal whose plan can't be read shows without its steps. */
export function projectCalendar(project: Project, settingsFile?: string) {
  const roadmap = project.roadmap();
  const goals = roadmap.goals.map((goal) => {
    try {
      const plan = project.plan(goal.id);
      return { goal, tasks: plan.tasks, handTests: plan.handTests };
    } catch {
      return { goal, tasks: [], handTests: [] };
    }
  });
  let estimates;
  try {
    estimates = settingsFile ? readSettings(settingsFile, project.root).estimates : undefined;
  } catch {
    estimates = undefined;
  }
  let schedule;
  try {
    schedule = project.schedule(estimates);
  } catch {
    schedule = undefined;
  }
  let handoffs: ReturnType<typeof listHandoffs> = [];
  try {
    handoffs = listHandoffs(project);
  } catch {
    handoffs = [];
  }
  return calendarEvents({ goals, schedule, routines: roadmap.routines, handoffs, now: project.now() });
}

export const calendarRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/calendar$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) return ctx.json(404, { error: "No such project on the dashboard." });
      ctx.json(200, { now: project.now().toISOString(), events: projectCalendar(project, ctx.settingsFile) });
    },
  },
];
