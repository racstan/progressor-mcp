// Serves the dashboard for a project folder without an MCP client, for trying the UI:
//   npm run build && node scripts/dashboard.mjs [project folder]
// It reads the built server from dist/, so it shows exactly what the package serves.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startDashboard } from "../dist/dashboard/http.js";
import { Project } from "../dist/project.js";

const root = resolve(process.argv[2] ?? "test/fixtures/sample-project");
const project = new Project({ root, session: { id: "s-view", pid: process.pid } });
const dashboard = await startDashboard({
  project,
  port: process.env.PROGRESSOR_PORT ? Number(process.env.PROGRESSOR_PORT) : undefined,
  editor: process.env.PROGRESSOR_EDITOR || undefined,
  uiDir: fileURLToPath(new URL("../dist/ui/", import.meta.url)),
});
console.log(`Progressor dashboard for ${root}: ${dashboard.url} (${dashboard.role})`);
