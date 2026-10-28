import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CONTEXT, STALE_AFTER_MINUTES, promptReminder, runHook, sessionStatus } from "../src/hooks.js";
import { Project } from "../src/project.js";
import { mkdirSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

/** Dates every Plan File as last changed this many minutes before NOW, so the reminder's age is the same on every run. */
function touch(minutesAgo: number) {
  const dir = join(root, ".progressor", "goals");
  const when = new Date(NOW.getTime() - minutesAgo * 60_000);
  for (const f of readdirSync(dir)) utimesSync(join(dir, f), when, when);
}

const remind = (minutesAgo = 0) => {
  touch(minutesAgo);
  return promptReminder(reader().overview(), NOW);
};

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
        "Current Task: t2 Fix callback redirect loop (.progressor/goals/ship-oauth-login.md:8)",
        "  Summary: Only set the session cookie after token exchange.",
        "Open Detour: d1 Fix flaky CI test, branched from t2. Reason: CI blocks every push",
        "Next Task: t3 End-to-end tests",
        "Standing Instructions: s1 Ask me before recalibrating",
        "Call get_status before you start. Declare a Detour (start_detour) before doing anything that isn't the current Task.",
      ].join("\n"),
    );
  });

  it("lists hard rules first and marks them", () => {
    const a = oauthInProgress();
    a.addStandingInstruction("Ask me before recalibrating");
    a.addStandingInstruction("Never commit secrets", true);
    expect(sessionStatus(reader().overview())).toContain(
      "Standing Instructions: HARD RULE s2: Never commit secrets; s1 Ask me before recalibrating",
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

describe("one Session holding several Goals", () => {
  it("gives the full status of each Goal, since they are most likely this conversation's own", () => {
    const a = oauthInProgress();
    a.addGoal("Voice", [{ title: "Try on phone" }, { title: "Ship" }]);
    a.claimGoal("voice");
    a.setTaskState("t1", "waiting on you", "voice");
    a.addDecision("Old models get thinking on/off only", "voice");
    a.addNote("voice", "The mic stays on");
    const text = sessionStatus(reader().overview()) ?? "";
    expect(text).toContain("[Progressor] One Session is working on 2 Goals in this project:");
    expect(text).toContain("Goal: Ship OAuth login (progressor://ship-oauth-login), 1 of 3 Tasks done");
    expect(text).toContain(
      [
        "Goal: Voice (progressor://voice), 0 of 2 Tasks done",
        "Current Task: none started",
        "Waiting on the Developer: t1 Try on phone",
        "Next Task: t2 Ship",
        "Decisions: c1 Old models get thinking on/off only",
        "Notes: n1 The mic stays on",
      ].join("\n"),
    );
    expect(text).toContain("pass goal");
    expect(remind()).toBe(
      "[Progressor] Goals in progress: Ship OAuth login (t2 Fix callback redirect loop), Voice (no Task started; waiting on the Developer). Call get_status if unsure which is yours.",
    );
  });
});

describe("promptReminder", () => {
  it("is silent when no Goal is being worked on", () => {
    expect(promptReminder(reader().overview(), NOW)).toBeUndefined();
    oauthInProgress().releaseGoal();
    expect(remind()).toBeUndefined();
  });

  it("is one line with the Goal, current Task and next Task", () => {
    oauthInProgress();
    expect(remind()).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests · updated just now",
    );
  });

  it("says when Tasks are with a helper or waiting on the Developer", () => {
    const a = oauthInProgress();
    a.setTaskState("t3", "with a helper");
    expect(remind()).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · With a helper: t3 (mark each checked once you check its work) · updated just now",
    );
    a.setTaskState("t3", "waiting on you");
    expect(remind()).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Waiting on the Developer: t3 · updated just now",
    );
  });

  it("mentions an open Detour", () => {
    oauthInProgress().startDetour("Fix flaky CI test", "CI blocks every push");
    expect(remind()).toBe(
      "[Progressor] Goal: Ship OAuth login · On Detour d1 Fix flaky CI test (from t2) · Next: t3 End-to-end tests · updated just now",
    );
  });

  it("says how long ago the plan last changed, and flags a reminder that may be out of date", () => {
    oauthInProgress();
    const line = (minutes: number) => remind(minutes)!.split(" · ").slice(-1)[0];
    expect(line(0.5)).toBe("updated just now");
    expect(line(1)).toBe("updated 1 min ago");
    expect(line(12)).toBe("updated 12 min ago");
    expect(line(STALE_AFTER_MINUTES)).toBe(`updated ${STALE_AFTER_MINUTES} min ago`);
    expect(line(STALE_AFTER_MINUTES + 1)).toBe("updated 31 min ago, may be out of date; call get_status");
    expect(line(125)).toBe("updated 2 h ago, may be out of date; call get_status");
    expect(line(60 * 24 * 3 + 30)).toBe("updated 3 days ago, may be out of date; call get_status");
    expect(remind(125)!.split("\n")).toHaveLength(1);
  });

  it("leaves the age out when the plan has no time, and counts a time in the future as just now", () => {
    oauthInProgress();
    const overview = reader().overview();
    overview.active[0]!.updatedAt = undefined;
    expect(promptReminder(overview, NOW)).not.toContain("updated");
    overview.active[0]!.updatedAt = NOW.getTime() + 5000;
    expect(promptReminder(overview, NOW)).toMatch(/· updated just now$/);
  });

  it("flags only the stale Goals when several are in progress", () => {
    oauthInProgress();
    const b = session("s-b", 200);
    b.addGoal("Billing page", [{ title: "Checkout flow" }]);
    b.claimGoal("billing-page");
    touch(0);
    utimesSync(join(root, ".progressor", "goals", "billing-page.md"), new Date(NOW.getTime() - 3 * 3_600_000), new Date(NOW.getTime() - 3 * 3_600_000));
    expect(promptReminder(reader().overview(), NOW)).toBe(
      "[Progressor] Goals in progress: Ship OAuth login (t2 Fix callback redirect loop), Billing page (no Task started; updated 3 h ago, may be out of date). Call get_status if unsure which is yours.",
    );
  });

  it("lists each Goal briefly when several are in progress", () => {
    oauthInProgress();
    const b = session("s-b", 200);
    b.addGoal("Billing page", [{ title: "Checkout flow" }]);
    b.claimGoal("billing-page");
    expect(remind()).toBe(
      "[Progressor] Goals in progress: Ship OAuth login (t2 Fix callback redirect loop), Billing page (no Task started). Call get_status if unsure which is yours.",
    );
  });
});

describe("runHook", () => {
  const sessionStart = (source = "startup") =>
    JSON.stringify({ session_id: "abc", cwd: root, hook_event_name: "SessionStart", source });
  const prompt = () => JSON.stringify({ session_id: "abc", cwd: root, hook_event_name: "UserPromptSubmit", prompt: "carry on" });
  const run = (event: string | undefined, input: string, env: Record<string, string | undefined> = {}, canRun = (_: string) => true) =>
    runHook({ event, input, env, isAlive: (p) => alive.has(p), canRun, now: () => NOW });
  const mcp = (command: string) =>
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { progressor: { command, args: ["/c", "progressor-mcp"] } } }));
  const noCmd = (command: string) => command !== "cmd";

  it("warns at session start when .mcp.json starts Progressor with a command this computer doesn't have", () => {
    oauthInProgress();
    mcp("cmd");
    const out = run("session-start", sessionStart(), {}, noCmd);
    expect(out.split("\n")[0]).toBe(
      '[Progressor] Warning: Claude Code can\'t start Progressor\'s MCP server in this folder: .mcp.json starts it with "cmd", which this computer doesn\'t have. Tell the Developer, and offer to run `progressor-mcp init` in this folder, which fixes it.',
    );
    expect(out).toContain("Current Task: t2 Fix callback redirect loop");
    expect(run("prompt", prompt(), {}, noCmd)).not.toContain("Warning");
  });

  it("warns even when the project has no Goals yet", () => {
    mkdirSync(join(root, ".progressor"));
    mcp("cmd");
    expect(run("session-start", sessionStart(), {}, noCmd)).toMatch(/^\[Progressor\] Warning: .*"cmd"/);
  });

  it("doesn't warn when the command is there, or when .mcp.json doesn't start Progressor", () => {
    oauthInProgress();
    mcp("progressor-mcp");
    expect(run("session-start", sessionStart(), {}, noCmd)).not.toContain("Warning");
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "cmd" } } }));
    expect(run("session-start", sessionStart(), {}, noCmd)).not.toContain("Warning");
    writeFileSync(join(root, ".mcp.json"), "not json");
    expect(run("session-start", sessionStart(), {}, noCmd)).toContain("Current Task: t2");
  });

  it("prints the session status at startup and after compaction", () => {
    oauthInProgress();
    for (const source of ["startup", "resume", "compact"]) {
      expect(run("session-start", sessionStart(source))).toContain("Current Task: t2 Fix callback redirect loop");
    }
  });

  it("prints the one-line reminder for a prompt", () => {
    oauthInProgress();
    touch(0);
    expect(run("prompt", prompt())).toBe(
      "[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests · updated just now",
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

  it("adds the whole Important context at session start, but not to every prompt", () => {
    const a = oauthInProgress();
    a.setContext("Dashboard on port 4747.\nReleases go out by pushing a tag.");
    const out = run("session-start", sessionStart());
    expect(out).toContain("Important context:\nDashboard on port 4747.\nReleases go out by pushing a tag.");
    expect(run("prompt", prompt())).not.toContain("Important context");
  });

  it("shows the Important context even before there are Goals", () => {
    session("s-a", 100).setContext("Dashboard on port 4747.");
    expect(run("session-start", sessionStart())).toContain("Important context:\nDashboard on port 4747.");
  });

  it("adds the Goal's decisions and open notes at session start", () => {
    const a = oauthInProgress();
    a.addDecision("Keep the old cookie name");
    a.addNote("ship-oauth-login", "Logout button overlaps on mobile");
    const out = run("session-start", sessionStart());
    expect(out).toContain("Next Task: t3 End-to-end tests\nDecisions: c1 Keep the old cookie name\nNotes: n1 Logout button overlaps on mobile");
  });

  it("keeps the text under Claude Code's context limit", () => {
    const a = oauthInProgress();
    a.addStandingInstruction("x".repeat(MAX_CONTEXT + 500));
    const out = run("session-start", sessionStart());
    expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT);
    expect(out).toMatch(/cut short; call get_status for the rest\]$/);
  });
});
