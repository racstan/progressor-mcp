// Is a newer Progressor out? (updateCheck.ts)
//   GET  /api/update                 {current, latest, available, install, command, enabled}; asks npm at most once a day
//   POST /api/update/dismiss {version}  hides the notice until a newer version than that comes out
import { readFileSync } from "node:fs";
import { readSettings } from "../../settings.js";
import { type FetchLike, dismissUpdate, howInstalled, readUpdateState, refreshUpdate, updateFileFor, updateView } from "../../updateCheck.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

const CURRENT: string = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version;

async function view(ctx: RouteContext, ask: boolean) {
  const file = updateFileFor(ctx.registryFile);
  const enabled = readSettings(ctx.settingsFile).updates.check;
  const state = ask ? await refreshUpdate(file, { enabled, fetch: ctx.fetch as FetchLike | undefined }) : readUpdateState(file);
  return updateView(state, CURRENT, howInstalled(), enabled);
}

export const updateRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/update$/,
    async handle(ctx) {
      ctx.json(200, await view(ctx, true));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/update\/dismiss$/,
    header: "update",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      if (typeof body.version !== "string") throw new Error("Say which version to stop showing.");
      dismissUpdate(updateFileFor(ctx.registryFile), body.version);
      const out = await view(ctx, false);
      ctx.send("update", out);
      ctx.json(200, out);
    },
  },
];
