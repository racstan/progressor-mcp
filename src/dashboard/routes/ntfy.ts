// Phone notifications (ntfy.ts): buttons in Settings.
//   POST /api/settings/ntfy/test       sends one test message to the saved server and topic
//   POST /api/settings/ntfy/new-topic  makes a new private topic; answers like GET /api/settings
import { type FetchFn, sendTest } from "../../ntfy.js";
import { readSettings, renewTopic } from "../../settings.js";
import { view } from "./settings.js";
import type { FeatureRoute } from "../routes.js";

export const ntfyRoutes: FeatureRoute[] = [
  {
    method: "POST",
    pattern: /^\/api\/settings\/ntfy\/new-topic$/,
    header: "ntfy",
    handle(ctx) {
      renewTopic(ctx.settingsFile);
      ctx.json(200, view(ctx, undefined));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/settings\/ntfy\/test$/,
    header: "ntfy",
    async handle(ctx) {
      const result = await sendTest(readSettings(ctx.settingsFile).ntfy, ctx.fetch as FetchFn | undefined);
      ctx.json(result.ok ? 200 : 502, result.ok ? { ok: true } : { error: result.error });
    },
  },
];
