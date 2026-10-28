import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
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
    // when each Goal's plan last changed, for "last update 2 min ago"
    const planTime = statSync(join(agent.root, ".progressor/goals/ship-oauth-login.md")).mtimeMs;
    expect(body.goals[0].updatedAt).toBe(planTime);
    expect(typeof body.goals[1].updatedAt).toBe("number");
    expect(body.ideas.map((i: any) => [i.ref, i.title, i.notes])).toEqual([
      ["progressor://roadmap/i1", "Remember-me checkbox", ["From the Developer"]],
    ]);
    expect(body.standingInstructions.map((s: any) => s.text)).toEqual(["Ask me before recalibrating"]);
    expect(body.context).toBe("");
  });

  it("serves the schedule, the helper limit and each step's estimate and time", async () => {
    agent.addStandingInstruction("At most 2 helpers in parallel", true, 2);
    agent.addTasks([{ title: "Add logout", estimate: 90 }]);
    agent.updateGoal("billing", { estimate: 240 });
    const d = await start(agent);
    const { body } = await get(d, `/api/projects/${entry(agent).id}/roadmap`);
    expect(body.standingInstructions.map((s: any) => s.helpersAtOnce)).toEqual([undefined, 2]);
    expect(body.schedule).toMatchObject({ limit: 2, capacity: 2, estimated: true, unknown: 1 });
    expect(body.schedule.next.map((t: any) => t.title)).toEqual(["Add logout", "Billing"]);
    expect(body.schedule.goals.map((g: any) => [g.id, g.estimate, g.unknown])).toEqual([
      ["ship-oauth-login", 90, 1],
      ["billing", 240, 0],
    ]);
    const goal = (await get(d, `/api/projects/${entry(agent).id}/goals/ship-oauth-login`)).body;
    const nodes = goal.graph.nodes.filter((n: any) => n.kind === "task");
    expect(nodes.map((n: any) => [n.title, n.estimate, typeof n.timingSince])).toEqual([
      ["Add the /login route", undefined, "undefined"],
      ["Handle the callback", undefined, "string"],
      ["Add logout", 90, "undefined"],
    ]);
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

  it("serves a Goal's decisions and notes, and whether it is waiting on the Developer", async () => {
    agent.addDecision("Keep the old cookie name");
    agent.addNote("ship-oauth-login", "Logout overlaps on mobile");
    agent.updateNote("ship-oauth-login", "n1", { resolved: true });
    agent.addTasks([{ title: "Try it on a phone" }]);
    agent.setTaskState("t3", "waiting on you");
    const d = await start(agent);
    const base = `/api/projects/${entry(agent).id}`;
    const { body } = await get(d, `${base}/goals/ship-oauth-login`);
    expect(body.decisions).toEqual([
      { id: "c1", ref: "progressor://ship-oauth-login/c1", text: "Keep the old cookie name", line: expect.any(Number), added: expect.any(Object) },
    ]);
    expect(body.notes).toEqual([
      { id: "n1", ref: "progressor://ship-oauth-login/n1", text: "Logout overlaps on mobile", resolved: true, line: expect.any(Number), added: expect.any(Object), updated: expect.any(Object) },
    ]);
    expect(body.goal).toMatchObject({ waitingOnYou: true, done: 1, total: 3 });
    expect(body.goal.counts).toEqual({
      pending: 0,
      "in progress": 1,
      "with a helper": 0,
      "waiting on you": 1,
      checked: 0,
      done: 1,
      released: 0,
      dropped: 0,
    });
    const roadmap = (await get(d, `${base}/roadmap`)).body;
    expect(roadmap.goals.map((g: any) => [g.id, g.waitingOnYou])).toEqual([
      ["ship-oauth-login", true],
      ["billing", false],
    ]);
    const overview = (await get(d, "/api/overview")).body.find((p: any) => p.id === entry(agent).id);
    expect(overview.goals[0]).toMatchObject({ id: "ship-oauth-login", waitingOnYou: true });
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
    expect((await get(d, "/api/info")).body).toMatchObject({ app: "progressor", hub: 6, editor: "cursor" });
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

  /** A stand-in for another Progressor's hub that answers /api/info, and can be asked to step down. */
  async function fakeHub(port: number, info: Record<string, unknown>) {
    const asked: Record<string, string | undefined>[] = [];
    const http = createHttpServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/hub/step-down") {
        asked.push({ progressor: req.headers["x-progressor"] as string, hub: req.headers["x-progressor-hub"] as string });
        res.writeHead(202).end("{}");
        http.closeAllConnections();
        http.close();
        return;
      }
      res.end(JSON.stringify({ app: "progressor", version: "0.1.0", pid: 4242, ...info }));
    });
    await new Promise<void>((done) => http.listen(port, "127.0.0.1", done));
    closers.push(() => {
      http.closeAllConnections();
      http.close();
    });
    return { http, asked };
  }

  it("shares a hub from a newer Progressor rather than moving to another port", async () => {
    const port = freePort();
    await fakeHub(port, { hub: 99 });
    const d = await start(agent, { port });
    expect(d.role).toBe("shared");
    expect(d.url).toBe(`http://localhost:${port}/?project=${entry(agent).id}`);
    expect(d.notice).toBeUndefined();
  });

  it("asks an older hub that can step down to hand the port over, and serves it", async () => {
    const port = freePort();
    const old = await fakeHub(port, { hub: 1, stepDown: true });
    const d = await start(agent, { port });
    expect(old.asked).toEqual([{ progressor: "step-down", hub: expect.stringMatching(/^\d+$/) }]);
    expect(d.role).toBe("serving");
    expect(d.url).toBe(`http://localhost:${port}/?project=${entry(agent).id}`);
  });

  it("moves to the next port past an older hub that cannot step down, and says why", async () => {
    const port = freePort();
    await fakeHub(port, { hub: 1, version: "0.5.0" });
    const d = await start(agent, { port });
    expect(d.role).toBe("serving");
    expect(new URL(d.url).port).toBe(String(port + 1));
    expect(d.notice).toMatch(new RegExp(`${port}.*older Progressor \\(0\\.5\\.0, process 4242\\)`));
  });

  it("moves back to the first port once the older hub there has gone", async () => {
    const port = freePort();
    const old = await fakeHub(port, { hub: 1 });
    const d = await start(agent, { port });
    expect(new URL(d.url).port).toBe(String(port + 1));
    old.http.closeAllConnections();
    await new Promise<void>((done) => old.http.close(() => done()));
    await d.refresh();
    expect(d.role).toBe("serving");
    expect(d.url).toBe(`http://localhost:${port}/?project=${entry(agent).id}`);
    expect(d.notice).toBeUndefined();
    expect((await get(d, "/api/projects")).status).toBe(200);
  });

  it("stops serving on another port and shares the hub on the first port when one is there again", async () => {
    const port = freePort();
    const old = await fakeHub(port, { hub: 1 });
    const d = await start(agent, { port });
    old.http.closeAllConnections();
    await new Promise<void>((done) => old.http.close(() => done()));
    const hub = await start(billing, { port });
    expect(hub.role).toBe("serving");
    await d.refresh();
    expect(d.role).toBe("shared");
    expect(d.url).toBe(`http://localhost:${port}/?project=${entry(agent).id}`);
    const { body } = await get(hub, "/api/projects");
    expect(body.map((p: ProjectEntry) => p.id)).toContain(entry(agent).id);
  });

  it("steps down when a newer Progressor asks, then shares that newer hub", async () => {
    const port = freePort();
    const d = await start(agent, { port });
    expect((await get(d, "/api/info")).body.stepDown).toBe(true);
    const res = await fetch(`http://127.0.0.1:${port}/api/hub/step-down`, {
      method: "POST",
      headers: { "x-progressor": "step-down", "x-progressor-hub": "99" },
    });
    expect(res.status).toBe(202);
    const end = Date.now() + 2000;
    while (d.role !== "shared" && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(d.role).toBe("shared");
    // the newer one takes the port; the old one keeps pointing there instead of opening another
    await fakeHub(port, { hub: 99 });
    await d.refresh();
    expect(d.role).toBe("shared");
    expect(new URL(d.url).port).toBe(String(port));
  });

  it("takes the port back after stepping down if the newer hub never came", async () => {
    const port = freePort();
    const d = await start(agent, { port });
    await fetch(`http://127.0.0.1:${port}/api/hub/step-down`, { method: "POST", headers: { "x-progressor": "step-down", "x-progressor-hub": "99" } });
    const end = Date.now() + 2000;
    while (d.role !== "shared" && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    await d.refresh();
    expect(d.role).toBe("serving");
    expect(new URL(d.url).port).toBe(String(port));
  });

  it("does not step down for the same or an older version, or for a web page", async () => {
    const port = freePort();
    const d = await start(agent, { port });
    const ask = (headers: Record<string, string>) => fetch(`http://127.0.0.1:${port}/api/hub/step-down`, { method: "POST", headers });
    expect((await ask({ "x-progressor": "step-down", "x-progressor-hub": "1" })).status).toBe(409);
    expect((await ask({ "x-progressor-hub": "99" })).status).toBe(403);
    expect((await ask({ "x-progressor": "step-down", "x-progressor-hub": "99", origin: "https://evil.example" })).status).toBe(403);
    expect(d.role).toBe("serving");
    expect((await get(d, "/api/projects")).status).toBe(200);
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

  it("shows a Goal's chat as stopped when its process now runs another Session: the pid was reused", async () => {
    announced.push(
      announceServer({ kind: "session", root: billing.root, session: "s-other" }, { dir: serversDir(), pid: process.pid, version: "9.9.9", onStop: () => {} }),
    );
    const d = await start(agent);
    const { body } = await get(d, `/api/projects/${entry(agent).id}/roadmap`);
    expect(body.sessions).toEqual([{ session: "s-a", pid: process.pid, goal: "ship-oauth-login", running: false }]);
  });

  it("lists every Goal a Session holds, since a chat can work on several at once", async () => {
    announce(agent, process.pid);
    const second = agent.addGoal("Invoicing", [{ title: "Invoices" }]);
    agent.claimGoal(second.id);
    const d = await start(agent);
    const { body } = await get(d, "/api/servers");
    const mine = body.servers.find((s: any) => s.pid === process.pid);
    expect(mine.goals).toEqual([
      { id: "ship-oauth-login", title: "Ship OAuth login" },
      { id: second.id, title: "Invoicing" },
    ]);
    expect(mine.goal).toEqual(mine.goals[0]);
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

describe("searching", () => {
  it("finds Tasks and Goals across every project on the dashboard, but not old Ideas", async () => {
    const d = await start(agent);
    registerProject(billing.root, registry);
    const tasks = (await get(d, "/api/search?q=callback")).body;
    expect(tasks).toEqual([
      expect.objectContaining({ kind: "task", title: "Handle the callback", project: expect.objectContaining({ id: entry(agent).id }), goal: { id: "ship-oauth-login", title: "Ship OAuth login" } }),
    ]);
    expect((await get(d, "/api/search?q=billing")).body.map((h: any) => `${h.kind}:${h.title}`)).toEqual(
      expect.arrayContaining(["goal:Billing", "goal:Billing page"]),
    );
    expect((await get(d, "/api/search?q=remember")).body.map((h: any) => h.kind)).toEqual([]);
    expect((await get(d, "/api/search")).body).toEqual([]);
  });
});
