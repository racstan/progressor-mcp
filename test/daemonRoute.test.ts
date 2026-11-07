import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never set anything up at login from a test: the daemon's commands are stood in for.
const calls: string[] = [];
let installed = false;
vi.mock("../src/daemonCommand.js", () => ({
  daemonInstalled: () => installed,
  daemonStatus: async () => (installed ? { pid: 7, port: 4747, version: "1.3.0", memory: 70 * 1_048_576, serving: true, startedAt: "x" } : undefined),
  installDaemon: async (registry: string) => {
    calls.push(`install ${registry}`);
    installed = true;
    return "It now starts when you log in.";
  },
  uninstallDaemon: async (registry: string, options: { stop?: boolean }) => {
    calls.push(`uninstall ${registry} stop=${options.stop}`);
    installed = false;
    return "It no longer starts when you log in.";
  },
  requestDaemonStop: (registry: string) => void calls.push(`stop ${registry}`),
}));

const { startDashboard } = await import("../src/dashboard/http.js");
const { tempDir } = await import("./tmp.js");

let registry: string;
let dash: Awaited<ReturnType<typeof startDashboard>> | undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  calls.length = 0;
  installed = false;
  registry = join(tempDir("progressor-registry-"), "projects.json");
  dash = await startDashboard({ registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
});
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

const url = (path: string) => new URL(path, dash!.url);
const post = (body: unknown, headers: Record<string, string> = { origin: url("/").origin, "x-progressor": "daemon" }) =>
  fetch(url("/api/daemon"), { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("Where the dashboard runs (Settings › Advanced)", () => {
  it("says it runs with your AI sessions until the background dashboard is set up", async () => {
    const view = await (await fetch(url("/api/daemon"))).json();
    expect(view).toEqual({ background: false, status: null, text: "The background dashboard is not running." });
  });

  it("sets the background dashboard up, only from the dashboard's own page", async () => {
    expect((await post({ background: true }, {})).status).toBe(403);
    expect(calls).toEqual([]);
    const res = await post({ background: true });
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(view.background).toBe(true);
    expect(view.status.pid).toBe(7);
    expect(view.text).toMatch(/^Served by the background dashboard: http:\/\/localhost:4747\//);
    expect(view.done).toBe("It now starts when you log in.");
    expect(calls).toEqual([`install ${registry}`]);
  });

  it("goes back to running with your AI sessions, stopping the background process after answering", async () => {
    installed = true;
    const res = await post({ background: false });
    expect(res.status).toBe(200);
    expect((await res.json()).background).toBe(false);
    await sleep(100);
    expect(calls).toEqual([`uninstall ${registry} stop=false`, `stop ${registry}`]);
  });

  it("refuses anything but a yes or no", async () => {
    expect((await post({ background: "yes" })).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
