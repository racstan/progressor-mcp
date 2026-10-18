// The dashboard's web server: the built UI plus a read-only JSON API over the progress record, with
// server-sent events when files under .progressor/ change. It runs inside the MCP server process
// (ADR 0001) and binds to the loopback interface only.
import { existsSync, readFileSync, statSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { PROGRESSOR_DIR, type Project, ROADMAP_FILE, processIsAlive } from "../project.js";
import { DEFAULT_EDITOR } from "./editor.js";
import { buildGoalGraph } from "./graph.js";
import { watchProgress } from "./watch.js";

export const DEFAULT_PORT = 4747;
const HOST = "127.0.0.1";

export interface DashboardOptions {
  project: Project;
  /** The port to try first; the next ones are tried when it is taken by something else. */
  port?: number;
  /** Folder of the built UI. */
  uiDir?: string;
  /** Editor name or URL template for "Open in file" (see editor.ts). */
  editor?: string;
  /** How many ports to try before giving up. */
  attempts?: number;
}

export interface Dashboard {
  /** Where the Developer opens the dashboard, served by this process or by another Session's. */
  readonly url: string;
  /** "serving" when this process serves it, "shared" when another Session on this project does. */
  readonly role: "serving" | "shared";
  /** For a shared dashboard: if the Session serving it has gone, start serving it here. */
  refresh(): Promise<void>;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

const VERSION: string = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

const sameFolder = (a: string, b: string) => {
  const norm = (p: string) => resolve(p).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

/** The JSON views the page reads. Each call re-reads the markdown, which is the source of truth. */
export function dashboardApi(project: Project, editor: string) {
  const roadmapFile = `${PROGRESSOR_DIR}/${ROADMAP_FILE}`;
  const goalSummary = (goalId: string) => {
    const goal = project.roadmap().goal(goalId);
    if (!goal) return undefined;
    let done = 0;
    let total = 0;
    try {
      const live = project.plan(goalId).tasks.filter((t) => t.status !== "dropped");
      done = live.filter((t) => t.status === "done").length;
      total = live.length;
    } catch {
      // A Goal whose Plan File is missing or unreadable still shows, with no progress.
    }
    return { ...goal, planFile: project.planFilePath(goalId), done, total };
  };
  return {
    info: () => ({ app: "progressor", version: VERSION, root: project.root, name: basename(resolve(project.root)), editor }),
    roadmap: () => {
      const roadmap = project.roadmap();
      return {
        file: roadmapFile,
        goals: roadmap.goals.map((g) => goalSummary(g.id)!),
        sessions: roadmap.goals
          .filter((g) => g.claim && g.status === "active")
          .map((g) => {
            const { session, pid } = g.claim!;
            // A Claim whose process has died is stale: the next Session to claim the Goal takes it over.
            return { session, pid, goal: g.id, running: pid === undefined || processIsAlive(pid) };
          }),
        ideas: roadmap.ideas,
        standingInstructions: roadmap.standingInstructions,
      };
    },
    goal: (goalId: string) => {
      const goal = goalSummary(goalId);
      return goal ? { goal, graph: buildGoalGraph(project.plan(goalId)) } : undefined;
    },
    item: (ref: string) => project.getItem(ref),
  };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/** Only answer requests addressed to the loopback host, so other web pages cannot read the record through DNS rebinding. */
function isLocalHost(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function createHandler(project: Project, uiDir: string | undefined, editor: string, clients: Set<ServerResponse>) {
  const api = dashboardApi(project, editor);
  return (req: IncomingMessage, res: ServerResponse) => {
    if (!isLocalHost(req)) return json(res, 403, { error: "The dashboard only answers on localhost." });
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "The dashboard is view-only." });
    const url = new URL(`http://localhost${req.url ?? "/"}`);
    const path = url.pathname;
    try {
      if (path === "/api/info") return json(res, 200, api.info());
      if (path === "/api/roadmap") return json(res, 200, api.roadmap());
      if (path.startsWith("/api/goals/")) {
        const found = api.goal(decodeURIComponent(path.slice("/api/goals/".length)));
        return found ? json(res, 200, found) : json(res, 404, { error: "No such Goal." });
      }
      if (path === "/api/item") {
        try {
          return json(res, 200, api.item(url.searchParams.get("ref") ?? ""));
        } catch (e) {
          return json(res, 404, { error: (e as Error).message });
        }
      }
      if (path === "/api/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        res.write("retry: 2000\n: connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (path.startsWith("/api/")) return json(res, 404, { error: "No such endpoint." });
      return serveStatic(res, uiDir, path);
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  };
}

function serveStatic(res: ServerResponse, uiDir: string | undefined, path: string): void {
  if (!uiDir || !existsSync(join(uiDir, "index.html"))) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("The dashboard UI is not built. Run `npm run build`.");
    return;
  }
  const base = resolve(uiDir);
  let file = resolve(base, `.${normalize(decodeURIComponent(path))}`);
  if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) file = join(base, "index.html");
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  res.end(readFileSync(file));
}

/** Listens on a port: "ok", "in use" (something may be serving there) or "unavailable" (reserved). */
function listen(server: Server, port: number): Promise<"ok" | "in use" | "unavailable"> {
  return new Promise((done, fail) => {
    const onError = (e: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      if (e.code === "EADDRINUSE") done("in use");
      else if (e.code === "EACCES") done("unavailable");
      else fail(e);
    };
    const onListening = () => {
      server.off("error", onError);
      done("ok");
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, HOST);
  });
}

/** Asks whatever listens on a port whether it is Progressor's dashboard, and for which project. */
async function probe(port: number): Promise<{ root: string } | undefined> {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/info`, { signal: AbortSignal.timeout(1500) });
    const info = (await res.json()) as { app?: string; root?: string };
    return info.app === "progressor" && typeof info.root === "string" ? { root: info.root } : undefined;
  } catch {
    return undefined;
  }
}

const urlOf = (port: number) => `http://localhost:${port}/`;

/**
 * Starts the dashboard for a project. The first Session to start serves it; a Session that finds
 * the project already served shares that URL instead. A port held by anything else (another
 * project's dashboard, an unrelated program) is skipped for the next one.
 */
export async function startDashboard(options: DashboardOptions): Promise<Dashboard> {
  const { project, uiDir, editor = DEFAULT_EDITOR, attempts = 20 } = options;
  const firstPort = options.port ?? DEFAULT_PORT;
  const clients = new Set<ServerResponse>();
  let server: Server | undefined;
  let stopWatching: (() => void) | undefined;
  let port = firstPort;
  let role: "serving" | "shared" = "shared";

  const broadcast = (files: string[]) => {
    const data = `event: change\ndata: ${JSON.stringify({ files })}\n\n`;
    for (const c of clients) c.write(data);
  };

  const claimPort = async (): Promise<void> => {
    for (let p = firstPort; p < firstPort + attempts; p++) {
      const candidate = createServer(createHandler(project, uiDir, editor, clients));
      const result = await listen(candidate, p);
      if (result === "ok") {
        server = candidate;
        port = p;
        role = "serving";
        stopWatching = watchProgress(project.root, broadcast);
        return;
      }
      const other = result === "in use" ? await probe(p) : undefined;
      if (other && sameFolder(other.root, project.root)) {
        port = p;
        role = "shared";
        return;
      }
    }
    throw new Error(`No free port for the dashboard between ${firstPort} and ${firstPort + attempts - 1}.`);
  };

  await claimPort();

  return {
    get url() {
      return urlOf(port);
    },
    get role() {
      return role;
    },
    async refresh() {
      if (role === "serving") return;
      const other = await probe(port);
      if (!other || !sameFolder(other.root, project.root)) await claimPort();
    },
    async close() {
      stopWatching?.();
      for (const c of clients) c.end();
      clients.clear();
      if (server) {
        const s = server;
        server = undefined;
        s.closeAllConnections();
        await new Promise<void>((done) => s.close(() => done()));
      }
    },
  };
}

export type DashboardApi = ReturnType<typeof dashboardApi>;
export type InfoView = ReturnType<DashboardApi["info"]>;
export type RoadmapView = ReturnType<DashboardApi["roadmap"]>;
export type GoalView = NonNullable<ReturnType<DashboardApi["goal"]>>;
export type GoalSummary = GoalView["goal"];
