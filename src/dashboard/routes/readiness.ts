// Ready to launch? (readiness.ts): what still stands before a launch or release. Reads only: the AI
// marks goals for launch; the page and the AI's launch_readiness tool show the same summary.
//   GET /api/projects/:id/readiness   the summary, with each group of what is left
import type { FeatureRoute } from "../routes.js";

export const readinessRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/readiness$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      ctx.json(200, { readiness: project.readiness() });
    },
  },
];
