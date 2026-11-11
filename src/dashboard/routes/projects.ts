// Taking a project off the dashboard (registry.ts).
//   POST /api/projects/:id/remove   removes it from the project list and hides it from Workspace scans
// Its folder and its .progressor/ plan are not touched; it comes back when a Progressor server starts
// in it again (registerProject).
import { removeProject } from "../registry.js";
import type { FeatureRoute } from "../routes.js";

export const projectRoutes: FeatureRoute[] = [
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/remove$/,
    header: "remove-project",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      const removed = removeProject(project.root, ctx.registryFile);
      ctx.refresh();
      ctx.json(200, { removed: removed.id });
    },
  },
];
