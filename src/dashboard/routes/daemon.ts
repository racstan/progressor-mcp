// Where the dashboard runs, from Settings › Advanced (daemon.ts, daemonCommand.ts).
//   GET  /api/daemon                        whether the background dashboard is set up, and how it is
//   POST /api/daemon  {background: boolean} set it up to start at login (and start it), or take that away
import { describeStatus } from "../../daemon.js";
import { daemonInstalled, daemonStatus, installDaemon, requestDaemonStop, uninstallDaemon } from "../../daemonCommand.js";
import type { FeatureRoute } from "../routes.js";

async function view(registryFile: string) {
  const status = (await daemonStatus(registryFile)) ?? null;
  return { background: daemonInstalled(registryFile), status, text: describeStatus(status ?? undefined) };
}

/** What GET /api/daemon answers. */
export type DaemonView = Awaited<ReturnType<typeof view>>;

export const daemonRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/daemon$/,
    async handle(ctx) {
      ctx.json(200, await view(ctx.registryFile));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/daemon$/,
    header: "daemon",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      if (typeof body.background !== "boolean") return ctx.json(400, { error: "Say background: true or false." });
      let done: string;
      if (body.background) done = await installDaemon(ctx.registryFile);
      else {
        // The background process may be the one serving this page: answer first, then ask it to stop.
        done = await uninstallDaemon(ctx.registryFile, { stop: false });
        ctx.res.once("finish", () => requestDaemonStop(ctx.registryFile));
      }
      ctx.json(200, { ...(await view(ctx.registryFile)), done });
    },
  },
];
