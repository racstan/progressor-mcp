// The rules block for a helper's brief (get_status for_helper), and what a helper chat started in a
// git worktree of the project is told by itself at session start (hooks.ts). Kept apart from the
// server, so the hook starts quickly.
import { type GlobalNotes, contextLines } from "./globalRules.js";
import { type StandingInstruction, hardFirst, helperLimit, ruleLimit } from "./roadmap.js";

/**
 * The rules as a block to paste into a helper agent's brief: hard rules first, then the others.
 * A helper does not see the Standing Instructions, but it is bound by them.
 */
export function formatRules(instructions: StandingInstruction[], global?: GlobalNotes): string {
  const everywhere = global ? hardFirst(global.rules) : [];
  const everywhereContext = global ? contextLines(global) : [];
  if (instructions.length === 0 && everywhere.length === 0 && everywhereContext.length === 0)
    return "No Standing Instructions are set for this project, so there is no rules block to add to the brief.";
  const hard = instructions.filter((i) => i.hard);
  const other = instructions.filter((i) => !i.hard);
  const own = helperLimit(instructions)?.limit;
  const everywhereLimit = global?.rules.reduce<number | undefined>((m, r) => { const l = ruleLimit(r); return l && (m === undefined || l < m) ? l : m; }, undefined);
  const limit = own === undefined ? everywhereLimit : everywhereLimit === undefined ? own : Math.min(own, everywhereLimit);
  const globalBlock = [
    ...(everywhere.length > 0
      ? [
          "Rules from the Developer for everything (they apply in every project and anywhere Progressor is used on this computer):",
          ...everywhere.map((r) => `- ${r.hard ? "HARD RULE, never break it: " : ""}${r.text}`),
        ]
      : []),
    ...everywhereContext,
  ];
  if (instructions.length === 0)
    return [...globalBlock, "This project has no rules of its own.", "Do not edit anything in .progressor/; the Agent that briefed you keeps the plan there."].join("\n");
  return [
    ...globalBlock,
    "Project rules from the Developer. Follow all of them in this work.",
    ...(hard.length > 0
      ? ["HARD RULES: never break these. If the work seems to need breaking one, stop and report back instead.", ...hard.map((i) => `- ${i.text}`)]
      : []),
    ...(other.length > 0 ? [...(hard.length > 0 ? ["Other rules:"] : []), ...other.map((i) => `- ${i.text}`)] : []),
    ...(limit ? [`Parallel limit: at most ${limit} helper agents work on this project at once, counting you, so do not start helper agents of your own.`] : []),
    "Do not edit anything in .progressor/; the Agent that briefed you keeps the plan there.",
  ].join("\n");
}
