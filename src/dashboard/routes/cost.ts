// Cost per goal on the dashboard (cost.ts): each goal's and step's tokens, and what they cost when a
// price is set in Settings. Reads only: the hooks count the tokens.
//   GET /api/projects/:id/cost   { priced, goals: { <id>: { tokens, money?, steps: { <step>: { tokens, money? } } } }, other }
import { type CostBook, type Prices, type Usage, goalCost, money, totalTokens } from "../../cost.js";
import type { Project } from "../../project.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute } from "../routes.js";

export interface CostLine {
  tokens: number;
  /** In dollars, when a price is set. */
  money?: number;
}

export interface CostView {
  priced: boolean;
  goals: Record<string, CostLine & { steps: Record<string, CostLine> }>;
  /** Tokens used while no goal was being worked on. */
  other: CostLine;
}

const line = (u: Usage, prices: Prices): CostLine => {
  const m = money(u, prices);
  return { tokens: totalTokens(u), ...(m !== undefined ? { money: m } : {}) };
};

export function costView(book: CostBook, prices: Prices): CostView {
  const goals: CostView["goals"] = {};
  for (const [id, g] of Object.entries(book.goals)) {
    const steps: Record<string, CostLine> = {};
    for (const [step, u] of Object.entries(g.steps)) steps[step] = line(u, prices);
    goals[id] = { ...line(goalCost(book, id), prices), steps };
  }
  return { priced: money({ input: 1, output: 1, cacheWrite: 0, cacheRead: 0 }, prices) !== undefined, goals, other: line(book.other, prices) };
}

/** The prices set in Settings, or none when they cannot be read. */
export function costPrices(project: Project, settingsFile: string): Prices {
  try {
    const { inputPrice, outputPrice } = readSettings(settingsFile, project.root).cost;
    return { input: inputPrice, output: outputPrice };
  } catch {
    return { input: 0, output: 0 };
  }
}

export const costRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/cost$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      ctx.json(200, costView(project.costBook(), costPrices(project, ctx.settingsFile)));
    },
  },
];
