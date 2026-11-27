// A step's reports on the dashboard: read-only routes.
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { attachReport } from "../src/reports.js";
import { tempDir } from "./tmp.js";

let dash: Dashboard | undefined;
let project: Project;

beforeEach(async () => {
  project = new Project({ root: tempDir("progressor-reports-route-"), session: { id: "s", pid: process.pid } });
  project.addGoal("Login", [{ title: "Route" }]);
  project.claimGoal("login");
  attachReport(project, { task: "t1", title: "Test run", text: "## Results\n\n715 passed" }, "login");
  dash = await startDashboard({ project, registryFile: join(tempDir("progressor-registry-"), "projects.json"), port: 20000 + Math.floor(Math.random() * 20000) });
});
afterEach(async () => {
  await dash?.close();
  dash = undefined;
});

const get = async (path: string) => {
  const res = await fetch(new URL(`/api/projects/${encodeURIComponent(dash!.project!.id)}${path}`, dash!.url));
  return { status: res.status, body: (await res.json()) as any };
};

describe("reports routes", () => {
  it("lists a goal's reports", async () => {
    const r = await get("/goals/login/reports");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject([{ id: "r1", task: "t1", title: "Test run", session: "s" }]);
  });

  it("gives one report's text", async () => {
    const r = await get("/goals/login/reports/r1");
    expect(r.status).toBe(200);
    expect(r.body.report.title).toBe("Test run");
    expect(r.body.text).toContain("715 passed");
  });

  it("says no for an unknown goal or report, and never reads another file", async () => {
    expect((await get("/goals/nope/reports")).status).toBe(404);
    expect((await get("/goals/login/reports/r9")).status).toBe(404);
    expect((await get("/goals/login/reports/..%2Froadmap")).status).toBeGreaterThanOrEqual(400);
  });
});
