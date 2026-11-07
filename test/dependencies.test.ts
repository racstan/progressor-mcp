import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseWaitRef, waitCycle } from "../src/dependencies.js";
import { Project } from "../src/project.js";
import { computeSchedule } from "../src/schedule.js";
import { tempDir } from "./tmp.js";

let root: string;
const agent = () => new Project({ root, session: { id: "s", pid: process.pid } });
const roadmapText = () => readFileSync(join(root, ".progressor", "roadmap.md"), "utf8");

beforeEach(() => {
  root = tempDir("progressor-deps-");
});

describe("what a goal waits on", () => {
  it("reads a goal here, or a goal in another project", () => {
    expect(parseWaitRef("login")).toEqual({ goal: "login", raw: "login" });
    expect(parseWaitRef(" api/ship-v2 ")).toEqual({ project: "api", goal: "ship-v2", raw: "api/ship-v2" });
    expect(parseWaitRef("my app/beta")).toEqual({ project: "my app", goal: "beta", raw: "my app/beta" });
  });

  it("finds a loop of goals waiting on each other", () => {
    const waits = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    expect(waitCycle("c", ["a"], (id) => waits.get(id) ?? [])).toEqual(["c", "a", "b", "c"]);
    expect(waitCycle("c", ["x"], (id) => waits.get(id) ?? [])).toBeUndefined();
    expect(waitCycle("a", ["a"], () => [])).toEqual(["a", "a"]);
  });
});

describe("setting what a goal waits on", () => {
  it("writes waits on lines, reads them back, and clears them", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route" }]);
    p.addGoal("Release", [{ title: "Tag" }]);
    p.setWaitsOn("release", ["login", "api/ship-v2"]);
    expect(roadmapText()).toContain("  - waits on: login\n  - waits on: api/ship-v2\n");
    expect(p.roadmap().goal("release")!.waitsOn).toEqual(["login", "api/ship-v2"]);
    p.setWaitsOn("release", []);
    expect(roadmapText()).not.toContain("waits on");
    expect(p.roadmap().goal("release")!.waitsOn).toBeUndefined();
  });

  it("refuses a goal here that doesn't exist, and a loop", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route" }]);
    p.addGoal("Release", [{ title: "Tag" }]);
    expect(() => p.setWaitsOn("release", ["nope"])).toThrow(/No Goal nope/);
    p.setWaitsOn("release", ["login"]);
    expect(() => p.setWaitsOn("login", ["release"])).toThrow(/would wait on itself: login → release → login/);
  });

  it("tells which goals here are not finished yet", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route" }]);
    p.addGoal("Release", [{ title: "Tag" }]);
    p.setWaitsOn("release", ["login"]);
    expect(p.waitingOn("release").map((w) => [w.ref.raw, w.state])).toEqual([["login", "open"]]);
    p.claimGoal("login");
    p.completeTask("t1");
    p.completeGoal();
    expect(p.waitingOn("release").map((w) => [w.ref.raw, w.state])).toEqual([["login", "finished"]]);
  });

  it("asks about another project's goals through the lookup it is given, and an unknown one does not block", () => {
    const p = agent();
    p.addGoal("Release", [{ title: "Tag" }]);
    p.setWaitsOn("release", ["api/ship-v2", "ghost/x"]);
    const lookup = (project: string, goal: string) =>
      project === "api" && goal === "ship-v2" ? { title: "Ship v2", status: "active" as const } : undefined;
    expect(p.waitingOn("release", lookup).map((w) => [w.ref.raw, w.state, w.title])).toEqual([
      ["api/ship-v2", "open", "Ship v2"],
      ["ghost/x", "unknown", undefined],
    ]);
  });
});

describe("the schedule with goals that wait", () => {
  const goal = (id: string, waitsOn?: string[]) => ({ id, title: id, status: "planned" as const, estimate: undefined, ...(waitsOn ? { waitsOn } : {}) });
  const task = (id: string, estimate: number) => ({ id, title: id, status: "pending" as const, estimate, spent: 0 });

  it("starts a waiting goal's steps only after the goals it waits on finish", () => {
    const s = computeSchedule(
      [
        { goal: goal("release", ["login"]), tasks: [task("t1", 30)] },
        { goal: goal("login"), tasks: [task("t1", 60)] },
        { goal: goal("docs"), tasks: [task("t1", 20)] },
      ],
      3,
      new Date("2026-11-07T10:00:00Z"),
    );
    const finish = Object.fromEntries(s.goals.map((g) => [g.id, g.finish]));
    expect(finish.login).toBe(60);
    expect(finish.release).toBe(90);
    expect(finish.docs).toBe(20);
  });
});

describe("goals that wait, through the AI's tools", () => {
  async function connect(settings?: string) {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../src/server.js");
    const server = createServer(agent(), { registryFile: join(tempDir("progressor-reg-"), "projects.json"), ...(settings ? { settingsFile: settings } : {}) });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content.map((c) => c.text).join("\n"), isError: !!r.isError };
    };
  }

  it("adds a goal that waits, shows it in the status, and warns but still claims", async () => {
    const call = await connect();
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }] });
    const added = await call("add_goal", { title: "Release", tasks: [{ title: "Tag" }], waits_on: ["login"] });
    expect(added.text).toContain("Added Goal release");
    const status = await call("get_status");
    expect(status.text).toContain("- release: Release (planned; waits on login (not finished))");
    const claimed = await call("claim_goal", { goal: "release" });
    expect(claimed.isError).toBe(false);
    expect(claimed.text).toContain("Note: Goal release waits on login (not finished)");
  });

  it("refuses a loop and says when a goal in another project can't be found", async () => {
    const call = await connect();
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }] });
    await call("add_goal", { title: "Release", tasks: [{ title: "Tag" }], waits_on: ["login"] });
    const loop = await call("update_goal", { goal: "login", waits_on: ["release"] });
    expect(loop.isError).toBe(true);
    expect(loop.text).toContain("would wait on itself");
    const unknown = await call("update_goal", { goal: "login", waits_on: ["ghost/x"] });
    expect(unknown.text).toContain("Note: found no goal ghost/x; it won't hold login up.");
    const cleared = await call("update_goal", { goal: "login", waits_on: [] });
    expect(cleared.isError).toBe(false);
    expect(roadmapText()).not.toContain("waits on: ghost/x");
  });

  it("does not warn on claim when that setting is off", async () => {
    const { writeSettings } = await import("../src/settings.js");
    const settings = join(tempDir("progressor-set-"), "settings.json");
    writeSettings(settings, "dependencies", { warnOnClaim: false });
    const call = await connect(settings);
    await call("add_goal", { title: "Login", tasks: [{ title: "Route" }] });
    await call("add_goal", { title: "Release", tasks: [{ title: "Tag" }], waits_on: ["login"] });
    expect((await call("claim_goal", { goal: "release" })).text).not.toContain("Note:");
  });
});
