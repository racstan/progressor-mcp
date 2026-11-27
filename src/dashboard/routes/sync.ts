// Plan sync on this computer (sync/): Settings › Sync.
//   GET  /api/sync       {enabled, repo, talk, state}: whether it is on, with which repo, and how the last round went
//   POST /api/sync/now   runs one round now and answers the same
//   POST /api/sync/off   turns it off on this computer (turning it on needs `progressor-mcp sync connect`)
import { hostname } from "node:os";
import { readSettings, writeSettings } from "../../settings.js";
import { defaultPlansDir } from "../../sync/connect.js";
import { defaultLinksFile } from "../../sync/identity.js";
import { type SyncState, readSyncState, syncOnce, syncStateFileFor } from "../../sync/run.js";
import { globalFileFor } from "../../globalRules.js";
import type { FeatureRoute, RouteContext } from "../routes.js";
import { allProjects } from "../workspace.js";

export interface SyncView {
  enabled: boolean;
  repo: string;
  talk: boolean;
  state: SyncState;
}

function view(ctx: RouteContext): SyncView {
  const { enabled, repo, talk } = readSettings(ctx.settingsFile).sync;
  return { enabled, repo, talk, state: readSyncState(syncStateFileFor(ctx.settingsFile)) };
}

export const syncRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/sync$/,
    handle(ctx) {
      ctx.json(200, view(ctx));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/sync\/now$/,
    header: "sync",
    async handle(ctx) {
      if (!readSettings(ctx.settingsFile).sync.enabled) throw new Error("Plan sync is off on this computer. Ask your AI to turn it on.");
      await syncOnce({
        settingsFile: ctx.settingsFile,
        plansDir: defaultPlansDir(ctx.registryFile),
        linksFile: defaultLinksFile(ctx.registryFile),
        globalFile: globalFileFor(ctx.registryFile),
        projects: allProjects(ctx.registryFile).map((p) => p.root),
        host: hostname(),
      });
      const out = view(ctx);
      ctx.send("sync", out);
      ctx.json(200, out);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/sync\/off$/,
    header: "sync",
    handle(ctx) {
      writeSettings(ctx.settingsFile, "sync", { enabled: false });
      const out = view(ctx);
      ctx.send("sync", out);
      ctx.json(200, out);
    },
  },
];
