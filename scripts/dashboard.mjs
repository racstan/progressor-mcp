// Serves the dashboard for one or more project folders without an MCP client, for trying the UI:
//   npm run build && node scripts/dashboard.mjs [project folder...]
// It uses the built server from dist/, so it shows exactly what the package serves. It keeps its
// own throwaway registry and port (4800 unless PROGRESSOR_PORT is set), so it never takes the real
// dashboard's place at 4747 or adds the sample project to the Developer's registry.
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startDashboard } from "../dist/dashboard/http.js";
import { registerProject } from "../dist/dashboard/registry.js";
import { Project } from "../dist/project.js";

const roots = (process.argv.length > 2 ? process.argv.slice(2) : ["test/fixtures/sample-project"]).map((r) => resolve(r));
// one fixed throwaway file, started afresh on every run
const registryFile = join(tmpdir(), "progressor-dev-projects.json");
rmSync(registryFile, { force: true });
for (const root of roots.slice(1)) registerProject(root, registryFile);
const dashboard = await startDashboard({
  project: new Project({ root: roots[0], session: { id: "s-view", pid: process.pid } }),
  registryFile,
  port: Number(process.env.PROGRESSOR_PORT || 4800),
  editor: process.env.PROGRESSOR_EDITOR || undefined,
  uiDir: fileURLToPath(new URL("../dist/ui/", import.meta.url)),
});
console.log(`Progressor dashboard for ${roots.join(", ")}: ${dashboard.url} (${dashboard.role})`);
