// Handoffs on the dashboard (handoff.ts).
//   GET  /api/projects/:id/handoffs            the saved handoffs, newest first
//   GET  /api/projects/:id/handoffs/:file      one handoff's text
//   POST /api/projects/:id/handoffs/request    {since?, until?, last?} asks the AI for one, as a message
import { listHandoffs, readHandoff } from "../../handoff.js";
import { PROJECT_TALK, type Project } from "../../project.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What the Developer asked for, as the message the AI reads. */
export function requestMessage(body: Record<string, unknown>): string {
  const { since, until, last } = body;
  if (since !== undefined && (typeof since !== "string" || !DATE.test(since))) throw new Error("Give the start as a date.");
  if (until !== undefined && (typeof until !== "string" || !DATE.test(until))) throw new Error("Give the end as a date.");
  if (last !== undefined && (typeof last !== "number" || !Number.isInteger(last) || last < 1 || last > 500)) throw new Error("Give the number of commits, from 1 to 500.");
  if (last !== undefined && (since !== undefined || until !== undefined)) throw new Error("Ask for dates or for the last commits, not both.");
  const range =
    last !== undefined
      ? `the last ${last === 1 ? "commit" : `${last} commits`} (handoff since: "HEAD~${last}")`
      : since !== undefined || until !== undefined
        ? `${since ?? "the last handoff"} to ${until ?? "now"} (handoff${since ? ` since: "${since}"` : ""}${until ? ` until: "${until}"` : ""})`
        : "the work since the last handoff (handoff with no range)";
  return `On the dashboard I asked for a handoff of ${range}. Write it from the facts and save it.`;
}

export const handoffRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/handoffs$/,
    handle(ctx) {
      ctx.json(200, listHandoffs(projectOf(ctx)));
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/handoffs\/([^/]+\.md)$/,
    handle(ctx) {
      const file = ctx.match[2]!;
      ctx.json(200, { file, text: readHandoff(projectOf(ctx), file) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/handoffs\/request$/,
    header: "handoffs",
    async handle(ctx) {
      const project = projectOf(ctx);
      const body = await ctx.body();
      if (!body) return;
      const text = requestMessage(body);
      const message = project.transaction("Asked for a handoff", () => project.sendMessage(PROJECT_TALK, text));
      ctx.json(201, message);
    },
  },
];
