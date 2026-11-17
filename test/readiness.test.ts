// Ready to launch?: what still stands between the project and a launch or release, grouped by who it
// waits on. Pure (readiness.ts), so the page and the AI's answer are the same.
import { describe, expect, it } from "vitest";
import { type ReadinessInput, readiness, readinessText } from "../src/readiness.js";

const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({ goals: [], steps: [], untried: [], questions: [], risks: [], ...over });

describe("which goals count", () => {
  it("counts every open goal when nothing is marked for launch and no release is planned", () => {
    const r = readiness(
      base({
        goals: [
          { id: "a", title: "A", status: "active" },
          { id: "b", title: "B", status: "done" },
          { id: "c", title: "C", status: "dropped" },
          { id: "d", title: "D", status: "planned" },
        ],
      }),
    );
    expect(r.scope.kind).toBe("everything");
    expect(r.scope.goals.map((g) => g.id)).toEqual(["a", "d"]);
  });

  it("counts only the goals marked for launch, plus open hotfixes, once any is marked", () => {
    const r = readiness(
      base({
        goals: [
          { id: "a", title: "A", status: "active", forLaunch: true },
          { id: "b", title: "B", status: "planned" },
          { id: "h", title: "Crash", status: "planned", hotfix: true },
        ],
      }),
    );
    expect(r.scope.kind).toBe("marked");
    expect(r.scope.goals.map((g) => g.id)).toEqual(["a", "h"]);
  });

  it("counts the next open release goal, what it bundles, and the marked goals", () => {
    const r = readiness(
      base({
        goals: [
          { id: "x", title: "X", status: "done" },
          { id: "y", title: "Y", status: "testing" },
          { id: "z", title: "Z", status: "planned" },
          { id: "m", title: "M", status: "planned", forLaunch: true },
          { id: "rel", title: "Release 1.2", status: "planned", release: "1.2.0", bundles: ["x", "y"] },
          { id: "rel2", title: "Release 1.3", status: "planned", release: "1.3.0" },
        ],
      }),
    );
    expect(r.scope.kind).toBe("release");
    expect(r.scope.release).toBe("1.2.0");
    expect(r.scope.goals.map((g) => g.id)).toEqual(["x", "y", "m", "rel"]);
  });
});

describe("what is left, by who it waits on", () => {
  const goals: ReadinessInput["goals"] = [
    { id: "a", title: "Login", status: "active" },
    { id: "b", title: "Billing", status: "testing" },
    { id: "out", title: "Not counted", status: "planned" },
  ];

  it("is ready when nothing is left", () => {
    const r = readiness(base({ goals: [{ id: "a", title: "A", status: "done" }] }));
    expect(r.ready).toBe(true);
    expect(r.left).toBe(0);
    expect(r.verdict).toBe("Ready to launch: nothing is left.");
  });

  it("puts open steps on the AI, waiting-on-you steps, things to try and questions on you, and waiting-on-someone steps on that person", () => {
    const r = readiness(
      base({
        goals: [...goals.slice(0, 2), { ...goals[2]!, status: "dropped" }],
        steps: [
          { goal: "a", step: "t1", title: "Route", status: "pending" },
          { goal: "a", step: "t2", title: "Form", status: "with a helper" },
          { goal: "a", step: "t3", title: "Done one", status: "done" },
          { goal: "a", step: "t4", title: "Try login", status: "waiting on you" },
          { goal: "a", step: "t5", title: "Contract", status: "waiting on someone", waitingFor: "Priya", need: "Sign it" },
          { goal: "b", step: "t1", title: "Tax", status: "waiting on someone", waitingFor: "Priya" },
          { goal: "b", step: "t2", title: "Stripe keys", status: "waiting on someone", waitingFor: "Stripe support" },
          { goal: "out", step: "t1", title: "Ignored", status: "pending" },
        ],
        untried: [{ goal: "b", test: "h1", text: "Pay with a test card" }],
        questions: [{ goal: "a", id: "q1", text: "Which logo?" }],
      }),
    );
    expect(r.ai.map((b) => b.title)).toEqual(["Route", "Form"]);
    expect(r.you.map((b) => [b.kind, b.title])).toEqual([
      ["step", "Try login"],
      ["question", "Which logo?"],
      ["hand test", "Pay with a test card"],
    ]);
    expect(r.others.map((o) => [o.person, o.items.map((b) => b.title)])).toEqual([
      ["Priya", ["Contract", "Tax"]],
      ["Stripe support", ["Stripe keys"]],
    ]);
    expect(r.others[0]!.items[0]!.need).toBe("Sign it");
    expect(r.ai[0]!.goalTitle).toBe("Login");
    expect(r.ready).toBe(false);
    expect(r.left).toBe(8);
  });

  it("counts an open goal with no open steps as work for the AI, and a goal waiting on tests with nothing untried as nothing", () => {
    const r = readiness(
      base({
        goals: [
          { id: "a", title: "Empty", status: "planned" },
          { id: "b", title: "Built", status: "testing" },
        ],
        steps: [{ goal: "b", step: "t1", title: "x", status: "done" }],
      }),
    );
    expect(r.ai).toEqual([{ kind: "goal", goal: "a", goalTitle: "Empty", title: "Finish the goal" }]);
    expect(r.left).toBe(1);
  });

  it("counts serious risks nothing is reducing against being ready", () => {
    const r = readiness(base({ risks: [{ id: "r1", title: "Card data leaks", score: 9 }] }));
    expect(r.ready).toBe(false);
    expect(r.left).toBe(1);
    expect(r.verdict).toBe("Not ready yet: 1 serious risk.");
  });

  it("says what is left in one plain line", () => {
    const r = readiness(
      base({
        goals: [{ id: "a", title: "A", status: "active" }],
        steps: [
          { goal: "a", step: "t1", title: "x", status: "pending" },
          { goal: "a", step: "t2", title: "y", status: "pending" },
          { goal: "a", step: "t3", title: "z", status: "waiting on you" },
          { goal: "a", step: "t4", title: "w", status: "waiting on someone", waitingFor: "Priya" },
        ],
        risks: [
          { id: "r1", title: "r", score: 6 },
          { id: "r2", title: "s", score: 9 },
        ],
      }),
    );
    expect(r.verdict).toBe("Not ready yet: 2 steps for the AI, 1 thing for you, 1 thing waiting on others, 2 serious risks.");
  });
});

describe("the AI's answer", () => {
  it("matches the page: the verdict, then each group", () => {
    const text = readinessText(
      readiness(
        base({
          goals: [
            { id: "a", title: "Login", status: "active", forLaunch: true },
            { id: "b", title: "Other", status: "planned" },
          ],
          steps: [
            { goal: "a", step: "t1", title: "Route", status: "pending" },
            { goal: "a", step: "t2", title: "Contract", status: "waiting on someone", waitingFor: "Priya", need: "Sign it" },
          ],
          untried: [{ goal: "a", test: "h1", text: "Sign in" }],
          risks: [{ id: "r1", title: "Leak", score: 9 }],
        }),
      ),
    );
    expect(text).toBe(
      [
        "Not ready yet: 1 step for the AI, 1 thing for you, 1 thing waiting on others, 1 serious risk.",
        "Counting: the goals marked for launch (Login).",
        "For the AI:",
        "- Login: t1 Route",
        "For the Developer:",
        "- Login: try by hand: Sign in",
        "Waiting on others:",
        "- Priya: Login: t2 Contract (they need to: Sign it)",
        "Serious risks nothing is reducing:",
        "- r1 Leak",
      ].join("\n"),
    );
  });

  it("says plainly when it is ready", () => {
    expect(readinessText(readiness(base()))).toBe("Ready to launch: nothing is left.\nCounting: every open goal (none).");
  });
});

describe("from the plan", () => {
  it("marks goals for launch and reads what is left from the plan, the talk and the risks", async () => {
    const { Project } = await import("../src/project.js");
    const { tempDir } = await import("./tmp.js");
    const p = new Project({ root: tempDir("progressor-ready-"), session: { id: "s", pid: process.pid } });
    p.addGoal("Login", [{ title: "Route" }, { title: "Form" }]);
    p.addGoal("Docs", [{ title: "Write" }]);
    expect(p.readiness().scope.kind).toBe("everything");
    const [g] = p.setForLaunch(["login"], true);
    expect(g!.forLaunch).toBe(true);
    p.addRisk({ title: "Leak", likelihood: "high", impact: "high" });
    const r = p.readiness();
    expect(r.scope.goals.map((x) => x.id)).toEqual(["login"]);
    expect(r.ai.map((b) => b.title)).toEqual(["Route", "Form"]);
    expect(r.risks.map((x) => x.title)).toEqual(["Leak"]);
    p.setForLaunch(["login"], false);
    expect(p.roadmap().goal("login")!.forLaunch).toBeUndefined();
    expect(() => p.setForLaunch(["nope"], true)).toThrow(/No Goal nope/);
  });
});

describe("the tools", () => {
  it("update_goal marks a goal for launch, and launch_readiness answers with the page's summary", async () => {
    const { join } = await import("node:path");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Project } = await import("../src/project.js");
    const { createServer } = await import("../src/server.js");
    const { tempDir } = await import("./tmp.js");
    const p = new Project({ root: tempDir("progressor-ready-tool-"), session: { id: "s", pid: process.pid } });
    p.addGoal("Login", [{ title: "Route" }]);
    p.addGoal("Docs", [{ title: "Write" }]);
    const server = createServer(p, { registryFile: join(tempDir("progressor-reg-"), "registry.json"), settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
    await call("update_goal", { goal: "login", for_launch: true });
    expect(p.roadmap().goal("login")!.forLaunch).toBe(true);
    expect(await call("launch_readiness")).toBe(readinessText(p.readiness()));
    expect(await call("launch_readiness")).toMatch(/^Not ready yet: 1 step for the AI\.\nCounting: the goals marked for launch \(Login\)\./);
  });
});

describe("on the dashboard", () => {
  it("answers with the same summary the tool gives", async () => {
    const { join } = await import("node:path");
    const { Project } = await import("../src/project.js");
    const { startDashboard } = await import("../src/dashboard/http.js");
    const { tempDir } = await import("./tmp.js");
    const p = new Project({ root: tempDir("progressor-ready-dash-"), session: { id: "s", pid: process.pid } });
    p.addGoal("Login", [{ title: "Route" }]);
    const dash = await startDashboard({ project: p, registryFile: join(tempDir("progressor-reg-"), "projects.json"), port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const entry = (await (await fetch(new URL("/api/projects", dash.url!))).json())[0] as { id: string };
      const body = (await (await fetch(new URL(`/api/projects/${entry.id}/readiness`, dash.url!))).json()) as { readiness: ReturnType<typeof readiness> };
      expect(body.readiness).toEqual(p.readiness());
      expect(body.readiness.verdict).toBe("Not ready yet: 1 step for the AI.");
    } finally {
      await dash.close();
    }
  });
});
