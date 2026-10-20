import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type Dashboard, VERSION, startDashboard } from "./dashboard/http.js";
import { Project } from "./project.js";
import { createServer } from "./server.js";
import { announceServer } from "./servers.js";

// One server process serves one Agent conversation (and its sub-agents), so the
// process is the Session: it gets a fresh ID, and its pid lets other Sessions
// spot a Claim left behind by a process that crashed. The project folder is found the way the hooks
// find it: Claude Code names it in CLAUDE_PROJECT_DIR, which matters when the server is registered
// for every project rather than in the project's .mcp.json.
const project = new Project({
  root: process.env.PROGRESSOR_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
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

// The dashboard lists this process and can ask it to stop (servers.ts).
const record = announceServer(
  { kind: "session", root: project.root, session: project.session.id },
  { version: VERSION, onStop: () => releaseAndExit() },
);

let released = false;
function releaseAndExit(code = 0): void {
  if (!released) {
    released = true;
    record.close();
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
    `progressor: dashboard at ${dashboard.url}${dashboard.role === "shared" ? " (the dashboard is served by another Progressor process)" : ""}`,
  );
