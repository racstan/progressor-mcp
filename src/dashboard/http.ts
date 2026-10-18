// The dashboard's web server: one address (localhost:4747) for every project that runs Progressor
// (ADR 0001). Whichever Progressor process holds the port is the hub: it serves the built UI and a
// read-only JSON API for each project in the per-user registry, reading that project's .progressor/
// markdown straight from disk, and pushes server-sent events when those files change. It binds to
// the loopback interface only.
import { existsSync, readFileSync, statSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { PROGRESSOR_DIR, Project, ROADMAP_FILE, processIsAlive } from "../project.js";
import { DEFAULT_EDITOR } from "./editor.js";
import { buildGoalGraph } from "./graph.js";
import { type ProjectEntry, defaultRegistryFile, listProjects, registerProject } from "./registry.js";
import { watchProgress } from "./watch.js";

export const DEFAULT_PORT = 4747;
const HOST = "127.0.0.1";
/** Bumped when the hub's API changes, so a hub from an older version is not shared. */
const HUB_VERSION = 1;

export interface DashboardOptions {
  /** This Session's project; it is added to the registry. */
  project: Project;
  /** The registry of projects; `~/.progressor/projects.json` unless set (see registry.ts). */
  registryFile?: string;
  /** The port to try first; the next ones are tried when it is taken by something else. */
  port?: number;
  /** Folder of the built UI. */
  uiDir?: string;
  /** Editor name or URL template for "Open in file" (see editor.ts). */
  editor?: string;
  /** How many ports to try before giving up. */
  attempts?: number;
  /** How often the hub re-reads the registry, for projects it was not told about. */
  rescanMs?: number;
}

export interface Dashboard {
  /** Where the Developer opens this Session's project on the dashboard. */
  readonly url: string;
  /** "serving" when this process is the hub, "shared" when another Progressor process is. */
  readonly role: "serving" | "shared";
  readonly project: ProjectEntry;
  /** If the hub has gone, become the hub. */
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

/** The JSON views of one project. Each call re-reads the markdown, which is the source of truth. */
export function dashboardApi(project: Project) {
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
    roadmap: () => {
      const roadmap = project.roadmap();
      return {
        root: project.root,
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

/** The hub: serves every registered project, and watches each one's .progressor/ folder. */
class Hub {
  private readonly clients = new Set<ServerResponse>();
  private readonly projects = new Map<string, { api: ReturnType<typeof dashboardApi>; stop: () => void }>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly registryFile: string,
    private readonly uiDir: string | undefined,
    private readonly editor: string,
    rescanMs: number,
  ) {
    this.sync();
    this.timer = setInterval(() => this.sync(), rescanMs);
    this.timer.unref();
  }

  private send(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(message);
  }

  /** Re-reads the registry: starts watching new projects and stops watching vanished ones. */
  sync(): ProjectEntry[] {
    const entries = listProjects(this.registryFile);
    let changed = false;
    for (const [id, p] of this.projects)
      if (!entries.some((e) => e.id === id)) {
        p.stop();
        this.projects.delete(id);
        changed = true;
      }
    for (const entry of entries)
      if (!this.projects.has(entry.id)) {
        const project = new Project({ root: entry.root, session: { id: "dashboard", pid: process.pid } });
        const stop = watchProgress(entry.root, (files) => this.send("change", { project: entry.id, files }));
        this.projects.set(entry.id, { api: dashboardApi(project), stop });
        changed = true;
      }
    if (changed) this.send("projects", entries);
    return entries;
  }

  handle = (req: IncomingMessage, res: ServerResponse): void => {
    if (!isLocalHost(req)) return json(res, 403, { error: "The dashboard only answers on localhost." });
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "The dashboard is view-only." });
    const url = new URL(`http://localhost${req.url ?? "/"}`);
    const path = url.pathname;
    try {
      if (path === "/api/info") return json(res, 200, { app: "progressor", hub: HUB_VERSION, version: VERSION, editor: this.editor });
      if (path === "/api/projects") return json(res, 200, this.sync());
      if (path === "/api/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        res.write("retry: 2000\n: connected\n\n");
        this.clients.add(res);
        req.on("close", () => this.clients.delete(res));
        return;
      }
      const m = /^\/api\/projects\/([^/]+)\/(roadmap|goals\/([^/]+)|item)$/.exec(path);
      if (m) {
        const id = decodeURIComponent(m[1]!);
        if (!this.projects.has(id)) this.sync();
        const api = this.projects.get(id)?.api;
        if (!api) return json(res, 404, { error: "No such project on the dashboard." });
        if (m[2] === "roadmap") return json(res, 200, api.roadmap());
        if (m[2] === "item") {
          try {
            return json(res, 200, api.item(url.searchParams.get("ref") ?? ""));
          } catch (e) {
            return json(res, 404, { error: (e as Error).message });
          }
        }
        const found = api.goal(decodeURIComponent(m[3]!));
        return found ? json(res, 200, found) : json(res, 404, { error: "No such Goal." });
      }
      if (path.startsWith("/api/")) return json(res, 404, { error: "No such endpoint." });
      return serveStatic(res, this.uiDir, path);
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  };

  close(): void {
    clearInterval(this.timer);
    for (const p of this.projects.values()) p.stop();
    this.projects.clear();
    for (const c of this.clients) c.end();
    this.clients.clear();
  }
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

/** Whether a port is held by a Progressor hub this version can share. */
async function isHub(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/info`, { signal: AbortSignal.timeout(1500) });
    const info = (await res.json()) as { app?: string; hub?: number };
    return info.app === "progressor" && info.hub === HUB_VERSION;
  } catch {
    return false;
  }
}

/**
 * Joins the dashboard: registers this Session's project and serves every registered project from
 * the first free port starting at 4747, or, when a Progressor hub already holds it, shares that.
 * Ports held by anything else are skipped for the next one.
 */
export async function startDashboard(options: DashboardOptions): Promise<Dashboard> {
  const { project, uiDir, editor = DEFAULT_EDITOR, attempts = 20, rescanMs = 5000 } = options;
  const registryFile = options.registryFile ?? defaultRegistryFile();
  const firstPort = options.port ?? DEFAULT_PORT;
  const entry = registerProject(project.root, registryFile);
  let server: Server | undefined;
  let hub: Hub | undefined;
  let port = firstPort;
  let role: "serving" | "shared" = "shared";

  const claimPort = async (): Promise<void> => {
    for (let p = firstPort; p < firstPort + attempts; p++) {
      const http = createServer();
      const result = await listen(http, p);
      if (result === "ok") {
        hub = new Hub(registryFile, uiDir, editor, rescanMs);
        http.on("request", hub.handle);
        [server, port, role] = [http, p, "serving"];
        return;
      }
      if (result === "in use" && (await isHub(p))) {
        [port, role] = [p, "shared"];
        // Tell the hub about this project now, rather than at its next rescan.
        await fetch(`http://${HOST}:${p}/api/projects`, { signal: AbortSignal.timeout(1500) }).catch(() => undefined);
        return;
      }
    }
    throw new Error(`No free port for the dashboard between ${firstPort} and ${firstPort + attempts - 1}.`);
  };

  await claimPort();

  return {
    get url() {
      return `http://localhost:${port}/?project=${encodeURIComponent(entry.id)}`;
    },
    get role() {
      return role;
    },
    project: entry,
    async refresh() {
      if (role === "serving") return;
      if (!(await isHub(port))) await claimPort();
    },
    async close() {
      hub?.close();
      hub = undefined;
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
export type InfoView = { app: "progressor"; hub: number; version: string; editor: string };
export type RoadmapView = ReturnType<DashboardApi["roadmap"]>;
export type GoalView = NonNullable<ReturnType<DashboardApi["goal"]>>;
export type GoalSummary = GoalView["goal"];
