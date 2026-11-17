// The AI chats working on a project right now (liveSessions.ts) and its helpers against the limit.
//   GET /api/projects/:id/sessions   { sessions, helpers: { busy, limit } }
// Reads only, from the heartbeat records beside the project list.
import { liveSessions } from "../../liveSessions.js";
import { defaultServersDir, listServers } from "../../servers.js";
import type { FeatureRoute } from "../routes.js";

export const sessionRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/sessions$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      const { busy, limit } = project.helperLoad();
      ctx.json(200, { sessions: liveSessions(project, listServers(defaultServersDir(ctx.registryFile))), helpers: { busy, ...(limit !== undefined ? { limit } : {}) } });
    },
  },
];
