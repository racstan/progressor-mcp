// The project's risks on the dashboard (risks.ts). Reads only: the AI keeps the list, the Developer reads it.
//   GET /api/projects/:id/risks   the risks, open first then highest score first, each with its linked goals' titles and states
import type { Project } from "../../project.js";
import { type Risk, riskScore, sortedRisks, unreducedSeriousRisks } from "../../risks.js";
import type { FeatureRoute } from "../routes.js";

/** A goal a risk is linked to; title and status are missing when the goal is no longer in the plan. */
export interface RiskGoal {
  id: string;
  title?: string;
  status?: string;
}

export interface RiskView extends Omit<Risk, "goals"> {
  /** Likelihood times impact, 1 to 9. */
  score: number;
  goals: RiskGoal[];
  /** Serious and nothing is reducing it: shown in Needs you. */
  serious: boolean;
}

/** What a project's risks and their linked goals look like to the page. */
export function riskViews(project: Project): RiskView[] {
  const goals = new Map(project.roadmap().goals.map((g) => [g.id, g]));
  const risks = project.risks();
  const serious = new Set(unreducedSeriousRisks(risks, (id) => goals.get(id)?.status).map((r) => r.id));
  return sortedRisks(risks).map((r) => ({
    ...r,
    score: riskScore(r),
    goals: r.goals.map((id) => {
      const g = goals.get(id);
      return g ? { id, title: g.title, status: g.status } : { id };
    }),
    serious: serious.has(r.id),
  }));
}

/** The serious risks nothing is reducing, as the home page and sidebar list them (id and title only). */
export function seriousRiskLines(project: Project): { id: string; title: string }[] {
  try {
    return riskViews(project)
      .filter((r) => r.serious)
      .map(({ id, title }) => ({ id, title }));
  } catch {
    return []; // a risks file that cannot be read shows nothing
  }
}

export const riskRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/risks$/,
    handle(ctx) {
      const project = ctx.project(ctx.match[1]!);
      if (!project) throw new Error("No such project on the dashboard.");
      ctx.json(200, { risks: riskViews(project) });
    },
  },
];
