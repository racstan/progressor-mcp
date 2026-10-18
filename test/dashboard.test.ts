import { mkdtempSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";

let root: string;
let agent: Project;
const open: Dashboard[] = [];
const freePort = () => 20000 + Math.floor(Math.random() * 20000);

async function start(options: Partial<Parameters<typeof startDashboard>[0]> = {}): Promise<Dashboard> {
  const d = await startDashboard({ project: agent, port: freePort(), ...options });
  open.push(d);
  return d;
}

async function get(d: Dashboard, path: string) {
  const res = await fetch(new URL(path, d.url));
  return { status: res.status, body: (await res.json()) as any };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "progressor-dash-"));
  agent = new Project({ root, session: { id: "s-a", pid: process.pid } });
  const goal = agent.addGoal("Ship OAuth login", [{ title: "Add the /login route" }, { title: "Handle the callback" }]);
  agent.claimGoal(goal.id);
  agent.startTask("t1");
  agent.completeTask("t1", ["src/routes/login.ts"]);
  agent.startTask("t2");
  agent.startDetour("Fix flaky token refresh", "The callback tests race the cookie write");
  agent.addGoal("Billing");
  agent.recordIdea("Remember-me checkbox", "From the Developer");
  agent.addStandingInstruction("Ask me before recalibrating");
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((d) => d.close()));
});

describe("the dashboard API", () => {
  it("serves the Roadmap with each Goal's progress, the Sessions, Ideas and Standing Instructions", async () => {
    const d = await start();
    const { status, body } = await get(d, "/api/roadmap");
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
    const d = await start();
    const { status, body } = await get(d, "/api/goals/ship-oauth-login");
    expect(status).toBe(200);
    expect(body.goal).toMatchObject({ id: "ship-oauth-login", title: "Ship OAuth login", planFile: ".progressor/goals/ship-oauth-login.md" });
    expect(body.graph.nodes.map((n: any) => `${n.id}@${n.step},${n.lane}`)).toEqual(["t1@0,0", "t2@1,0", "d1@2,1"]);
    expect(body.graph.edges).toEqual([
      { from: "t1", to: "t2", kind: "plan" },
      { from: "t2", to: "d1", kind: "detour" },
    ]);
    expect((await get(d, "/api/goals/nope")).status).toBe(404);
  });

  it("looks up any item by its ref", async () => {
    const d = await start();
    const { body } = await get(d, `/api/item?ref=${encodeURIComponent("progressor://ship-oauth-login/t1")}`);
    expect(body).toMatchObject({ kind: "task", file: ".progressor/goals/ship-oauth-login.md", item: { title: "Add the /login route" } });
    const missing = await get(d, `/api/item?ref=${encodeURIComponent("progressor://ship-oauth-login/t9")}`);
    expect(missing).toEqual({ status: 404, body: { error: "No item progressor://ship-oauth-login/t9." } });
  });

  it("tells the page which project it shows and which editor opens files", async () => {
    const d = await start({ editor: "cursor" });
    const { body } = await get(d, "/api/info");
    expect(body).toMatchObject({ app: "progressor", root, name: root.split(/[\\/]/).pop(), editor: "cursor" });
  });

  it("pushes an event to the page when a file under .progressor/ changes", async () => {
    const d = await start();
    const res = await fetch(new URL("api/events", d.url));
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let seen = "";
    const readUntil = async (text: string) => {
      while (!seen.includes(text)) seen += (await reader.read()).value ?? "";
    };
    await readUntil(": connected");
    await new Promise((r) => setTimeout(r, 300)); // let the watcher settle
    agent.addTasks([{ title: "Add logout" }]);
    await readUntil("ship-oauth-login.md");
    expect(seen).toMatch(/event: change\ndata: .*goals\/ship-oauth-login\.md/);
    await reader.cancel();
  });

  it("serves the built page, and the page for any other path so links into it work", async () => {
    const ui = mkdtempSync(join(tmpdir(), "progressor-ui-"));
    writeFileSync(join(ui, "index.html"), "<!doctype html><title>Progressor</title>");
    writeFileSync(join(ui, "app.js"), "console.log(1)");
    const d = await start({ uiDir: ui });
    const page = await fetch(d.url);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    expect(await page.text()).toContain("<title>Progressor</title>");
    expect(await (await fetch(new URL("app.js", d.url))).text()).toBe("console.log(1)");
    expect(await (await fetch(new URL("goals/x", d.url))).text()).toContain("<title>Progressor</title>");
    expect((await fetch(new URL("../../etc/passwd", d.url))).status).toBe(200); // resolves to the page, never outside
  });

  it("is view-only and answers only requests addressed to localhost", async () => {
    const d = await start();
    expect((await fetch(new URL("api/roadmap", d.url), { method: "POST" })).status).toBe(405);
    const port = new URL(d.url).port;
    const rebound = await new Promise<number>((done) => {
      request({ host: "127.0.0.1", port, path: "/api/roadmap", headers: { host: `evil.example:${port}` } }, (res) =>
        done(res.statusCode ?? 0),
      ).end();
    });
    expect(rebound).toBe(403);
  });
});

describe("several Sessions on one machine", () => {
  it("lets the first Session serve the dashboard and the others share its URL", async () => {
    const port = freePort();
    const first = await start({ port });
    const second = await start({ port, project: new Project({ root, session: { id: "s-b", pid: 1 } }) });
    expect(first.role).toBe("serving");
    expect(first.url).toBe(`http://localhost:${port}/`);
    expect(second.role).toBe("shared");
    expect(second.url).toBe(first.url);
  });

  it("moves to the next port when another project's dashboard has this one", async () => {
    const port = freePort();
    await start({ port });
    const elsewhere = new Project({ root: mkdtempSync(join(tmpdir(), "progressor-other-")), session: { id: "s-c", pid: 1 } });
    const other = await start({ port, project: elsewhere });
    expect(other.role).toBe("serving");
    expect(other.url).toBe(`http://localhost:${port + 1}/`);
  });

  it("takes over serving when the Session that served it has gone", async () => {
    const port = freePort();
    const first = await start({ port });
    const second = await start({ port, project: new Project({ root, session: { id: "s-b", pid: 1 } }) });
    await first.close();
    await second.refresh();
    expect(second.role).toBe("serving");
    expect(second.url).toBe(`http://localhost:${port}/`);
    expect((await get(second, "/api/info")).body.app).toBe("progressor");
  });
});
