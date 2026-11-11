import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { addWorkspace, hiddenProjectIds, listProjects, projectEntry, registerProject, removeProject, unhideProject } from "../src/dashboard/registry.js";
import { allProjects } from "../src/dashboard/workspace.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

/** A folder with a plan in it, as a running Progressor server leaves behind. */
function projectIn(parent: string, name: string): string {
  const root = join(parent, name);
  mkdirSync(join(root, ".progressor"), { recursive: true });
  new Project({ root, session: { id: "s-a", pid: process.pid } }).addGoal("Login");
  return root;
}

describe("removing a project from the dashboard", () => {
  it("takes it off the list and keeps a Workspace scan from bringing it back", () => {
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const workspace = tempDir("progressor-ws-");
    const app = projectIn(workspace, "app");
    const api = projectIn(workspace, "api");
    registerProject(app, registry);
    addWorkspace(workspace, registry);
    expect(allProjects(registry).map((p) => p.name)).toEqual(["api", "app"]);

    removeProject(app, registry);
    removeProject(api, registry);
    expect(listProjects(registry)).toEqual([]);
    expect(hiddenProjectIds(registry)).toEqual(new Set([projectEntry(app).id, projectEntry(api).id]));
    expect(allProjects(registry)).toEqual([]);
    // removing twice is harmless
    removeProject(app, registry);
    expect(hiddenProjectIds(registry).size).toBe(2);
  });

  it("brings it back when a Progressor server starts there again", () => {
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const workspace = tempDir("progressor-ws-");
    const app = projectIn(workspace, "app");
    const api = projectIn(workspace, "api");
    addWorkspace(workspace, registry);
    removeProject(app, registry);
    removeProject(api, registry);
    registerProject(app, registry);
    expect(allProjects(registry).map((p) => p.name)).toEqual(["app"]);
    expect(unhideProject(api, registry)).toBe(true);
    expect(unhideProject(api, registry)).toBe(false);
    expect(allProjects(registry).map((p) => p.name)).toEqual(["api", "app"]);
  });

  it("never touches the project's folder or plan", () => {
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const app = projectIn(tempDir("progressor-ws-"), "app");
    registerProject(app, registry);
    removeProject(app, registry);
    expect(new Project({ root: app, session: { id: "s-b", pid: process.pid } }).roadmap().goals.map((g) => g.title)).toEqual(["Login"]);
  });
});

describe("the dashboard's remove route", () => {
  let d: Dashboard;
  afterEach(async () => {
    await d.close();
  });

  it("removes the project from the list, only from the dashboard's own page", async () => {
    const registry = join(tempDir("progressor-reg-"), "projects.json");
    const parent = tempDir("progressor-ws-");
    const mine = new Project({ root: projectIn(parent, "mine"), session: { id: "s-a", pid: process.pid } });
    const other = projectIn(parent, "other");
    registerProject(other, registry);
    d = await startDashboard({ project: mine, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    const id = projectEntry(other).id;
    const remove = (headers: Record<string, string> = {}) =>
      fetch(new URL(`/api/projects/${id}/remove`, d.url), {
        method: "POST",
        headers: { origin: new URL(d.url).origin, "x-progressor": "remove-project", "content-type": "application/json", ...headers },
        body: "{}",
      });
    expect((await remove({ origin: "https://evil.example" })).status).toBe(403);
    expect((await remove({ "x-progressor": "notes" })).status).toBe(403);
    const names = async () => ((await (await fetch(new URL("/api/projects", d.url))).json()) as { name: string }[]).map((p) => p.name);
    expect(await names()).toEqual(["mine", "other"]);
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: id });
    expect(await names()).toEqual(["mine"]);
    expect((await remove()).status).toBe(404);
  });
});
