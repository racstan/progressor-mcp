// Words and groups for the Risks page. Pure, so they are tested; the page only lays them out.

import type { Level } from "../risks.js";

export const RISKS_INTRO = "What could go wrong with this project, and what is being done about it. Your AI keeps this list up to date as it works; you only read it.";
export const RISKS_EMPTY = "No risks yet. Your AI adds risks it notices as it works, and they show up here by itself.";
export const RISK_NOT_REDUCING = "Nothing is reducing this yet.";

/** "low", "medium" or "high" as a word for how likely a risk is. */
export const likelihoodWords = (l: Level): string => ({ low: "Unlikely", medium: "Possible", high: "Likely" })[l];
/** How bad it would be if it happened. */
export const impactWords = (l: Level): string => ({ low: "Minor", medium: "Serious", high: "Severe" })[l];

/** One line for a screen reader and the hover: "Likely and severe: score 9 of 9". */
export const scoreWords = (likelihood: Level, impact: Level, score: number): string =>
  `${likelihoodWords(likelihood)} and ${impactWords(impact).toLowerCase()}: ${score} out of 9`;

/** Where a risk sits on the 3 by 3 grid: column 0 to 2 from unlikely to likely, row 0 to 2 from severe (top) to minor. */
export const gridCell = (likelihood: Level, impact: Level): { col: number; row: number } => {
  const n = (l: Level) => ["low", "medium", "high"].indexOf(l);
  return { col: n(likelihood), row: 2 - n(impact) };
};

/** What a linked goal is up to, in a word. */
export function goalStateWords(status: string | undefined): string {
  switch (status) {
    case undefined:
      return "No longer in the plan";
    case "done":
      return "Finished";
    case "dropped":
      return "Cancelled";
    case "planned":
      return "Not started";
    case "testing":
      return "Waiting on your tests";
    case "paused":
      return "Paused";
    default:
      return "In progress";
  }
}

/** Open risks first; reduced and closed ones are folded under them. */
export function splitRisks<R extends { status: string }>(risks: R[]): { open: R[]; quiet: R[] } {
  return { open: risks.filter((r) => r.status === "open"), quiet: risks.filter((r) => r.status !== "open") };
}

/** "Reduced" or "Closed", for the folded risks; "Open" otherwise. */
export const riskStatusWords = (status: string): string => (status === "reduced" ? "Reduced" : status === "closed" ? "Closed" : "Open");
