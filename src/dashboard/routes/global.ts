// Rules and context for every project on the dashboard's Home page (globalRules.ts).
//   GET  /api/global                       {rules, context}
//   POST /api/global/rules                 {text, hard?} adds a rule for every project
//   POST /api/global/rules/:id             {text?, hard?} rewords it or marks it must / should
//   POST /api/global/rules/:id/delete      removes it
//   POST /api/global/context               {text} replaces the context for every project
// Each change tells every open page ("global" event); an AI reads them at its next get_status.
import { addGlobalRule, globalFileFor, readGlobal, setGlobalContext, updateGlobalRule } from "../../globalRules.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

const fileOf = (ctx: RouteContext) => globalFileFor(ctx.registryFile);

/** The text and hard flag sent, checked. */
function fields(body: Record<string, unknown>): { text?: string; hard?: boolean } {
  const { text, hard } = body;
  if (text !== undefined && typeof text !== "string") throw new Error("The text must be text.");
  if (hard !== undefined && typeof hard !== "boolean") throw new Error("Say yes or no to must never be broken.");
  return { text, hard };
}

const changed = (ctx: RouteContext) => ctx.send("global", readGlobal(fileOf(ctx)));

export const globalRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/global$/,
    handle(ctx) {
      ctx.json(200, readGlobal(fileOf(ctx)));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/global\/rules$/,
    header: "global",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { text, hard } = fields(body);
      if (!text?.trim()) throw new Error("Write the rule first.");
      const rule = addGlobalRule(fileOf(ctx), text, hard ?? false);
      changed(ctx);
      ctx.json(201, rule);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/global\/rules\/([^/]+)\/delete$/,
    header: "global",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      updateGlobalRule(fileOf(ctx), ctx.match[1]!, { text: "" });
      changed(ctx);
      ctx.json(200, { deleted: ctx.match[1] });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/global\/rules\/([^/]+)$/,
    header: "global",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { text, hard } = fields(body);
      if (text === undefined && hard === undefined) throw new Error("Give the new wording or say whether it must never be broken.");
      if (text !== undefined && !text.trim()) throw new Error("Write the rule first; to remove it, use Remove.");
      const rule = updateGlobalRule(fileOf(ctx), ctx.match[1]!, { text, hard });
      changed(ctx);
      ctx.json(200, rule);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/global\/context$/,
    header: "global",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { text } = fields(body);
      if (text === undefined) throw new Error("Write the context first.");
      const context = setGlobalContext(fileOf(ctx), text);
      changed(ctx);
      ctx.json(200, { context });
    },
  },
];
