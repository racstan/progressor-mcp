// Settings for how Progressor works (settings.ts), read and changed from the dashboard's Settings.
//   GET  /api/settings?project=<id>             the settings in effect (for that project, if named)
//   POST /api/settings        {section, values, project?}   change one section
//   POST /api/settings/reset  {section?, project?}          back to the defaults
import { SETTINGS_SECTIONS, maskSecrets, readOwnSettings, readSettings, resetSettings, writeSettings } from "../../settings.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

/** The project folder a request names by its dashboard ID; undefined for "every project". Throws when unknown. */
function projectRoot(ctx: RouteContext, id: unknown): string | undefined {
  if (id === undefined || id === null || id === "") return undefined;
  if (typeof id !== "string") throw new Error("The project must be named by its ID.");
  const project = ctx.project(id);
  if (!project) throw new Error("No such project on the dashboard.");
  return project.root;
}

function view(ctx: RouteContext, root: string | undefined) {
  const { settings, secretsSet } = maskSecrets(readSettings(ctx.settingsFile, root));
  return { sections: SETTINGS_SECTIONS, settings, secretsSet, project: root ? readOwnSettings(ctx.settingsFile, root) : undefined };
}

/** What GET /api/settings answers. */
export type SettingsView = ReturnType<typeof view>;

export const settingsRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/settings$/,
    handle(ctx) {
      ctx.json(200, view(ctx, projectRoot(ctx, ctx.url.searchParams.get("project") ?? undefined)));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/settings$/,
    header: "settings",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { section, values } = body;
      if (typeof section !== "string") throw new Error("Say which settings to change.");
      if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Give the new values.");
      const root = projectRoot(ctx, body.project);
      writeSettings(ctx.settingsFile, section, values as Record<string, unknown>, root);
      ctx.send("settings", { section });
      ctx.json(200, view(ctx, root));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/settings\/reset$/,
    header: "settings",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { section } = body;
      if (section !== undefined && typeof section !== "string") throw new Error("Say which settings to reset, or none to reset them all.");
      const root = projectRoot(ctx, body.project);
      resetSettings(ctx.settingsFile, section, root);
      ctx.send("settings", { section: section ?? null });
      ctx.json(200, view(ctx, root));
    },
  },
];
