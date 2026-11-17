import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

let registry: string;
let dash: Dashboard | undefined;
let asks = 0;
const fakeFetch = async () => {
  asks++;
  return new Response(JSON.stringify({ version: "99.0.0" }), { status: 200 });
};

beforeEach(() => {
  asks = 0;
  registry = join(tempDir("progressor-registry-"), "projects.json");
});
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

async function start() {
  const project = new Project({ root: tempDir("progressor-update-route-"), session: { id: "s", pid: process.pid } });
  dash = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000), ntfyFetch: fakeFetch as never });
  return dash;
}

const get = async (d: Dashboard) => (await fetch(new URL("/api/update", d.url))).json() as Promise<Record<string, unknown>>;
const dismiss = (d: Dashboard, version: string, headers: Record<string, string> = { origin: new URL(d.url).origin, "x-progressor": "update" }) =>
  fetch(new URL("/api/update/dismiss", d.url), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ version }) });

describe("the update notice's route", () => {
  it("says a newer version is out, with the command, and stops once dismissed", async () => {
    const d = await start();
    const first = await get(d);
    expect(first).toMatchObject({ latest: "99.0.0", available: true, enabled: true });
    expect(String(first.command)).toContain("progressor-mcp");
    expect((await dismiss(d, "99.0.0")).status).toBe(200);
    expect(await get(d)).toMatchObject({ latest: "99.0.0", available: false });
    expect(asks).toBe(1);
  });

  it("refuses a dismiss from anywhere but the dashboard's page", async () => {
    const d = await start();
    expect((await dismiss(d, "99.0.0", {})).status).toBe(403);
  });

  it("asks npm nothing when the check is turned off", async () => {
    writeSettings(join(dirname(registry), "settings.json"), "updates", { check: false });
    const d = await start();
    expect(await get(d)).toMatchObject({ available: false, enabled: false });
    expect(asks).toBe(0);
  });
});

describe("the AI hears about a newer version", () => {
  it("in get_status, once per version", async () => {
    const { writeFileSync } = await import("node:fs");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../src/server.js");
    const dir = tempDir("progressor-update-ai-");
    const updateFile = join(dir, "update-check.json");
    writeFileSync(updateFile, JSON.stringify({ latest: "99.0.0", checkedAt: Date.now() }));
    const project = new Project({ root: tempDir("progressor-update-ai-project-"), session: { id: "s", pid: process.pid } });
    const server = createServer(project, { settingsFile: join(dir, "settings.json"), updateFile });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(b);
    const status = async () => ((await client.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
    expect(await status()).toMatch(/Progressor 99\.0\.0 is out \(this is \d+\.\d+\.\d+\)/);
    expect(await status()).not.toContain("99.0.0");
  });
});
