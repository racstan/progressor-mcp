// Cost on the project's Dashboard page (cost.ts): the goals that used most, and what a finished step cost. Pure, so it is tested.
import type { CostLine, CostView } from "../dashboard/routes/cost.js";

export interface CostRow extends CostLine {
  id: string;
  /** The goal's title, or its ID when it is no longer in the plan. */
  title: string;
  /** Per finished step of the goal, when it has any. */
  perStep?: CostLine;
}

export interface CostSummary {
  total: CostLine;
  ranked: CostRow[];
  /** Across the goals with finished steps. */
  perStep?: CostLine;
}

const per = (l: CostLine, n: number): CostLine => ({ tokens: Math.round(l.tokens / n), ...(l.money !== undefined ? { money: l.money / n } : {}) });
const sum = (lines: CostLine[], priced: boolean): CostLine => ({
  tokens: lines.reduce((n, l) => n + l.tokens, 0),
  ...(priced ? { money: lines.reduce((n, l) => n + (l.money ?? 0), 0) } : {}),
});

/**
 * Undefined while nothing was counted. There is no cost per hour: tokens are counted only from when the
 * hooks started, while the time worked covers the whole plan, so the two don't divide.
 */
export function costSummary(cost: CostView | undefined, goals: { id: string; title: string; done: number }[]): CostSummary | undefined {
  if (!cost) return undefined;
  const byId = new Map(goals.map((g) => [g.id, g]));
  const lines = Object.entries(cost.goals).filter(([, l]) => l.tokens > 0);
  if (lines.length === 0) return undefined;
  const ranked = lines
    .map(([id, l]): CostRow => {
      const g = byId.get(id);
      const { steps: _steps, ...own } = l;
      return { id, title: g?.title ?? id, ...own, ...(g && g.done > 0 ? { perStep: per(own, g.done) } : {}) };
    })
    .sort((a, b) => b.tokens - a.tokens);
  const finished = ranked.filter((r) => (byId.get(r.id)?.done ?? 0) > 0);
  const steps = finished.reduce((n, r) => n + byId.get(r.id)!.done, 0);
  const total = sum(ranked, cost.priced);
  return {
    total,
    ranked: ranked.slice(0, 5),
    ...(steps > 0 ? { perStep: per(sum(finished, cost.priced), steps) } : {}),
  };
}
