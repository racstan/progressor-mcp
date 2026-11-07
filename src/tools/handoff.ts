// handoff: the facts for a handoff over a range of time or commits, then saving what the AI wrote
// from them (handoff.ts). One short tool, because every tool's description costs the AI tokens.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { handoffFacts, saveHandoff } from "../handoff.js";
import { readSettings } from "../settings.js";
import type { FeatureToolContext } from "./index.js";

export function registerHandoffTools(server: McpServer, ctx: FeatureToolContext): void {
  server.registerTool(
    "handoff",
    {
      title: "Handoff",
      description:
        "A markdown handoff of a stretch of work, for whoever picks it up next. Without text: the facts for the range (steps, decisions, open items, commits, files). Write the handoff from them, then call again with text and title to save it for the dashboard.",
      inputSchema: {
        since: z.string().optional().describe("A date (2026-11-01) or a commit to start after; the last handoff when left out."),
        until: z.string().optional().describe("A date to end at; now when left out."),
        commits: z.array(z.string()).optional().describe("Exactly these commits, instead of a range."),
        title: z.string().max(120).optional(),
        text: z.string().optional().describe("The handoff you wrote, in markdown."),
      },
    },
    ({ since, until, commits, title, text }) =>
      ctx.respondIn(undefined, (p) => {
        const facts = handoffFacts(p, { since, until, commits });
        if (text === undefined) return facts.text;
        if (!title?.trim()) throw new Error("Give the handoff a title, such as 'Week of 2 November'.");
        const keep = readSettings(ctx.settingsFile, p.root).handoffs.keep;
        const saved = saveHandoff(p, { title, text, range: facts.range, commits: facts.commits }, keep);
        return ctx.withNow(`Saved the handoff ${saved.file} (${facts.range}). The Developer can read it on the dashboard's Handoffs page.`);
      }),
  );
}
