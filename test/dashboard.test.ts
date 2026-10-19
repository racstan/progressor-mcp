import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, request } from "node:http";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { type ProjectEntry, projectEntry, registerProject } from "../src/dashboard/registry.js";
import { Project } from "../src/project.js";
import { announceServer } from "../src/servers.js";
import { tempDir } from "./tmp.js";

let registry: string;
let agent: Project;
let billing: Project;
const open: Dashboard[] = [];
const closers: (() => void)[] = [];
const freePort = () => 20000 + Math.floor(Math.random() * 20000);

/** A project folder with a Goal in it, as an Agent would leave it. */
function projectWith(title: string, sessionId: string): Project {
  const p = new Project({ root: tempDir("progressor-dash-"), session: { id: sessionId, pid: process.pid } });
  const goal = p.addGoal(title, [{ title: "First" }, { title: "Second" }]);
  p.claimGoal(goal.id);
  return p;
}

async function start(
  project: Project | undefined,
  options: { port?: number; uiDir?: string; editor?: string; workspace?: string } = {},
): Promise<Dashboard> {
  const d = await startDashboard({ project, registryFile: registry, port: options.port ?? freePort(), ...options });
  open.push(d);
  return d;
}

async function get(d: Dashboard, path: string) {
  const res = await fetch(new URL(path, d.url));
  return { status: res.status, body: (await res.json()) as any };
}

const entry = (p: Project): ProjectEntry => projectEntry(p.root);

beforeEach(() => {
  registry = join(tempDir("progressor-registry-"), "projects.json");
  agent = new Project({ root: tempDir("progressor-dash-"), session: { id: "s-a", pid: process.pid } });
  const goal = agent.addGoal("Ship OAuth login", [{ title: "Add the /login route" }, { title: "Handle the callback" }]);
  agent.claimGoal(goal.id);
  agent.startTask("t1");
  agent.completeTask("t1", ["src/routes/login.ts"]);
  agent.startTask("t2");
  agent.startDetour("Fix flaky token refresh", "The callback tests race the cookie write");
  agent.addGoal("Billing");
  agent.recordIdea("Remember-me checkbox", "From the Developer");
  agent.addStandingInstruction("Ask me before recalibrating");
  billing = projectWith("Billing page", "s-b");
});

afterEach(async () => {
  closers.splice(0).forEach((c) => c());
  await Promise.all(open.splice(0).map((d) => d.close()));
});

describe("Workspaces", () => {
  /** A Workspace folder holding two projects (one nested), and a plain folder. */
  function workspace(): { root: string; shop: Project; api: Project } {
    const root = tempDir("progressor-ws-");
    const at = (dir: string, title: string) => {
      const p = new Project({ root: join(root, dir), session: { id: "s-x", pid: process.pid } });
      p.addGoal(title, [{ title: "One" }]);
      return p;
    };
    mkdirSync(join(root, "notes"));
    return { root, shop: at("shop", "Checkout"), api: at("clients/acme/api", "Rate limits") };
  }

  it("opens on a Workspace without an Agent, serving every project found in it", async () => {
    const ws = workspace();
    const d = await start(undefined, { workspace: ws.root });
    const id = projectEntry(ws.root).id;
    expect(d.url).toBe(`http://localhost:${new URL(d.url).port}/?workspace=${id}`);
    expect(d.project).toBeUndefined();

    const projects = (await get(d, "/api/projects")).body as ProjectEntry[];
    expect(projects.map((p) => [p.name, p.workspace])).toEqual([["api", id], ["shop", id]]);
    expect((await get(d, "/api/workspaces")).body).toEqual([{ id, name: projectEntry(ws.root).name, root: ws.root }]);
    expect((await get(d, `/api/projects/${projectEntry(ws.shop.root).id}/roadmap`)).body.goals[0].title).toBe("Checkout");
  });

  it("gives every project's Goals and progress in one overview, the Agent's projects included", async () => {
    const ws = workspace();
    const d = await start(agent, { workspace: ws.root });
    const overview = (await get(d, "/api/overview")).body as any[];
    expect(overview.map((p) => p.name).sort()).toEqual(["api", projectEntry(agent.root).name, "shop"].sort());
    const mine = overview.find((p) => p.root === agent.root);
    expect(mine.workspace).toBeUndefined();
    expect(mine.goals.map((g: any) => [g.id, g.status, g.done, g.total])).toEqual([
      ["ship-oauth-login", "active", 1, 2],
      ["billing", "planned", 0, 0],
    ]);
  });

  it("finds a project added to a Workspace when asked to rescan, and a Workspace opened through a running hub", async () => {
    const ws = workspace();
    const d = await start(agent);
    const port = Number(new URL(d.url).port);
    const shared = await start(undefined, { port, workspace: ws.root });
    expect(shared.role).toBe("shared");
    expect((await get(d, "/api/projects")).body.map((p: ProjectEntry) => p.name)).toContain("shop");

    new Project({ root: join(ws.root, "notes"), session: { id: "s-y", pid: process.pid } }).addGoal("Write it up");
    expect((await get(d, "/api/projects")).body.map((p: ProjectEntry) => p.name)).not.toContain("notes");
    expect((await get(d, "/api/projects?rescan")).body.map((p: ProjectEntry) => p.name)).toContain("notes");
  });
});

describe("one dashboard for every project", () => {
  it("lists the registered projects and links each Session to its own one", async () => {
    const port = freePort();
    const d = await start(agent, { port });
    const other = await start(billing, { port });
    expect(d.url).toBe(`http://localhost:${port}/?project=${entry(agent).id}`);
    expect(other.url).toBe(`http://localhost:${port}/?project=${entry(billing).id}`);
    expect(other.role).toBe("shared");
    const { body } = await get(d, "/api/projects");
    expect(body.map((p: ProjectEntry) => p.root).sort()).toEqual([agent.root, billing.root].sort());
  });

  it("keeps each project's Roadmap, Sessions and items to itself", async () => {
    const d = await start(agent);
    await start(billing, { port: Number(new URL(d.url).port) });
    const mine = (await get(d, `/api/projects/${entry(agent).id}/roadmap`)).body;
    const theirs = (await get(d, `/api/projects/${entry(billing).id}/roadmap`)).body;
    expect(mine.root).toBe(agent.root);
    expect(mine.goals.map((g: any) => g.id)).toEqual(["ship-oauth-login", "billing"]);
    expect(mine.sessions.map((s: any) => s.session)).toEqual(["s-a"]);
    expect(theirs.root).toBe(billing.root);
    expect(theirs.goals.map((g: any) => g.id)).toEqual(["billing-page"]);
    expect(theirs.sessions.map((s: any) => s.session)).toEqual(["s-b"]);
    expect((await get(d, "/api/projects/nope-123456/roadmap")).status).toBe(404);
  });

  it("serves the Roadmap with each Goal's progress, the Sessions, Ideas and Standing Instructions", async () => {
    const d = await start(agent);
    const { status, body } = await get(d, `/api/projects/${entry(agent).id}/roadmap`);
    expect(status).toBe(200);
    expect(body.file).toBe(".progressor/roadmap.md");
    expect(body.goals.map((g: any) => [g.id, g.status, g.done, g.total, g.planFile])).toEqual([
      ["ship-oauth-login", "active", 1, 2, ".progressor/goals/ship-oauth-login.md"],
      ["billing", "planned", 0, 0, ".progressor/goals/billing.md"],
    ]);
    expect(body.sessions).toEqual([{ session: "s-a", pid: process.pid, goal: "ship-oauth-login", running: true }]);
    expect(body.ideas.map((i: any) => [i.ref, i.title, i.notes])).toEqual([
      ["progressor://roadmap/i1", "Remember-me checkbox", ["From the Developer"]],
    ]);
    expect(body.standingInstructions.map((s: any) => s.text)).toEqual(["Ask me before recalibrating"]);
  });

  it("serves a Goal's metro map", async () => {
    const d = await start(agent);
    const base = `/api/projects/${entry(agent).id}`;
    const { status, body } = await get(d, `${base}/goals/ship-oauth-login`);
    expect(status).toBe(200);
    expect(body.goal).toMatchObject({ id: "ship-oauth-login", title: "Ship OAuth login", planFile: ".progressor/goals/ship-oauth-login.md" });
    expect(body.graph.nodes.map((n: any) => `${n.id}@${n.step},${n.lane}`)).toEqual(["t1@0,0", "t2@1,0", "d1@2,1"]);
    expect(body.graph.edges).toEqual([
      { from: "t1", to: "t2", kind: "plan" },
      { from: "t2", to: "d1", kind: "detour" },
    ]);
    expect((await get(d, `${base}/goals/nope`)).status).toBe(404);
  });

  it("looks up any item by its ref", async () => {
    const d = await start(agent);
    const base = `/api/projects/${entry(agent).id}`;
    const { body } = await get(d, `${base}/item?ref=${encodeURIComponent("progressor://ship-oauth-login/t1")}`);
    expect(body).toMatchObject({ kind: "task", file: ".progressor/goals/ship-oauth-login.md", item: { title: "Add the /login route" } });
    const missing = await get(d, `${base}/item?ref=${encodeURIComponent("progressor://ship-oauth-login/t9")}`);
    expect(missing).toEqual({ status: 404, body: { error: "No item progressor://ship-oauth-login/t9." } });
  });

  it("tells the page which editor opens files", async () => {
    const d = await start(agent, { editor: "cursor" });
    expect((await get(d, "/api/info")).body).toMatchObject({ app: "progressor", hub: 2, editor: "cursor" });
  });

  it("says which process and version serve it, so the page can name an outdated one", async () => {
    const d = await start(agent);
    const { body } = await get(d, "/api/info");
    expect(body.pid).toBe(process.pid);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("live updates", () => {
  async function events(d: Dashboard) {
    const res = await fetch(new URL("/api/events", d.url));
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    closers.push(() => void reader.cancel());
    let seen = "";
    const until = async (text: string) => {
      while (!seen.includes(text)) seen += (await reader.read()).value ?? "";
      return seen;
    };
    await until(": connected");
    await new Promise((r) => setTimeout(r, 300)); // let the watchers settle
    seen = "";
    return until;
  }

  it("says which project changed when a file under its .progressor/ changes", async () => {
    const d = await start(agent);
    const until = await events(d);
    agent.addTasks([{ title: "Add logout" }]);
    expect(await until("ship-oauth-login.md")).toContain(`"project":"${entry(agent).id}"`);
  });

  it("starts watching a project as soon as its first Session joins the dashboard", async () => {
    const d = await start(agent);
    const until = await events(d);
    await start(billing, { port: Number(new URL(d.url).port) });
    expect(await until("event: projects")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    appendFileSync(join(billing.root, ".progressor", "goals", "billing-page.md"), "- [ ] Third ^t3\n");
    expect(await until("billing-page.md")).toContain(`"project":"${entry(billing).id}"`);
  });
});

describe("the page", () => {
  it("serves the built page, and the page for any other path so links into it work", async () => {
    const ui = tempDir("progressor-ui-");
    writeFileSync(join(ui, "index.html"), "<!doctype html><title>Progressor</title>");
    writeFileSync(join(ui, "app.js"), "console.log(1)");
    const d = await start(agent, { uiDir: ui });
    const page = await fetch(d.url);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    expect(await page.text()).toContain("<title>Progressor</title>");
    expect(await (await fetch(new URL("/app.js", d.url))).text()).toBe("console.log(1)");
    expect(await (await fetch(new URL("/goals/x", d.url))).text()).toContain("<title>Progressor</title>");
    expect((await fetch(new URL("/../../etc/passwd", d.url))).status).toBe(200); // resolves to the page, never outside
  });

  it("is view-only and answers only requests addressed to localhost", async () => {
    const d = await start(agent);
    expect((await fetch(new URL("/api/projects", d.url), { method: "POST" })).status).toBe(405);
    const port = new URL(d.url).port;
    const rebound = await new Promise<number>((done) => {
      request({ host: "127.0.0.1", port, path: "/api/projects", headers: { host: `evil.example:${port}` } }, (res) =>
        done(res.statusCode ?? 0),
      ).end();
    });
    expect(rebound).toBe(403);
  });
});

describe("who serves the dashboard", () => {
  it("takes over serving when the process that served it has gone, for every project", async () => {
    const port = freePort();
    const first = await start(agent, { port });
    const second = await start(billing, { port });
    await first.close();
    await second.refresh();
    expect(second.role).toBe("serving");
    expect(second.url).toBe(`http://localhost:${port}/?project=${entry(billing).id}`);
    const { body } = await get(second, "/api/projects");
    expect(body.map((p: ProjectEntry) => p.id).sort()).toEqual([entry(agent).id, entry(billing).id].sort());
  });

  it("moves to the next port when something else holds this one", async () => {
    const port = freePort();
    // an older, one-project Progressor dashboard: it answers, but is not the shared one
    const old = createHttpServer((_, res) => res.end(JSON.stringify({ app: "progressor", root: "/elsewhere" })));
    await new Promise<void>((done) => old.listen(port, "127.0.0.1", done));
    closers.push(() => old.close());
    const d = await start(agent, { port });
    expect(d.role).toBe("serving");
    expect(d.url).toBe(`http://localhost:${port + 1}/?project=${entry(agent).id}`);
  });
});

describe("running servers", () => {
  const announced: { close(): void }[] = [];
  afterEach(() => announced.splice(0).forEach((a) => a.close()));
  const serversDir = () => join(dirname(registry), "servers");
  function announce(project: Project, pid: number, onStop = () => {}) {
    announced.push(
      announceServer(
        { kind: "session", root: project.root, session: project.session.id },
        { dir: serversDir(), pid, version: "9.9.9", pollMs: 10, onStop },
      ),
    );
  }
  const stop = (d: Dashboard, pid: number, headers: Record<string, string>) =>
    fetch(new URL(`/api/servers/${pid}/stop`, d.url), { method: "POST", headers });
  const fromPage = (d: Dashboard) => ({ origin: new URL(d.url).origin, "x-progressor": "stop" });

  it("lists each running server with its project, the Goal its Session holds, and which one serves the dashboard", async () => {
    announce(agent, process.pid);
    announce(billing, process.ppid);
    registerProject(billing.root, registry);
    const d = await start(agent);
    const { status, body } = await get(d, "/api/servers");
    expect(status).toBe(200);
    expect(body.hub).toBe(process.pid);
    const byPid = Object.fromEntries(body.servers.map((s: any) => [s.pid, s]));
    expect(byPid[process.pid]).toMatchObject({
      kind: "session",
      root: agent.root,
      project: entry(agent).id,
      name: entry(agent).name,
      goal: { id: "ship-oauth-login", title: "Ship OAuth login" },
      serving: true,
    });
    expect(byPid[process.ppid]).toMatchObject({ project: entry(billing).id, goal: { title: "Billing page" }, serving: false });
  });

  it("asks a server to stop when the dashboard's own page says so", async () => {
    const stopped: number[] = [];
    announce(billing, process.ppid, () => stopped.push(process.ppid));
    const d = await start(agent);
    const res = await stop(d, process.ppid, fromPage(d));
    expect(res.status).toBe(202);
    const end = Date.now() + 2000;
    while (stopped.length === 0 && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(stopped).toEqual([process.ppid]);
  });

  it("refuses to stop anything for another web page, or without the dashboard's header", async () => {
    const stopped: number[] = [];
    announce(billing, process.ppid, () => stopped.push(process.ppid));
    const d = await start(agent);
    expect((await stop(d, process.ppid, { ...fromPage(d), origin: "https://evil.example" })).status).toBe(403);
    expect((await stop(d, process.ppid, { origin: new URL(d.url).origin })).status).toBe(403);
    const { "x-progressor": header } = fromPage(d);
    expect((await stop(d, process.ppid, { "x-progressor": header })).status).toBe(403);
    await new Promise((r) => setTimeout(r, 60));
    expect(stopped).toEqual([]);
  });

  it("refuses to stop a process that is not a running Progressor server", async () => {
    const d = await start(agent);
    expect((await stop(d, 424242, fromPage(d))).status).toBe(404);
  });

  it("is still view-only for everything else", async () => {
    const d = await start(agent);
    const res = await fetch(new URL("/api/projects", d.url), { method: "POST", headers: fromPage(d) });
    expect(res.status).toBe(405);
  });
});

describe("handing the dashboard over", () => {
  it("takes over by itself when the process that served it stops", async () => {
    const port = freePort();
    const first = await start(agent, { port });
    const second = await startDashboard({ project: billing, registryFile: registry, port, hubCheckMs: 20 });
    open.push(second);
    expect(second.role).toBe("shared");
    await first.close();
    const end = Date.now() + 3000;
    while (second.role !== "serving" && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
    expect(second.role).toBe("serving");
    expect((await get(second, "/api/projects")).status).toBe(200);
  });
});
