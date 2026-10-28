// How get_status and the Claude Code hooks say the hand tests. It is its own small module so the
// hooks, a short-lived process run on every prompt, do not load the whole MCP server to say it.
import type { HandTest } from "./planFile.js";

export const handTestWord: Record<HandTest["result"], string> = {
  pending: "not tried yet",
  works: "works",
  "doesn't work": "DOESN'T WORK",
  "won't test": "the Developer won't test it",
};

/** "1 works" but "2 work". */
const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the Developer was asked to try by hand and what they found: counts, what is still open, and
 * every mark the Agent has not been shown yet (a failure says which Task it added).
 */
export function handTestLines(tests: HandTest[]): string[] {
  if (tests.length === 0) return [];
  const count = (r: HandTest["result"]) => tests.filter((h) => h.result === r).length;
  const parts = [
    ...(count("pending") > 0 ? [`${count("pending")} not tried yet`] : []),
    ...(count("works") > 0 ? [say(count("works"), "works", "work")] : []),
    ...(count("doesn't work") > 0 ? [say(count("doesn't work"), "doesn't work", "don't work")] : []),
    ...(count("won't test") > 0 ? [`${count("won't test")} won't be tested`] : []),
  ];
  const open = tests.filter((h) => h.result === "pending");
  const fresh = tests.filter((h) => h.result !== "pending" && !h.seen);
  const sentence = (text: string) => `${text.replace(/[.\s]+$/, "")}.`;
  return [
    `Hand tests (for the Developer to try; they mark them on the dashboard): ${parts.join(", ")}.`,
    ...(open.length > 0 ? ["Not tried yet:", ...open.map((h) => `- ${h.id} ${h.text}${h.task ? ` (about ${h.task})` : ""}`)] : []),
    ...(fresh.length > 0
      ? [
          "New marks from the Developer since the last status:",
          ...fresh.map(
            (h) =>
              `- ${h.id} ${handTestWord[h.result]}: ${h.note ? `${sentence(h.text)} Their note: ${h.note}` : h.text}${h.taskAdded ? ` (step ${h.taskAdded} was added to fix it)` : ""}`,
          ),
        ]
      : []),
  ];
}
