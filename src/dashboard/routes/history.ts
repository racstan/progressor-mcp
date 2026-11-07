// The plan's history on the dashboard (history.ts).
//   GET  /api/projects/:id/history                    every change kept, newest first
//   GET  /api/projects/:id/history/:entry             what one change did, file by file
//   POST /api/projects/:id/history/:entry/restore     go back to before that change (itself undoable)
import { listHistory } from "../../history.js";
import { PROJECT_TALK, type Project, type Restored } from "../../project.js";
import { readSettings } from "../../settings.js";
import type { FeatureRoute, RouteContext } from "../routes.js";

function projectOf(ctx: RouteContext): Project {
  const project = ctx.project(ctx.match[1]!);
  if (!project) throw new Error("No such project on the dashboard.");
  return project;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the AI is told when the Developer goes back on the dashboard; it reads it at its next call. */
export function restoredMessage(r: Restored): string {
  return [
    `On the dashboard I went back to before change ${r.item.id} (${r.item.label}), undoing ${plural(r.undone.length, "change")}`,
    r.files.length > 0 ? `: ${r.files.join(", ")} ${r.files.length === 1 ? "is" : "are"} as they were then.` : ".",
    " Call get_status to see where the plan stands now, and carry on from there.",
    r.entry ? ` To undo it, plan_history restore: ${r.entry.id}.` : "",
  ].join("");
}

export const historyRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/history$/,
    handle(ctx) {
      const project = projectOf(ctx);
      ctx.json(200, {
        enabled: readSettings(ctx.settingsFile, project.root).history.enabled,
        entries: listHistory(project.historyDir).reverse(),
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/([^/]+)\/history\/([^/]+)$/,
    handle(ctx) {
      const changes = projectOf(ctx).historyChanges(ctx.match[2]!);
      if (!changes) throw new Error("No such change in the plan's history.");
      ctx.json(200, changes);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/([^/]+)\/history\/([^/]+)\/restore$/,
    header: "history",
    handle(ctx) {
      const project = projectOf(ctx);
      const restored = project.transaction("Went back", () => {
        const r = project.restoreHistory(ctx.match[2]!);
        project.sendMessage(PROJECT_TALK, restoredMessage(r));
        return r;
      });
      ctx.json(200, restored);
    },
  },
];
