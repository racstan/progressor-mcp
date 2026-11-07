// plan_history: the plan's recent changes, and going back to before one (history.ts). Kept to one
// short tool, because every tool's description costs the AI tokens on every call.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { type HistoryItem, listHistory } from "../history.js";
import type { Project, Restored } from "../project.js";
import { readSettings } from "../settings.js";
import type { FeatureToolContext } from "./index.js";

/** When a change was made, to the minute, in UTC. */
const when = (at: string) => `${at.slice(0, 16).replace("T", " ")} UTC`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The newest changes, one line each: ID, when, who, what, which files. */
export function historyLines(items: HistoryItem[], count: number, enabled: boolean): string {
  const shown = items.slice(-count).reverse();
  const off = enabled ? [] : ["History is turned off in Settings, so new changes are not recorded."];
  if (shown.length === 0) return [...off, "The plan's history is empty."].join("\n");
  return [
    ...off,
    `The plan's last ${plural(shown.length, "change")}, newest first (plan_history restore: <id> goes back to before one):`,
    ...shown.map((i) => `- ${i.id} · ${when(i.at)} · ${i.actor} · ${i.label} · ${i.files.join(", ")}`),
  ].join("\n");
}

/** What going back did, for the AI. */
export function restoredText(r: Restored): string {
  const developer = r.undone.filter((i) => i.actor === "Developer");
  return [
    `Went back to before ${r.item.id} (${r.item.label}, by ${r.item.actor}): undid ${plural(r.undone.length, "change")}.`,
    r.files.length > 0 ? `Put back: ${r.files.join(", ")}.` : "The plan files were already like that.",
    ...(developer.length > 0
      ? [`This also undid the Developer's own ${plural(developer.length, "change")} on the dashboard (${developer.map((i) => i.label).join("; ")}); tell them.`]
      : []),
    "Messages with the Developer are not changed.",
    r.entry ? `To undo this: plan_history restore: ${r.entry.id}.` : "History is off, so this cannot be undone.",
  ].join("\n");
}

export function registerHistoryTools(server: McpServer, ctx: FeatureToolContext): void {
  server.registerTool(
    "plan_history",
    {
      title: "Plan history",
      description: "The plan's recent changes (who, when, what). restore: <id> goes back to before that change; that can be undone too.",
      inputSchema: {
        restore: z.string().optional().describe("A change's ID from the list."),
        list: z.number().int().min(1).max(100).optional().describe("How many changes to list; 10 unless set."),
      },
    },
    ({ restore, list }) =>
      ctx.respondIn(undefined, (p: Project) => {
        if (restore) return ctx.doneIn(p, restoredText(p.restoreHistory(restore.trim())));
        return historyLines(listHistory(p.historyDir), list ?? 10, readSettings(ctx.settingsFile, p.root).history.enabled);
      }),
  );
}
