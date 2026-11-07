// The plan check-up on the dashboard (checkup.ts).
//   GET  /api/projects/:id/checkup   the last check-up's result (null when none ran yet)
//   POST /api/projects/:id/checkup   run it now; repairs follow the check-up settings
import { checkUp, lastCheckup } from "../../checkup.js";
import type { Project } from "../../project.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

export const checkupRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/checkup$/,
    handle(ctx) {
      ctx.json(200, { last: lastCheckup(projectOf(ctx)) ?? null });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/checkup$/,
    header: "checkup",
    handle(ctx) {
      const project = projectOf(ctx);
      const { autoRepair } = readSettings(ctx.settingsFile, project.root).checkup;
      ctx.json(200, { last: checkUp(project, { repair: autoRepair }) });
    },
  },
];
