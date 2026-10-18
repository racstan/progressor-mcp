import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CONTEXT, promptReminder, runHook, sessionStatus } from "../src/hooks.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
const alive = new Set<number>();
const NOW = new Date("2026-10-18T15:00:00.000Z");

function session(id: string, pid: number): Project {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive: (p) => alive.has(p), now: () => NOW });
}

/** What a hook sees: no Session of its own, just the files. */
const reader = () => new Project({ root, session: { id: "hook", pid: 1 }, isAlive: (p) => alive.has(p), now: () => NOW });

beforeEach(() => {
  root = tempDir("progressor-");
  alive.clear();
});

function oauthInProgress(agent = session("s-a", 100)): Project {
  agent.addGoal("Ship OAuth login", [
    { title: "Add the /login route" },
    { title: "Fix callback redirect loop", summary: "Only set the session cookie after token exchange." },
    { title: "End-to-end tests" },
  ]);
  agent.claimGoal("ship-oauth-login");
  agent.startTask("t1");
  agent.completeTask("t1");
  agent.startTask("t2");
  return agent;
}

describe("Project.overview", () => {
  it("splits started Goals into active (held by a running Session) and paused", () => {
    const a = oauthInProgress();
    a.addStandingInstruction("Ask me before recalibrating");
    const b = session("s-b", 200);
    b.addGoal("Billing page", [{ title: "Checkout flow" }]);
    b.claimGoal("billing-page");
    b.addGoal("Rate limiting", [{ title: "Pick a strategy" }]);
    alive.delete(200); // Session b's process has ended without releasing its Claim

    const o = reader().overview();
    expect(o.active.map((s) => s.goal?.id)).toEqual(["ship-oauth-login"]);
    expect(o.active[0]?.currentTask?.id).toBe("t2");
    expect(o.paused.map((s) => s.goal?.id)).toEqual(["billing-page"]);
    expect(o.planned.map((g) => g.id)).toEqual(["rate-limiting"]);
    expect(o.standingInstructions.map((i) => i.text)).toEqual(["Ask me before recalibrating"]);
  });
});

describe("sessionStatus", () => {
  it("says nothing for a project that doesn't use Progressor", () => {
    expect(sessionStatus(reader().overview())).toBeUndefined();
  });

  it("gives the full status of the one Goal being worked on", () => {
    const a = oauthInProgress();
    a.addStandingInstruction("Ask me before recalibrating");
    a.startDetour("Fix flaky CI test", "CI blocks every push");
    expect(sessionStatus(reader().overview())).toBe(
      [
        "[Progressor] The plan for this project, kept in .progressor/ by the progressor MCP server:",
        "Goal: Ship OAuth login (progressor://ship-oauth-login), 1 of 3 Tasks done",
        "Current Task: t2 Fix callback redirect loop (.progressor/goals/ship-oauth-login.md:6)",
        "  Summary: Only set the session cookie after token exchange.",
        "Open Detour: d1 Fix flaky CI test, branched from t2. Reason: CI blocks every push",
        "Next Task: t3 End-to-end tests",
        "Standing Instructions: s1 Ask me before recalibrating",
        "Call get_status before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
      ].join("\n"),
    );
  });

  it("lists every Goal in progress when several Sessions are working", () => {
    oauthInProgress();
    const b = session("s-b", 200);
    b.addGoal("Billing page", [{ title: "Checkout flow" }]);
    b.claimGoal("billing-page");
    const text = sessionStatus(reader().overview()) ?? "";
    expect(text).toContain("2 Goals are being worked on in this project:");
    expect(text).toContain("- Ship OAuth login: t2 Fix callback redirect loop; next t3 End-to-end tests");
    expect(text).toContain("- Billing page: no Task started; next t1 Checkout flow");
    expect(text).toContain("Call get_status to see which Goal is yours");
  });

  it("points a new Session at paused and planned Goals when nothing is being worked on", () => {
    oauthInProgress().releaseGoal();
    reader().addGoal("Rate limiting", []);
    const text = sessionStatus(reader().overview()) ?? "";
    expect(text).toContain("No Goal is being worked on in this project right now.");
    expect(text).toContain("Paused: Ship OAuth login (at t2 Fix callback redirect loop)");
    expect(text).toContain("Planned: Rate limiting");
    expect(text).toContain("claim_goal");
  });
});

describe("promptReminder", () => {
  it("is silent when no Goal is being worked on", () => {
    expect(promptReminder(reader().overview())).toBeUndefined();
    oauthInProgress().releaseGoal();
    expect(promptReminder(reader().overview())).toBeUndefined();
  });

  it("is one line with the Goal, current Task and next Task", () => {
    oauthInProgress();
    expect(promptReminder(reader().overview())).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests",
    );
  });

  it("mentions an open Detour", () => {
    oauthInProgress().startDetour("Fix flaky CI test", "CI blocks every push");
    expect(promptReminder(reader().overview())).toBe(
      "[Progressor] Goal: Ship OAuth login · On Detour d1 Fix flaky CI test (from t2) · Next: t3 End-to-end tests",
    );
  });

  it("lists each Goal briefly when several are in progress", () => {
    oauthInProgress();
    const b = session("s-b", 200);
    b.addGoal("Billing page", [{ title: "Checkout flow" }]);
    b.claimGoal("billing-page");
    expect(promptReminder(reader().overview())).toBe(
      "[Progressor] Goals in progress: Ship OAuth login (t2 Fix callback redirect loop), Billing page (no Task started). Call get_status if unsure which is yours.",
    );
  });
});

describe("runHook", () => {
  const sessionStart = (source = "startup") =>
    JSON.stringify({ session_id: "abc", cwd: root, hook_event_name: "SessionStart", source });
  const prompt = () => JSON.stringify({ session_id: "abc", cwd: root, hook_event_name: "UserPromptSubmit", prompt: "carry on" });
  const run = (event: string | undefined, input: string, env: Record<string, string | undefined> = {}) =>
    runHook({ event, input, env, isAlive: (p) => alive.has(p) });

  it("prints the session status at startup and after compaction", () => {
    oauthInProgress();
    for (const source of ["startup", "resume", "compact"]) {
      expect(run("session-start", sessionStart(source))).toContain("Current Task: t2 Fix callback redirect loop");
    }
  });

  it("prints the one-line reminder for a prompt", () => {
    oauthInProgress();
    expect(run("prompt", prompt())).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests",
    );
  });

  it("works out the event from Claude Code's input when none is named", () => {
    oauthInProgress();
    expect(run(undefined, prompt())).toContain("· Task: t2");
    expect(run(undefined, sessionStart())).toContain("[Progressor] The plan for this project");
  });

  it("reads the project from CLAUDE_PROJECT_DIR before the input's cwd", () => {
    oauthInProgress();
    const elsewhere = JSON.stringify({ cwd: tempDir("progressor-"), hook_event_name: "UserPromptSubmit" });
    expect(run("prompt", elsewhere)).toBe("");
    expect(run("prompt", elsewhere, { CLAUDE_PROJECT_DIR: root })).toContain("Goal: Ship OAuth login");
  });

  it("prints nothing for a project without .progressor/, bad input or an unknown event", () => {
    expect(run("session-start", sessionStart())).toBe("");
    oauthInProgress();
    expect(run("prompt", "not json")).toBe("");
    expect(run("teatime", prompt())).toBe("");
  });

  it("keeps the text under Claude Code's context limit", () => {
    const a = oauthInProgress();
    a.addStandingInstruction("x".repeat(MAX_CONTEXT + 500));
    const out = run("session-start", sessionStart());
    expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT);
    expect(out).toMatch(/cut short; call get_status for the rest\]$/);
  });
});
