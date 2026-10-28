// The dashboard's web server: one address (localhost:4747) for every project that runs Progressor
// (ADR 0001). Whichever Progressor process holds the port is the hub: it serves the built UI and a
// JSON API for each project in the per-user registry or found in one of its Workspaces,
// reading that project's .progressor/
// markdown straight from disk, and pushes server-sent events when those files change. It binds to
// the loopback interface only. The Developer can change two things there, and nothing else: stop a
// running Progressor server, and mark a hand test on a Goal (ADR 0004).
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { type Origin, latestOrigin } from "../origin.js";
import type { Decision, HandResult, HandTest, Message, Note, Question, TaskStatus } from "../planFile.js";
import { withLock } from "../lock.js";
import { PROGRESSOR_DIR, PROJECT_TALK, Project, ROADMAP_FILE, claimMayBeLive, processIsAlive } from "../project.js";
import { DEFAULT_EDITOR } from "./editor.js";
import { buildGoalGraph } from "./graph.js";
import { defaultServersDir, listServers, requestStop, sessionOfProcess } from "../servers.js";
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
const HUB_VERSION = 5;

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
  /** Why the dashboard is not on the port asked for, when an older Progressor still holds it. */
  readonly notice: string | undefined;
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

/**
 * The JSON views of one project. Each call re-reads the markdown, which is the source of truth.
 * `sessionOf` names the Session a running process has announced, to spot a Claim whose pid was reused.
 */
export function dashboardApi(project: Project, sessionOf?: (pid: number) => string | undefined) {
  const roadmapFile = `${PROGRESSOR_DIR}/${ROADMAP_FILE}`;
  const goalSummary = (goalId: string) => {
    const goal = project.roadmap().goal(goalId);
    if (!goal) return undefined;
    let done = 0;
    let total = 0;
    // How many of the Goal's Tasks are in each state.
    const counts: Record<TaskStatus, number> = {
      pending: 0,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 0,
      checked: 0,
      done: 0,
      released: 0,
      dropped: 0,
    };
    // The latest change an AI chat in another project made to the Goal, its Tasks, decisions or notes.
    let fromElsewhere: Origin | undefined = goal.updatedFrom;
    let openQuestions = 0;
    let untriedTests = 0;
    try {
      const plan = project.plan(goalId);
      for (const t of plan.tasks) counts[t.status]++;
      untriedTests = plan.handTests.filter((h) => h.result === "pending").length;
      openQuestions = project.talk(goalId).questions.filter((q) => q.state === "open").length;
      fromElsewhere = latestOrigin([goal.updatedFrom, ...[...plan.tasks, ...plan.decisions, ...plan.notes].map((i) => i.updatedFrom)]);
      done = counts.done + counts.released;
      total = Object.values(counts).reduce((a, b) => a + b, 0) - counts.dropped;
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
    // A Goal with a Task waiting on the Developer, a question for them or something to try by hand waits on them.
    const waitingSteps = counts["waiting on you"];
    const waitingOnYou = waitingSteps > 0 || openQuestions > 0 || untriedTests > 0;
    return { ...goal, planFile, done, total, counts, waitingOnYou, openQuestions, untriedTests, waitingSteps, updatedAt: changed(planFile) ?? changed(roadmapFile), fromElsewhere };
  };
  return {
    roadmap: () => {
      const roadmap = project.roadmap();
      const projectTalkMessages = (): Message[] => {
        try {
          return project.talk(PROJECT_TALK).messages;
        } catch {
          return [];
        }
      };
      return {
        root: project.root,
        file: roadmapFile,
        goals: roadmap.goals.map((g) => goalSummary(g.id)!),
        sessions: roadmap.goals
          .filter((g) => g.claim && g.status === "active")
          .map((g) => {
            const { session, pid } = g.claim!;
            // A Claim whose process has died, or now runs another Session, is stale: the next Session
            // to read the plan clears it. The dashboard only shows what the files say.
            return { session, pid, goal: g.id, running: claimMayBeLive(g.claim!, { isAlive: processIsAlive, sessionOf }) };
          }),
        ideas: roadmap.ideas,
        standingInstructions: roadmap.standingInstructions,
        context: project.context(),
        // What runs now, what comes next and when each open Goal should be done (schedule.ts).
        schedule: project.schedule(),
        // Shared resources in use right now (resources.ts); runtime state, not part of the plan.
        resources: project.resources(sessionOf).list(),
        // The Developer's messages to the whole project and the AI's replies (talk/_project.md).
        projectTalk: { messages: projectTalkMessages() },
      };
    },
    /** `projectId` is the project's ID on the dashboard, which a picture's address needs. */
    goal: (goalId: string, projectId = "") => {
      const goal = goalSummary(goalId);
      if (!goal) return undefined;
      const plan = project.plan(goalId);
      const decisions: Decision[] = plan.decisions;
      const notes: Note[] = plan.notes;
      const handTests: HandTest[] = plan.handTests;
      const talk = project.talk(goalId);
      const messages: Message[] = talk.messages;
      const questions: Question[] = talk.questions;
      // Each picture comes with the address the page loads it from (served by the hub below); the
      // time it was added is in it, so a new picture that reuses a removed one's name is not cached.
      const pictures = project.pictures(goalId).map((p) => ({ ...p, url: `/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goalId)}/pictures/${encodeURIComponent(p.file)}?v=${encodeURIComponent(p.addedAt)}` }));
      return { goal, graph: buildGoalGraph(plan), decisions, notes, handTests, messages, questions, pictures };
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
function isFromDashboardPage(req: IncomingMessage, header: "stop" | "mark" | "talk"): boolean {
  if (req.headers["x-progressor"] !== header) return false;
  try {
    const origin = new URL(String(req.headers.origin ?? ""));
    const port = (req.headers.host ?? "").match(/:(\d+)$/)?.[1] ?? "80";
    return ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && (origin.port || "80") === port;
  } catch {
    return false;
  }
}

/** What the Developer may send as a mark: a result, or "clear" to undo it. */
const MARKS: Record<string, HandResult> = { works: "works", "doesn't work": "doesn't work", "won't test": "won't test", clear: "pending" };
/** A mark is a few words and a short note, so a bigger body is refused unread. */
const MAX_MARK_BODY = 4096;
/** A message is at most MAX_MESSAGE characters, which JSON can make a few times bigger. */
const MAX_TALK_BODY = 16_384;

/** Reads a request body as text, or undefined when it is bigger than the limit. */
function readBody(req: IncomingMessage, limit: number): Promise<string | undefined> {
  return new Promise((done) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) done(undefined); // the rest is read and dropped
      else chunks.push(c);
    });
    req.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => done(undefined));
  });
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

/** Sends a stored picture or recording, with Range support so a video can be skipped through. */
function servePicture(req: IncomingMessage, res: ServerResponse, file: { path: string; mime: string }): void {
  const size = statSync(file.path).size;
  const headers = { "content-type": file.mime, "x-content-type-options": "nosniff", "cache-control": "no-cache", "accept-ranges": "bytes" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  let start = 0;
  let end = size - 1;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(end, Number(range[2]));
    } else {
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      res.writeHead(416, { ...headers, "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
  } else res.writeHead(200, { ...headers, "content-length": size });
  if (req.method === "HEAD") return void res.end();
  createReadStream(file.path, { start, end }).on("error", () => res.destroy()).pipe(res);
}

/** The hub: serves every registered project, and watches each one's .progressor/ folder. */
class Hub {
  private readonly clients = new Set<ServerResponse>();
  private readonly projects = new Map<string, { api: ReturnType<typeof dashboardApi>; project: Project; stop: () => void }>();
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
    /** Called once a newer Progressor has asked this hub to hand the port over. */
    private readonly onStepDown: () => void,
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
        // The dashboard is not a Session: it never changes the plan, not even to clear stale Claims.
        const project = new Project({ root: entry.root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false });
        const stop = watchProgress(entry.root, (files) => this.send("change", { project: entry.id, files }));
        this.projects.set(entry.id, { api: dashboardApi(project, (pid) => sessionOfProcess(this.serversDir, pid)), project, stop });
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
      let goals: {
        id: string;
        title: string;
        status: string;
        done: number;
        total: number;
        waitingOnYou: boolean;
        openQuestions: number;
        untriedTests: number;
        waitingSteps: number;
        updatedAt: number | undefined;
      }[] = [];
      try {
        goals = (api?.roadmap().goals ?? []).map(({ id, title, status, done, total, waitingOnYou, openQuestions, untriedTests, waitingSteps, updatedAt }) => ({
          id,
          title,
          status,
          done,
          total,
          waitingOnYou,
          openQuestions,
          untriedTests,
          waitingSteps,
          updatedAt,
        }));
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
        // A Session can hold several Goals at once: `goals` has them all, `goal` the first.
        let goals: { id: string; title: string }[] = [];
        try {
          const held = s.session ? (this.projects.get(entry?.id ?? "")?.api.roadmap().goals.filter((x) => x.claim?.session === s.session) ?? []) : [];
          goals = held.map((g) => ({ id: g.id, title: g.title }));
        } catch {
          // a Roadmap that cannot be read shows the server without its Goals
        }
        return { ...s, name: entry?.name ?? projectEntry(s.root).name, project: entry?.id, goal: goals[0], goals, serving: s.pid === process.pid };
      }),
    };
  }

  /** The one thing the dashboard changes: asking a running server to stop. */
  private stopServer(req: IncomingMessage, res: ServerResponse, pid: number): void {
    if (!isFromDashboardPage(req, "stop")) return json(res, 403, { error: "Servers can only be stopped from the dashboard's own page." });
    if (!requestStop(this.serversDir, pid)) return json(res, 404, { error: "No running Progressor server has that process ID." });
    return json(res, 202, { stopping: pid });
  }

  /**
   * The Developer's mark on a hand test: works, doesn't work (with a note), won't test, or clear to
   * undo. It is written through the same code the Agent's tools use, holding the plan's lock, and
   * only for this page: the custom header and the page's own Origin keep other web pages out.
   */
  private async markHandTest(req: IncomingMessage, res: ServerResponse, projectId: string, goalId: string, itemId: string): Promise<void> {
    if (!isFromDashboardPage(req, "mark")) return json(res, 403, { error: "Hand tests can only be marked from the dashboard's own page." });
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return json(res, 415, { error: "Send the mark as JSON." });
    if (!this.projects.has(projectId)) this.sync();
    const project = this.projects.get(projectId)?.project;
    if (!project) return json(res, 404, { error: "No such project on the dashboard." });
    const text = await readBody(req, MAX_MARK_BODY);
    if (text === undefined) {
      res.once("finish", () => req.destroy());
      return json(res, 413, { error: "That mark is too big." });
    }
    let body: { mark?: unknown; note?: unknown };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return json(res, 400, { error: "The mark is not valid JSON." });
    }
    const result = typeof body.mark === "string" ? MARKS[body.mark] : undefined;
    if (!result) return json(res, 400, { error: `The mark must be one of: ${Object.keys(MARKS).join(", ")}.` });
    if (body.note !== undefined && typeof body.note !== "string") return json(res, 400, { error: "The note must be text." });
    try {
      const test = withLock(project.root, () => project.markHandTest(goalId, itemId, result, body.note as string | undefined));
      return json(res, 200, test);
    } catch (e) {
      const message = (e as Error).message;
      return json(res, /^No (Goal|hand test)/.test(message) ? 404 : 400, { error: message });
    }
  }

  /**
   * Reads a JSON body the dashboard's own page sent with the given header, for the project named;
   * answers the request itself and gives undefined when anything is wrong.
   */
  private async guardedBody(req: IncomingMessage, res: ServerResponse, header: "talk", projectId: string, limit: number) {
    if (!isFromDashboardPage(req, header)) return void json(res, 403, { error: "This can only be sent from the dashboard's own page." });
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return void json(res, 415, { error: "Send it as JSON." });
    if (!this.projects.has(projectId)) this.sync();
    const project = this.projects.get(projectId)?.project;
    if (!project) return void json(res, 404, { error: "No such project on the dashboard." });
    const text = await readBody(req, limit);
    if (text === undefined) {
      res.once("finish", () => req.destroy());
      return void json(res, 413, { error: "That is too long." });
    }
    try {
      const body = JSON.parse(text) as unknown;
      if (body && typeof body === "object") return { project, body: body as Record<string, unknown> };
    } catch {
      // answered below
    }
    return void json(res, 400, { error: "That is not valid JSON." });
  }

  /**
   * The Developer talking to their AI: send a message, take back one the AI has not seen, or answer
   * one of its questions. Written under the plan's lock through the same code the tools use.
   */
  private async talk(req: IncomingMessage, res: ServerResponse, projectId: string, goalId: string, action: string): Promise<void> {
    const got = await this.guardedBody(req, res, "talk", projectId, MAX_TALK_BODY);
    if (!got) return;
    const { project, body } = got;
    const words = (key: string) => {
      const v = body[key];
      if (typeof v !== "string" || !v.trim()) throw new Error(`Write the ${key === "text" ? "message" : key} first.`);
      return v;
    };
    try {
      const answer = withLock(project.root, () => {
        if (action === "messages") return { status: 201, body: project.sendMessage(goalId, words("text")) };
        const del = /^messages\/([^/]+)\/delete$/.exec(action);
        if (del) {
          project.deleteMessage(goalId, del[1]!);
          return { status: 200, body: { deleted: del[1] } };
        }
        const ans = /^questions\/([^/]+)\/answer$/.exec(action);
        if (ans) return { status: 200, body: project.answerQuestion(goalId, ans[1]!, words("answer")) };
        return { status: 404, body: { error: "Nothing to do here." } };
      });
      return json(res, answer.status, answer.body);
    } catch (e) {
      const message = (e as Error).message;
      return json(res, /^No /.test(message) ? 404 : /already|withdrawn/.test(message) ? 409 : 400, { error: message });
    }
  }

  /**
   * A newer Progressor asks for the port, so the dashboard is served by the newest version. Only
   * the serving stops: this process's Session goes on, and it shares the newer hub from then on.
   * Browsers always send Origin on a POST, and cannot send the custom header to another site
   * without a CORS preflight, which is never answered, so web pages cannot ask.
   */
  private stepDown(req: IncomingMessage, res: ServerResponse): void {
    if (req.headers["x-progressor"] !== "step-down" || req.headers.origin !== undefined)
      return json(res, 403, { error: "Only another Progressor can ask the dashboard to step down." });
    if (!(Number(req.headers["x-progressor-hub"]) > HUB_VERSION))
      return json(res, 409, { error: "Only a newer Progressor can take the dashboard over." });
    res.once("finish", () => this.onStepDown());
    return json(res, 202, { steppingDown: process.pid });
  }

  handle = (req: IncomingMessage, res: ServerResponse): void => {
    if (!isLocalHost(req)) return json(res, 403, { error: "The dashboard only answers on localhost." });
    const url = new URL(`http://localhost${req.url ?? "/"}`);
    const path = url.pathname;
    const stop = /^\/api\/servers\/(\d+)\/stop$/.exec(path);
    if (req.method === "POST" && stop) return this.stopServer(req, res, Number(stop[1]));
    if (req.method === "POST" && path === "/api/hub/step-down") return this.stepDown(req, res);
    const talk = /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/((?:messages|questions)(?:\/[^/]+\/(?:delete|answer))?)$/.exec(path);
    if (req.method === "POST" && talk) return void this.talk(req, res, decodeURIComponent(talk[1]!), decodeURIComponent(talk[2]!), talk[3]!);
    const mark = /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/hand-tests\/([^/]+)$/.exec(path);
    if (req.method === "POST" && mark)
      return void this.markHandTest(req, res, decodeURIComponent(mark[1]!), decodeURIComponent(mark[2]!), decodeURIComponent(mark[3]!));
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "The dashboard only shows the plan; it changes nothing else." });
    try {
      if (path === "/api/servers") return json(res, 200, this.servers());
      if (path === "/api/search") return json(res, 200, this.search(url.searchParams.get("q") ?? ""));
      if (path === "/api/info")
        return json(res, 200, { app: "progressor", hub: HUB_VERSION, version: VERSION, editor: this.editor, pid: process.pid, stepDown: true });
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
      const pic = /^\/api\/projects\/([^/]+)\/goals\/([^/]+)\/pictures\/([^/]+)$/.exec(path);
      if (pic) {
        if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Pictures can only be read." });
        const id = decodeURIComponent(pic[1]!);
        if (!this.projects.has(id)) this.sync();
        let file: { path: string; mime: string } | undefined;
        try {
          file = this.projects.get(id)?.project.pictureFile(decodeURIComponent(pic[2]!), decodeURIComponent(pic[3]!));
        } catch {
          file = undefined;
        }
        return file ? servePicture(req, res, file) : json(res, 404, { error: "No such picture." });
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
        const found = api.goal(decodeURIComponent(m[3]!), id);
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

/** What /api/info says about the Progressor hub on a port. */
interface HubInfo {
  app?: string;
  hub?: number;
  version?: string;
  pid?: number;
  /** Whether the hub hands the port over when a newer Progressor asks (from hub version 3). */
  stepDown?: boolean;
}

/**
 * Asks whatever holds a port what it is: its /api/info, null when it answered but is not a
 * Progressor dashboard, or undefined when it did not answer. A hub that is busy (scanning a big
 * Workspace, say) gets a second, longer chance, so it is not mistaken for something else.
 */
async function hubInfo(port: number): Promise<HubInfo | null | undefined> {
  for (const timeout of [1500, 5000]) {
    let res: Response;
    try {
      res = await fetch(`http://${HOST}:${port}/api/info`, { signal: AbortSignal.timeout(timeout) });
    } catch {
      continue;
    }
    try {
      const info = (await res.json()) as HubInfo;
      return info && typeof info === "object" && info.app === "progressor" ? info : null;
    } catch {
      return null;
    }
  }
  return undefined;
}

/** A hub this version can share: the same version, or a newer one, which serves its own page. */
const canShare = (info: HubInfo | null | undefined): boolean => typeof info?.hub === "number" && info.hub >= HUB_VERSION;

/** Asks an older hub to hand its port over; true when it agreed. */
async function askToStepDown(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/hub/step-down`, {
      method: "POST",
      headers: { "x-progressor": "step-down", "x-progressor-hub": String(HUB_VERSION) },
      signal: AbortSignal.timeout(1500),
    });
    return res.status === 202;
  } catch {
    return false;
  }
}

/**
 * Joins the dashboard: registers this Session's project and serves every registered project from
 * the first free port starting at 4747, or, when a Progressor hub of this version or a newer one
 * already holds it, shares that. An older hub that can step down is asked to hand the port over;
 * past one that cannot (it is still running), and past anything else, the next port is used, and
 * the hub moves back to the first port once it is free again.
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
  let notice: string | undefined;

  const closeServers = async (closing: Server[]) => {
    await Promise.all(
      closing.map((s) => {
        s.closeAllConnections();
        return new Promise<void>((done) => s.close(() => done()));
      }),
    );
  };

  /** Stops serving the dashboard; the Session goes on. */
  const stopServing = async () => {
    hub?.close();
    hub = undefined;
    role = "shared";
    const closing = servers;
    servers = [];
    await closeServers(closing);
  };

  /** Serves the dashboard on a port, moving there from the port it was served on before, if any. */
  const serveOn = async (p: number): Promise<"ok" | "in use" | "unavailable"> => {
    const http = createServer();
    const result = await listen(http, p);
    if (result !== "ok") return result;
    hub ??= new Hub(registryFile, uiDir, editor, rescanMs, workspaceScanMs, serversDir, () => void stopServing());
    http.on("request", hub.handle);
    const previous = servers;
    [servers, port, role] = [[http], p, "serving"];
    const ipv6 = createServer();
    if ((await listen(ipv6, p, "::1").catch(() => "unavailable")) === "ok") {
      ipv6.on("request", hub.handle);
      servers.push(ipv6);
    }
    await closeServers(previous);
    return "ok";
  };

  /** Serves a port once an older hub that agreed to step down has let it go. */
  const serveWhenFree = async (p: number): Promise<boolean> => {
    const end = Date.now() + 3000;
    do {
      if ((await serveOn(p)) === "ok") return true;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < end);
    return false;
  };

  /** An older Progressor's hub that holds the first port, for the notice. */
  let blocker: HubInfo | undefined;

  /** Serves or shares the dashboard on one port; false when the port is held by something this cannot use. */
  const tryPort = async (p: number): Promise<boolean> => {
    const result = await serveOn(p);
    if (result === "ok") return true;
    if (result !== "in use") return false;
    const info = await hubInfo(p);
    if (canShare(info)) {
      if (role === "serving") await stopServing();
      [port, role] = [p, "shared"];
      // Tell the hub about this project now, rather than at its next rescan; a new Workspace is scanned straight away.
      await fetch(`http://${HOST}:${p}/api/projects${workspace ? "?rescan" : ""}`, { signal: AbortSignal.timeout(workspace ? 30_000 : 1500) }).catch(
        () => undefined,
      );
      return true;
    }
    if (!info) return false; // something that is not Progressor, or does not answer: never disturbed
    if (info.stepDown && (await askToStepDown(p)) && (await serveWhenFree(p))) return true;
    if (p === firstPort) blocker = info;
    return false;
  };

  const about = (info: HubInfo) => [info.version, info.pid !== undefined && `process ${info.pid}`].filter(Boolean).join(", ");
  const updateNotice = () => {
    notice =
      port !== firstPort && blocker
        ? `Port ${firstPort} is held by an older Progressor${about(blocker) ? ` (${about(blocker)})` : ""} that is still running, ` +
          `so the dashboard is on port ${port} until it stops. Closing the chats that started before Progressor was updated frees it.`
        : undefined;
  };

  const claimPort = async (): Promise<void> => {
    blocker = undefined;
    try {
      for (let p = firstPort; p < firstPort + attempts; p++) if (await tryPort(p)) return;
      throw new Error(`No free port for the dashboard between ${firstPort} and ${firstPort + attempts - 1}.`);
    } finally {
      updateNotice();
    }
  };

  await claimPort();

  // Now and then: while another process serves the dashboard, check that it still does, and take
  // over when it has gone (stopped from the dashboard, or its Session ended), so the page stays up.
  // While this one serves it on another port than the first, move back to the first port as soon as
  // it is free, or share the hub there, so the dashboard's address goes back to the usual one.
  let checking = false;
  const refresh = async () => {
    if (checking) return;
    checking = true;
    try {
      if (role === "serving") {
        if (port !== firstPort) {
          blocker = undefined;
          await tryPort(firstPort);
          updateNotice();
        }
      } else if (!canShare(await hubInfo(port))) await claimPort();
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
    get notice() {
      return notice;
    },
    project: entry,
    refresh,
    async close() {
      clearInterval(watcher);
      await stopServing();
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
