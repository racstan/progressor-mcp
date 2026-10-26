import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type Dashboard, VERSION, startDashboard } from "./dashboard/http.js";
import { Project } from "./project.js";
import { chooseRoot } from "./root.js";
import { appRoots, createServer } from "./server.js";
import { announceServer, defaultServersDir, sessionOfProcess } from "./servers.js";
import { endWithApp } from "./lifecycle.js";

// One server process serves one Agent conversation (and its sub-agents), so the
// process is the Session: it gets a fresh ID, and its pid lets other Sessions
// spot a Claim left behind by a process that crashed. The running servers' records
// tell a Claim whose pid was reused by another Progressor Session from a live one.
const serversDir = defaultServersDir();
const project = new Project({
  root: chooseRoot({ env: process.env, roots: undefined, cwd: process.cwd() }),
  session: { id: `s-${randomBytes(3).toString("hex")}`, pid: process.pid },
  sessionOf: (pid) => sessionOfProcess(serversDir, pid),
});

// The dashboard starts once the project folder is settled, below; get_status reads it from here.
let dashboard: Dashboard | undefined;
const server = createServer(project, {
  dashboard: {
    get url() {
      return dashboard?.url;
    },
    get notice() {
      return dashboard?.notice;
    },
    refresh: async () => dashboard?.refresh(),
  },
});

// When the app goes away (or the dashboard's Stop button is pressed), release this Session's Goals,
// drop its record and exit, which frees the dashboard's port for the next Progressor (lifecycle.ts).
let record: { close(): void } | undefined;
const releaseAndExit = endWithApp(() => {
  record?.close();
  project.releaseAll();
});
// The MCP connection can also close by itself, such as when the app sends something unreadable;
// stdin is then paused and would never say that the app has gone.
server.server.onclose = () => releaseAndExit();

// An app that starts Progressor for every project may start it outside the project, so once it
// has connected, ask which folder it has open (MCP roots). Apps that don't say keep the folder
// chosen above.
const connected = new Promise<void>((resolve) => {
  server.server.oninitialized = () => resolve();
});
await server.connect(new StdioServerTransport());
await Promise.race([connected, new Promise((r) => setTimeout(r, 3000))]);
if (!process.env.PROGRESSOR_ROOT) {
  const roots = await appRoots(server, 3000);
  if (roots) project.moveTo(chooseRoot({ env: process.env, roots, cwd: process.cwd() }));
}
console.error(`progressor: serving ${project.root} as Session ${project.session.id}`);

// The same process serves the view-only dashboard (ADR 0001). A dashboard that cannot start never
// stops the MCP server.
if (process.env.PROGRESSOR_DASHBOARD !== "off") {
  try {
    dashboard = await startDashboard({
      project,
      port: process.env.PROGRESSOR_PORT ? Number(process.env.PROGRESSOR_PORT) : undefined,
      editor: process.env.PROGRESSOR_EDITOR || undefined,
      uiDir: fileURLToPath(new URL("./ui/", import.meta.url)),
    });
    console.error(
      `progressor: dashboard at ${dashboard.url}${dashboard.role === "shared" ? " (the dashboard is served by another Progressor process)" : ""}`,
    );
    if (dashboard.notice) console.error(`progressor: ${dashboard.notice}`);
  } catch (e) {
    console.error(`progressor: the dashboard did not start: ${(e as Error).message}`);
  }
}

// The dashboard lists this process and can ask it to stop (servers.ts).
record = announceServer(
  { kind: "session", root: project.root, session: project.session.id },
  { version: VERSION, onStop: () => releaseAndExit() },
);
