#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type Dashboard, startDashboard } from "./dashboard/http.js";
import { Project } from "./project.js";
import { createServer } from "./server.js";

// One server process serves one Agent conversation (and its sub-agents), so the
// process is the Session: it gets a fresh ID, and its pid lets other Sessions
// spot a Claim left behind by a process that crashed.
const project = new Project({
  root: process.env.PROGRESSOR_ROOT ?? process.cwd(),
  session: { id: `s-${randomBytes(3).toString("hex")}`, pid: process.pid },
});

// The same process serves the view-only dashboard (ADR 0001). A dashboard that cannot start never
// stops the MCP server.
let dashboard: Dashboard | undefined;
if (process.env.PROGRESSOR_DASHBOARD !== "off") {
  try {
    dashboard = await startDashboard({
      project,
      port: process.env.PROGRESSOR_PORT ? Number(process.env.PROGRESSOR_PORT) : undefined,
      editor: process.env.PROGRESSOR_EDITOR || undefined,
      uiDir: fileURLToPath(new URL("./ui/", import.meta.url)),
    });
  } catch (e) {
    console.error(`progressor: the dashboard did not start: ${(e as Error).message}`);
  }
}

let released = false;
function releaseAndExit(code = 0): void {
  if (!released) {
    released = true;
    try {
      project.releaseGoal();
    } catch (e) {
      console.error(`progressor: could not release the Claim: ${(e as Error).message}`);
    }
  }
  process.exit(code);
}

process.stdin.on("close", () => releaseAndExit());
process.on("SIGINT", () => releaseAndExit());
process.on("SIGTERM", () => releaseAndExit());
process.on("SIGHUP", () => releaseAndExit());

await createServer(project, { dashboard }).connect(new StdioServerTransport());
console.error(`progressor: serving ${project.root} as Session ${project.session.id}`);
if (dashboard)
  console.error(
    `progressor: dashboard at ${dashboard.url}${dashboard.role === "shared" ? " (served by another Session on this project)" : ""}`,
  );
