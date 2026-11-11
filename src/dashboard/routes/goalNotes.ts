// The Developer changing a goal's notes and decisions on the goal's page.
//   POST /api/projects/:id/goals/:goal/notes/:note             {text?, resolved?} rewords it, or marks it dealt with / open again
//   POST /api/projects/:id/goals/:goal/notes/:note/delete      removes it
//   POST /api/projects/:id/goals/:goal/decisions/:d            {text} rewords it
//   POST /api/projects/:id/goals/:goal/decisions/:d/delete     removes it
// Each change goes through the Project API under the plan's lock, so it is in the plan's history
// (and can be undone), and leaves a message on the goal, so the AI hears of it at its next call.
import { PROJECT_TALK, type Project } from "../../project.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

/** Tells the AI on the goal's own talk, or the whole project's when the goal takes no messages. */
function tell(project: Project, goalId: string, text: string): void {
  try {
    project.sendMessage(goalId, `On the dashboard I ${text}`);
  } catch {
    project.sendMessage(PROJECT_TALK, `On the dashboard I ${text}`);
  }
}

const quote = (text: string) => `"${text.length > 120 ? `${text.slice(0, 120).trimEnd()}…` : text}"`;

export const goalNoteRoutes: FeatureRoute[] = [
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/notes\/([^/]+)\/delete$/,
    header: "notes",
    async handle(ctx) {
      if (!(await ctx.body())) return;
      const project = projectOf(ctx);
      const [goalId, id] = [ctx.match[2]!, ctx.match[3]!];
      project.transaction("Removed a note", () => {
        const old = project.plan(goalId).note(id);
        if (!old) throw new Error(`No note ${id} in Goal ${goalId}.`);
        project.updateNote(goalId, id, { text: "" });
        tell(project, goalId, `removed note ${id} on goal ${goalId}: ${quote(old.text)}.`);
      });
      ctx.json(200, { deleted: id });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/notes\/([^/]+)$/,
    header: "notes",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { text, resolved } = body;
      if (text !== undefined && typeof text !== "string") throw new Error("The text must be text.");
      if (resolved !== undefined && typeof resolved !== "boolean") throw new Error("Say yes or no to dealt with.");
      if (text === undefined && resolved === undefined) throw new Error("Give the new wording or say whether it is dealt with.");
      if (text !== undefined && !text.trim()) throw new Error("Write the note first; to remove it, use Delete.");
      const project = projectOf(ctx);
      const [goalId, id] = [ctx.match[2]!, ctx.match[3]!];
      const note = project.transaction(resolved === undefined ? "Changed a note" : resolved ? "Marked a note dealt with" : "Reopened a note", () => {
        const old = project.plan(goalId).note(id);
        if (!old) throw new Error(`No note ${id} in Goal ${goalId}.`);
        const changed = project.updateNote(goalId, id, { text, resolved })!;
        if (text !== undefined && changed.text !== old.text) tell(project, goalId, `changed note ${id} on goal ${goalId} to: ${quote(changed.text)}.`);
        if (resolved !== undefined && resolved !== old.resolved)
          tell(project, goalId, resolved ? `marked note ${id} on goal ${goalId} dealt with: ${quote(changed.text)}.` : `reopened note ${id} on goal ${goalId}: ${quote(changed.text)}. It still needs dealing with.`);
        return changed;
      });
      ctx.json(200, note);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/decisions\/([^/]+)\/delete$/,
    header: "notes",
    async handle(ctx) {
      if (!(await ctx.body())) return;
      const project = projectOf(ctx);
      const [goalId, id] = [ctx.match[2]!, ctx.match[3]!];
      project.transaction("Removed a decision", () => {
        const old = project.plan(goalId).decision(id);
        if (!old) throw new Error(`No decision ${id} in Goal ${goalId}.`);
        project.editDecision(goalId, id, "");
        tell(project, goalId, `removed decision ${id} on goal ${goalId}: ${quote(old.text)}. It no longer holds.`);
      });
      ctx.json(200, { deleted: id });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/decisions\/([^/]+)$/,
    header: "notes",
    async handle(ctx) {
      const body = await ctx.body();
      if (!body) return;
      const { text } = body;
      if (typeof text !== "string" || !text.trim()) throw new Error("Write the decision first; to remove it, use Delete.");
      const project = projectOf(ctx);
      const [goalId, id] = [ctx.match[2]!, ctx.match[3]!];
      const decision = project.transaction("Changed a decision", () => {
        const changed = project.editDecision(goalId, id, text)!;
        tell(project, goalId, `changed decision ${id} on goal ${goalId} to: ${quote(changed.text)}. Follow it from now on.`);
        return changed;
      });
      ctx.json(200, decision);
    },
  },
];
