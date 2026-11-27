import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { readSettings, writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

let dash: Dashboard | undefined;
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

async function start(settingsFile: string) {
  const project = new Project({ root: tempDir("progressor-syncroute-"), session: { id: "s", pid: process.pid } });
  project.addGoal("Login", [{ title: "Route" }]);
  const registry = join(tempDir("progressor-registry-"), "projects.json");
  dash = await startDashboard({ project, registryFile: registry, settingsFile, port: 20000 + Math.floor(Math.random() * 20000) });
  return dash;
}

const post = (d: Dashboard, path: string, header = "sync") =>
  fetch(new URL(path, d.url), { method: "POST", headers: { origin: new URL(d.url).origin, "x-progressor": header, "content-type": "application/json" }, body: "{}" });

describe("Settings › Sync on the dashboard", () => {
  it("shows sync off by default, with nothing synced yet", async () => {
    const d = await start(join(tempDir("progressor-set-"), "settings.json"));
    const body = await (await fetch(new URL("/api/sync", d.url))).json();
    expect(body).toMatchObject({ enabled: false, repo: "", talk: false, state: { pending: 0, conflicts: [] } });
  });

  it("turns sync off, only from the dashboard's own page", async () => {
    const settingsFile = join(tempDir("progressor-set-"), "settings.json");
    writeSettings(settingsFile, "sync", { enabled: true, repo: "/nowhere/plans.git" });
    const d = await start(settingsFile);
    expect((await post(d, "/api/sync/off", "other")).status).toBeGreaterThanOrEqual(400);
    expect(readSettings(settingsFile).sync.enabled).toBe(true);
    const res = await post(d, "/api/sync/off");
    expect(res.status).toBe(200);
    expect(readSettings(settingsFile).sync).toMatchObject({ enabled: false, repo: "/nowhere/plans.git" });
  });

  it("says plainly that Sync now needs sync turned on", async () => {
    const d = await start(join(tempDir("progressor-set-"), "settings.json"));
    const res = await post(d, "/api/sync/now");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/turn it on/);
  });
});
