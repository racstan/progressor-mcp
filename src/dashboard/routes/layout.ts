// How the Developer arranged their projects: named groups and a dragged order (projectLayout.ts).
//   GET  /api/project-layout          {groups, order, groupOf}
//   POST /api/project-layout          {layout} saves it, cleaned, and tells every open page ("layout" event)
// Kept in project-layout.json beside the project list, so every browser on this computer shows the same.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type ProjectLayout, cleanLayout } from "../../projectLayout.js";
import type { FeatureRoute } from "../routes.js";

export const layoutFileFor = (registryFile: string) => join(dirname(registryFile), "project-layout.json");

export function readLayout(file: string): ProjectLayout {
  try {
    return cleanLayout(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return cleanLayout(undefined);
  }
}

function writeLayout(file: string, layout: ProjectLayout): void {
  mkdirSync(dirname(file), { recursive: true });
  const text = `${JSON.stringify(layout, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
  }
}

export const layoutRoutes: FeatureRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/project-layout$/,
    handle(ctx) {
      ctx.json(200, readLayout(layoutFileFor(ctx.registryFile)));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/project-layout$/,
    header: "layout",
    async handle(ctx) {
      const body = await ctx.body(256 * 1024);
      if (!body) return;
      if (typeof body.layout !== "object" || body.layout === null) throw new Error("Send the layout.");
      const layout = cleanLayout(body.layout);
      writeLayout(layoutFileFor(ctx.registryFile), layout);
      ctx.send("layout", layout);
      ctx.json(200, layout);
    },
  },
];
