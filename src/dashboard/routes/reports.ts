// A step's reports on the dashboard (reports.ts). Reads only.
//   GET /api/projects/:id/goals/:goal/reports        the goal's reports, in the order written
//   GET /api/projects/:id/goals/:goal/reports/:rid   one report: {report, text}
import { listReports, readReport } from "../../reports.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function goalOf(ctx: RouteContext) {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  const goal = ctx.match[2]!;
  // Only a goal on the Roadmap: the ID never becomes a path of its own.
  if (!project.roadmap().goals.some((g) => g.id === goal)) throw new Error("No such goal in this project.");
  return { project, goal };
}

export const reportRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/reports$/,
    handle(ctx) {
      const { project, goal } = goalOf(ctx);
      ctx.json(200, listReports(project, goal));
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/reports\/([^/]+)$/,
    handle(ctx) {
      const { project, goal } = goalOf(ctx);
      ctx.json(200, readReport(project, goal, decodeURIComponent(ctx.match[3]!)));
    },
  },
];
