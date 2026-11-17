import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CiDeps } from "../src/ci.js";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import type { GitFacts } from "../src/gitFacts.js";
import { Project } from "../src/project.js";
import { writeSettings } from "../src/settings.js";
import { tempDir } from "./tmp.js";

const fakeGit: GitFacts = {
  commitsSince: () => ["abc1234"],
  dirty: () => false,
  branch: () => "main",
  commitLink: () => "https://github.com/me/app/commit/",
};

let registry: string;
let project: Project;
let dash: Dashboard | undefined;
let checks: "success" | "failure";
const asked: string[] = [];

const fakeCi: CiDeps = {
  async run(cmd, args) {
    asked.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "git" && args[0] === "remote") return "origin\thttps://github.com/me/app.git (fetch)\n";
    if (cmd === "git") return undefined;
    const path = args[args.length - 1]!;
    if (path.endsWith("/pulls")) return JSON.stringify([{ number: 12, title: "Login page", html_url: "https://github.com/me/app/pull/12", state: "open", head: { ref: "login", sha: "fff1234" } }]);
    if (path.endsWith("/check-runs")) return JSON.stringify({ check_runs: [{ status: "completed", conclusion: checks }] });
    if (path.endsWith("/status")) return JSON.stringify({ state: "pending", total_count: 0 });
    return undefined;
  },
  fetchJson: async () => undefined,
  now: () => Date.now(),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  asked.length = 0;
  checks = "failure";
  registry = join(tempDir("progressor-registry-"), "projects.json");
  project = new Project({ root: tempDir("progressor-ci-route-"), session: { id: "s", pid: process.pid }, git: fakeGit });
  project.addGoal("Login", [{ title: "Route" }, { title: "Page" }]);
  project.claimGoal("login");
  project.startTask("t1");
  project.completeTask("t1", []);
  project.recordEvidence("t1");
});
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

async function start() {
  dash = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000), ciDeps: fakeCi });
  return dash;
}

async function getJson<T>(d: Dashboard, path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(new URL(path, d.url));
  return { status: res.status, body: (await res.json()) as T };
}

describe("pull requests and checks on the dashboard", () => {
  it("answers from the kept file at once, then shows what the background refresh found", async () => {
    const d = await start();
    const id = d.project!.id;
    const path = `/api/projects/${encodeURIComponent(id)}/goals/login/ci`;
    const first = await getJson<{ prs: unknown[]; steps: object }>(d, path);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ prs: [], steps: {} });
    let body: { prs: { number: number; checks?: string }[]; checks?: string; steps: Record<string, unknown> } = { prs: [], steps: {} };
    for (let i = 0; i < 40 && body.prs.length === 0; i++) {
      await sleep(50);
      body = (await getJson<typeof body>(d, path)).body;
    }
    expect(body.prs.map((p) => [p.number, p.checks])).toEqual([[12, "failed"]]);
    expect(body.checks).toBe("failed");
    expect(Object.keys(body.steps)).toEqual(["t1"]);
    // Only the hosts' own commands were used, and only read-only ones.
    expect(asked.every((a) => /^git (remote -v|rev-parse )|^gh api repos\/me\/app\//.test(a))).toBe(true);

    // The goal is open and its latest checks failed: it shows in Needs you.
    const overview = await getJson<{ id: string; failedChecks: { id: string; title: string }[] }[]>(d, "/api/overview");
    expect(overview.body.find((p) => p.id === id)?.failedChecks).toEqual([{ id: "login", title: "Login" }]);
  });

  it("asks nothing when pull requests and checks are turned off in Settings, and says they are off", async () => {
    const settingsFile = join(tempDir("progressor-settings-"), "settings.json");
    writeSettings(settingsFile, "ci", { enabled: false });
    dash = await startDashboard({ project, registryFile: registry, settingsFile, port: 20000 + Math.floor(Math.random() * 20000), ciDeps: fakeCi });
    const id = dash.project!.id;
    const path = `/api/projects/${encodeURIComponent(id)}/goals/login/ci`;
    expect((await getJson(dash, path)).body).toEqual({ prs: [], steps: {}, off: true });
    const overview = await getJson<{ id: string; failedChecks: unknown[] }[]>(dash, "/api/overview");
    expect(overview.body.find((p) => p.id === id)?.failedChecks).toEqual([]);
    await sleep(200);
    expect(asked).toEqual([]);
  });

  it("refuses a goal that is not on the plan", async () => {
    const d = await start();
    const res = await getJson<{ error: string }>(d, `/api/projects/${encodeURIComponent(d.project!.id)}/goals/..%5C..%5Cx/ci`);
    expect(res.status).toBe(404);
  });
});
