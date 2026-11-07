import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

let registry: string;
let project: Project;
let dash: Dashboard | undefined;
const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
const fakeFetch = async (url: string, init: { headers: Record<string, string>; body: string }) => {
  calls.push({ url, headers: init.headers, body: init.body });
  return { ok: true, status: 200 };
};
const settingsFile = () => join(dirname(registry), "settings.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  calls.length = 0;
  registry = join(tempDir("progressor-registry-"), "projects.json");
  project = new Project({ root: tempDir("progressor-ntfy-"), session: { id: "s", pid: process.pid } });
  project.claimGoal(project.addGoal("Ship it", [{ title: "One" }]).id);
});
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

const start = async () => {
  dash = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000), ntfyFetch: fakeFetch, rescanMs: 50 });
  return dash;
};

describe("phone notifications from the dashboard", () => {
  it("sends nothing while they are off, and pushes a new thing to try once when on", async () => {
    await start();
    project.addHandTest("Open the page");
    await sleep(900);
    expect(calls).toEqual([]);
    writeSettings(settingsFile(), "ntfy", { enabled: true });
    project.addHandTest("Click the button");
    await sleep(1200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.Title).toBe("Something is ready to try");
    expect(calls[0]!.url).toMatch(/^https:\/\/ntfy\.sh\/progressor-[0-9a-f]{16}$/);
    expect(calls[0]!.headers.Click).toMatch(/^http:\/\/localhost:\d+\/\?project=.*#\/goal\//);
  });

  it("sends a test from Settings, only from the dashboard's own page", async () => {
    const d = await start();
    writeSettings(settingsFile(), "ntfy", { enabled: true });
    const post = (headers: Record<string, string>) => fetch(new URL("/api/settings/ntfy/test", d.url), { method: "POST", headers });
    expect((await post({})).status).toBe(403);
    expect((await post({ origin: new URL(d.url).origin, "x-progressor": "ntfy" })).status).toBe(200);
    expect(calls.map((c) => c.headers.Title)).toEqual(["Progressor test"]);
  });
});
