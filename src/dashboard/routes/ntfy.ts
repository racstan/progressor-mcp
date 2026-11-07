// Phone notifications (ntfy.ts): the "Send a test" button in Settings.
//   POST /api/settings/ntfy/test    sends one test message to the saved server and topic
import { type FetchFn, sendTest } from "../../ntfy.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute } from "../routes.js";

export const ntfyRoutes: FeatureRoute[] = [
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
