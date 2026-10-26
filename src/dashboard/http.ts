// The dashboard's web server: one address (localhost:4747) for every project that runs Progressor
// (ADR 0001). Whichever Progressor process holds the port is the hub: it serves the built UI and a
// read-only JSON API for each project in the per-user registry or found in one of its Workspaces,
// reading that project's .progressor/
// markdown straight from disk, and pushes server-sent events when those files change. It binds to
// the loopback interface only.
import { existsSync, readFileSync, statSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { PROGRESSOR_DIR, Project, ROADMAP_FILE, processIsAlive } from "../project.js";
import { DEFAULT_EDITOR } from "./editor.js";
import { buildGoalGraph } from "./graph.js";
import { defaultServersDir, listServers, requestStop } from "../servers.js";
import { type SearchableProject, search } from "./search.js";
import {
  type ProjectEntry,
  type WorkspaceEntry,
  addWorkspace,
  defaultRegistryFile,
  listWorkspaces,
  pathKey,
  projectEntry,
  registerProject,
} from "./registry.js";
import { watchProgress } from "./watch.js";
import { allProjects, findProjects } from "./workspace.js";

export const DEFAULT_PORT = 4747;
const HOST = "127.0.0.1";
/** Bumped when the hub's API changes, so a hub from an older version is not shared. */
const HUB_VERSION = 2;

export interface DashboardOptions {
  /** This Session's project; it is added to the registry. Absent when only a Workspace is opened. */
  project?: Project;
  /** A folder to remember as a Workspace and open the dashboard on. */
  workspace?: string;
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
  /** How long a Workspace's scan for projects is reused before the folder is scanned again. */
  workspaceScanMs?: number;
  /** While another process serves the dashboard, how often to check it is still there and take over if not. */
  hubCheckMs?: number;
}

export interface Dashboard {
  /** Where the Developer opens this Session's project on the dashboard. */
  readonly url: string;
  /** "serving" when this process is the hub, "shared" when another Progressor process is. */
  readonly role: "serving" | "shared";
  readonly project: ProjectEntry | undefined;
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

export const VERSION: string = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

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
    // When the plan last changed, for "last update 2 min ago": the Plan File, else the Roadmap.
    const changed = (file: string) => {
      try {
        return statSync(join(project.root, file)).mtimeMs;
      } catch {
        return undefined;
      }
    };
    const planFile = project.planFilePath(goalId);
    return { ...goal, planFile, done, total, updatedAt: changed(planFile) ?? changed(roadmapFile) };
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
        context: project.context(),
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

/**
 * Whether a request that changes something comes from the dashboard's own page. Browsers always send
 * Origin on a POST, and a custom header cannot be sent from another site without a CORS preflight,
 * which the dashboard never answers, so other web pages cannot stop servers.
 */
function isFromDashboardPage(req: IncomingMessage): boolean {
  if (req.headers["x-progressor"] !== "stop") return false;
  try {
    const origin = new URL(String(req.headers.origin ?? ""));
    const port = (req.headers.host ?? "").match(/:(\d+)$/)?.[1] ?? "80";
    return ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && (origin.port || "80") === port;
  } catch {
    return false;
  }
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
  private readonly scans = new Map<string, { at: number; roots: string[] }>();
  private entries: ProjectEntry[] = [];

  constructor(
    private readonly registryFile: string,
    private readonly uiDir: string | undefined,
    private readonly editor: string,
    rescanMs: number,
    private readonly workspaceScanMs: number,
    private readonly serversDir: string,
  ) {
    this.sync();
    this.timer = setInterval(() => this.sync(), rescanMs);
    this.timer.unref();
  }

  private send(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(message);
  }

  /** A Workspace's projects, from the last scan while it is recent, so big folders are not walked on every request. */
  private scan = (root: string, force: boolean): string[] => {
    const last = this.scans.get(root);
    if (last && !force && Date.now() - last.at < this.workspaceScanMs) return last.roots;
    const roots = findProjects(root);
    this.scans.set(root, { at: Date.now(), roots });
    return roots;
  };

  /**
   * Re-reads the registry and the Workspaces: starts watching new projects and stops watching
   * vanished ones. `force` scans the Workspaces' folders again even if they were scanned recently.
   */
  sync(force = false): ProjectEntry[] {
    const entries = allProjects(this.registryFile, (root) => this.scan(root, force));
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
    // a project that moved into or out of a Workspace changes the list too
    if (!changed && JSON.stringify(entries) !== JSON.stringify(this.entries)) changed = true;
    this.entries = entries;
    if (changed) this.send("projects", entries);
    return entries;
  }

  /** Every project with its Goals' progress, for the overview page. */
  overview() {
    return this.sync().map((entry) => {
      const api = this.projects.get(entry.id)?.api;
      let goals: { id: string; title: string; status: string; done: number; total: number }[] = [];
      try {
        goals = (api?.roadmap().goals ?? []).map(({ id, title, status, done, total }) => ({ id, title, status, done, total }));
      } catch {
        // a Roadmap that cannot be read shows as a project with no Goals
      }
      return { ...entry, goals };
    });
  }

  /** Projects, Goals and Tasks matching a search, across every project, read afresh. */
  search(query: string) {
    const projects: SearchableProject[] = this.sync().map((entry) => {
      const api = this.projects.get(entry.id)?.api;
      const base = { id: entry.id, name: entry.name, root: entry.root };
      try {
        const roadmap = api!.roadmap();
        const tasksOf = (goalId: string) => {
          try {
            return (api!.goal(goalId)?.graph.nodes ?? []).flatMap((n) => (n.kind === "task" ? [{ id: n.id, title: n.title, status: n.status, summary: n.summary }] : []));
          } catch {
            return []; // a Plan File that cannot be read still lets its Goal be found
          }
        };
        return {
          ...base,
          goals: roadmap.goals.map((g) => ({ id: g.id, title: g.title, status: g.status, outcome: g.outcome, tasks: tasksOf(g.id) })),
        };
      } catch {
        return { ...base, goals: [] };
      }
    });
    return search(projects, query);
  }

  /** The running Progressor processes, with each one's project and the Goal its Session holds. */
  servers() {
    const entries = this.sync();
    return {
      hub: process.pid,
      servers: listServers(this.serversDir).map((s) => {
        const entry = entries.find((e) => pathKey(e.root) === pathKey(s.root));
        let goal: { id: string; title: string } | undefined;
        try {
          const g = s.session && this.projects.get(entry?.id ?? "")?.api.roadmap().goals.find((x) => x.claim?.session === s.session);
          if (g) goal = { id: g.id, title: g.title };
        } catch {
          // a Roadmap that cannot be read shows the server without its Goal
        }
        return { ...s, name: entry?.name ?? projectEntry(s.root).name, project: entry?.id, goal, serving: s.pid === process.pid };
      }),
    };
  }

  /** The one thing the dashboard changes: asking a running server to stop. */
  private stopServer(req: IncomingMessage, res: ServerResponse, pid: number): void {
    if (!isFromDashboardPage(req)) return json(res, 403, { error: "Servers can only be stopped from the dashboard's own page." });
    if (!requestStop(this.serversDir, pid)) return json(res, 404, { error: "No running Progressor server has that process ID." });
    return json(res, 202, { stopping: pid });
  }

  handle = (req: IncomingMessage, res: ServerResponse): void => {
    if (!isLocalHost(req)) return json(res, 403, { error: "The dashboard only answers on localhost." });
    const url = new URL(`http://localhost${req.url ?? "/"}`);
    const path = url.pathname;
    const stop = /^\/api\/servers\/(\d+)\/stop$/.exec(path);
    if (req.method === "POST" && stop) return this.stopServer(req, res, Number(stop[1]));
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "The dashboard is view-only." });
    try {
      if (path === "/api/servers") return json(res, 200, this.servers());
      if (path === "/api/search") return json(res, 200, this.search(url.searchParams.get("q") ?? ""));
      if (path === "/api/info") return json(res, 200, { app: "progressor", hub: HUB_VERSION, version: VERSION, editor: this.editor, pid: process.pid });
      if (path === "/api/projects") return json(res, 200, this.sync(url.searchParams.has("rescan")));
      if (path === "/api/workspaces") return json(res, 200, listWorkspaces(this.registryFile));
      if (path === "/api/overview") return json(res, 200, this.overview());
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
function listen(server: Server, port: number, host = HOST): Promise<"ok" | "in use" | "unavailable"> {
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
    server.listen(port, host);
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
  const { project, uiDir, editor = DEFAULT_EDITOR, attempts = 20, rescanMs = 5000, workspaceScanMs = 300_000, hubCheckMs = 5000 } = options;
  const registryFile = options.registryFile ?? defaultRegistryFile();
  const serversDir = defaultServersDir(registryFile);
  const firstPort = options.port ?? DEFAULT_PORT;
  const entry = project && registerProject(project.root, registryFile);
  const workspace: WorkspaceEntry | undefined = options.workspace ? addWorkspace(options.workspace, registryFile) : undefined;
  // The hub listens on IPv4 loopback, and on IPv6 loopback too where there is one: browsers try
  // "localhost" as ::1 first, and waiting for that to fail slowed every new connection.
  let servers: Server[] = [];
  let hub: Hub | undefined;
  let port = firstPort;
  let role: "serving" | "shared" = "shared";

  const claimPort = async (): Promise<void> => {
    for (let p = firstPort; p < firstPort + attempts; p++) {
      const http = createServer();
      const result = await listen(http, p);
      if (result === "ok") {
        hub = new Hub(registryFile, uiDir, editor, rescanMs, workspaceScanMs, serversDir);
        http.on("request", hub.handle);
        [servers, port, role] = [[http], p, "serving"];
        const ipv6 = createServer();
        if ((await listen(ipv6, p, "::1").catch(() => "unavailable")) === "ok") {
          ipv6.on("request", hub.handle);
          servers.push(ipv6);
        }
        return;
      }
      if (result === "in use" && (await isHub(p))) {
        [port, role] = [p, "shared"];
        // Tell the hub about this project now, rather than at its next rescan; a new Workspace is scanned straight away.
        await fetch(`http://${HOST}:${p}/api/projects${workspace ? "?rescan" : ""}`, { signal: AbortSignal.timeout(workspace ? 30_000 : 1500) }).catch(
          () => undefined,
        );
        return;
      }
    }
    throw new Error(`No free port for the dashboard between ${firstPort} and ${firstPort + attempts - 1}.`);
  };

  await claimPort();

  // While another process serves the dashboard, check now and then that it still does, and take
  // over when it has gone (stopped from the dashboard, or its Session ended), so the page stays up.
  let checking = false;
  const refresh = async () => {
    if (role === "serving" || checking) return;
    checking = true;
    try {
      if (!(await isHub(port))) await claimPort();
    } finally {
      checking = false;
    }
  };
  const watcher = setInterval(() => void refresh().catch(() => undefined), hubCheckMs);
  watcher.unref();

  return {
    get url() {
      const base = `http://localhost:${port}/`;
      if (entry) return `${base}?project=${encodeURIComponent(entry.id)}`;
      return workspace ? `${base}?workspace=${encodeURIComponent(workspace.id)}` : base;
    },
    get role() {
      return role;
    },
    project: entry,
    refresh,
    async close() {
      clearInterval(watcher);
      hub?.close();
      hub = undefined;
      const closing = servers;
      servers = [];
      await Promise.all(
        closing.map((s) => {
          s.closeAllConnections();
          return new Promise<void>((done) => s.close(() => done()));
        }),
      );
    },
  };
}

export type DashboardApi = ReturnType<typeof dashboardApi>;
/** `pid` is missing from hubs older than 0.3.2. */
export type InfoView = { app: "progressor"; hub: number; version: string; editor: string; pid?: number };
export type RoadmapView = ReturnType<DashboardApi["roadmap"]>;
export type GoalView = NonNullable<ReturnType<DashboardApi["goal"]>>;
export type GoalSummary = GoalView["goal"];
export type OverviewView = ReturnType<Hub["overview"]>;
export type ServersView = ReturnType<Hub["servers"]>;
export type SearchView = ReturnType<Hub["search"]>;
