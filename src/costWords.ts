// Cost in plain words: tokens briefly, and money when a price is set. No Node imports, so the
// dashboard's page uses it too.
import type { Usage } from "./cost.js";

/** "950 tokens", "12k tokens", "3.5M tokens". */
export function tokenWords(n: number): string {
  if (n < 1000) return `${n} tokens`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k tokens`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M tokens`;
}

/** Prices per million tokens, as the AI's provider charges them. */
export interface Prices {
  input: number;
  output: number;
}

/** What the tokens cost, priced like the API (cache writes at 1.25 times input, cache reads at a tenth); undefined with no price set. */
export function money(u: Usage, prices: Prices): number | undefined {
  if (!(prices.input > 0) && !(prices.output > 0)) return undefined;
  return (u.input * prices.input + u.cacheWrite * prices.input * 1.25 + u.cacheRead * prices.input * 0.1 + u.output * prices.output) / 1_000_000;
}

/** "$3.40", or "under $0.01". */
export const moneyWords = (amount: number): string => (amount < 0.01 ? "under $0.01" : `$${amount.toFixed(2)}`);

/** "Used 1.2M tokens", with "(about $3.40)" when priced. */
export function costWords(line: { tokens: number; money?: number }): string {
  return `Used ${tokenWords(line.tokens)}${line.money !== undefined ? ` (about ${moneyWords(line.money)})` : ""}`;
}
