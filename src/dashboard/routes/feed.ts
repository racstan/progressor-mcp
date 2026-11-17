// The project's activity feed, worked out from the plan's own dates (feed.ts).
//   GET  /api/projects/:id/feed   what happened, newest first; the page marks what is new to it
import { type FeedGoal, buildFeed } from "../../feed.js";
import type { Project } from "../../project.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

/** The goals' plans as the feed reads them; a goal whose plan cannot be read adds nothing. */
export function feedGoals(project: Project): FeedGoal[] {
  return project.roadmap().goals.flatMap((g) => {
    try {
      const plan = project.plan(g.id);
      const talk = project.talk(g.id);
      return [{ id: g.id, title: g.title, status: g.status, updated: g.updated, tasks: plan.tasks, decisions: plan.decisions, handTests: plan.handTests, questions: talk.questions }];
    } catch {
      return [];
    }
  });
}

export const feedRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/feed$/,
    handle(ctx) {
      ctx.json(200, { items: buildFeed(feedGoals(projectOf(ctx))) });
    },
  },
];
