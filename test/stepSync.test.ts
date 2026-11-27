// stepSync: which steps to move on, from the chats working in worktrees and the state of their branches.
import { describe, expect, it } from "vitest";
import type { LiveSession } from "../src/liveSessions.js";
import { branchMatchesStep, linkedBranch, syncSteps, type BranchFacts, type SyncStep } from "../src/stepSync.js";

const step = (id: string, status: SyncStep["status"] = "pending", branch?: string, startedAt?: string): SyncStep => ({ id, status, ...(branch ? { helper: { branch } } : {}), ...(startedAt ? { startedAt } : {}) });
const chat = (session: string, branch?: string, worktree = `/w/${session}`): LiveSession => ({
  session,
  pid: 1,
  since: "",
  seen: "",
  goals: [],
  ...(branch ? { branch, worktree } : {}),
});
const facts = (over: Partial<BranchFacts> = {}): BranchFacts => ({ exists: true, merged: false, ahead: [], ...over });
const sync = (over: Partial<Parameters<typeof syncSteps>[0]>) =>
  syncSteps({ steps: [], sessions: [], self: "s-main", branches: [], facts: {}, seen: {}, ...over });

describe("which branch belongs to a step", () => {
  it("matches the step id as a whole word of the branch name", () => {
    for (const b of ["t3-export", "feat/t3", "x_t3", "T3", "t3", "claude/t3-export-6bb45e"]) expect(branchMatchesStep(b, "t3"), b).toBe(true);
    for (const b of ["t30", "t30-export", "at3", "main", "feat/t13-x", "t3x"]) expect(branchMatchesStep(b, "t3"), b).toBe(false);
  });

  it("prefers the branch recorded on the step, even if unknown", () => {
    expect(linkedBranch(step("t3", "pending", "mine"), ["t3-export"])).toBe("mine");
  });

  it("falls back to a matching branch name, the first in order, and none without one", () => {
    expect(linkedBranch(step("t3"), ["main", "t3-b", "t3-a"])).toBe("t3-a");
    expect(linkedBranch(step("t3"), ["main", "t30"])).toBeUndefined();
  });
});

describe("a step with a helper", () => {
  it("is found while another live chat works in a worktree on its branch", () => {
    const out = sync({ steps: [step("t4"), step("t5")], sessions: [chat("s-1a2b3c", "t4-docs")], branches: ["t4-docs", "t5-x"] });
    expect(out).toEqual([{ task: "t4", kind: "with a helper", branch: "t4-docs", folder: "/w/s-1a2b3c", label: "chat s-1a2b3c" }]);
  });

  it("applies to a step in progress too", () => {
    expect(sync({ steps: [step("t4", "in progress")], sessions: [chat("s-h", "t4-docs")], branches: ["t4-docs"] })).toHaveLength(1);
  });

  it("ignores this chat's own branch, chats with no worktree and chats on other branches", () => {
    const noTree: LiveSession = { ...chat("s-h", "t4-docs"), worktree: undefined };
    expect(sync({ steps: [step("t4")], sessions: [chat("s-main", "t4-docs")], branches: ["t4-docs"] })).toEqual([]);
    expect(sync({ steps: [step("t4")], sessions: [noTree], branches: ["t4-docs"] })).toEqual([]);
    expect(sync({ steps: [step("t4")], sessions: [chat("s-h", "t5-x")], branches: ["t4-docs"] })).toEqual([]);
  });

  it("follows the branch recorded on the step", () => {
    expect(sync({ steps: [step("t4", "pending", "odd-name")], sessions: [chat("s-h", "odd-name")] })).toMatchObject([{ task: "t4", branch: "odd-name" }]);
  });

  it("leaves a step in any other state alone", () => {
    for (const s of ["with a helper", "waiting on you", "waiting on someone", "checked", "done", "released", "dropped"] as const)
      expect(sync({ steps: [step("t4", s)], sessions: [chat("s-h", "t4-docs")], branches: ["t4-docs"] }), s).toEqual([]);
  });
});

describe("a finished step", () => {
  const merged = (extra: Partial<BranchFacts> = {}) => ({ "t3-export": facts({ merged: true, ...extra }) });

  it("is done when its branch is merged, with the commits last seen ahead", () => {
    const out = sync({ steps: [step("t3", "with a helper")], branches: ["t3-export"], facts: merged(), seen: { "t3-export": ["a1b2c3", "d4e5f6"] } });
    expect(out).toEqual([{ task: "t3", kind: "done", branch: "t3-export", commits: ["a1b2c3", "d4e5f6"] }]);
  });

  it("applies to a pending, in progress, waiting or checked step", () => {
    for (const s of ["pending", "in progress", "with a helper", "waiting on you", "waiting on someone", "checked"] as const)
      expect(sync({ steps: [step("t3", s)], branches: ["t3-export"], facts: merged(), seen: { "t3-export": ["a1"] } }), s).toHaveLength(1);
  });

  it("waits for a branch that is not merged, or that is gone", () => {
    const seen = { "t3-export": ["a1"] };
    expect(sync({ steps: [step("t3")], branches: ["t3-export"], facts: { "t3-export": facts({ ahead: ["a1"] }) }, seen })).toEqual([]);
    expect(sync({ steps: [step("t3")], branches: [], facts: { "t3-export": facts({ exists: false, merged: true }) }, seen })).toEqual([]);
    expect(sync({ steps: [step("t3")], branches: ["t3-export"], facts: {}, seen })).toEqual([]);
  });

  it("does not take a branch with no work of its own (never seen ahead) for finished", () => {
    expect(sync({ steps: [step("t3")], branches: ["t3-export"], facts: merged() })).toEqual([]);
    expect(sync({ steps: [step("t3")], branches: ["t3-export"], facts: merged(), seen: { "t3-export": [] } })).toEqual([]);
  });

  it("wins over a live chat still on the merged branch", () => {
    const out = sync({ steps: [step("t3")], sessions: [chat("s-h", "t3-export")], branches: ["t3-export"], facts: merged(), seen: { "t3-export": ["a1"] } });
    expect(out.map((a) => a.kind)).toEqual(["done"]);
  });

  it("never touches done, released or dropped steps", () => {
    for (const s of ["done", "released", "dropped"] as const)
      expect(sync({ steps: [step("t3", s)], branches: ["t3-export"], facts: merged(), seen: { "t3-export": ["a1"] } }), s).toEqual([]);
  });

  it("does not take t30's branch for t3", () => {
    expect(sync({ steps: [step("t3")], branches: ["t30-x"], facts: { "t30-x": facts({ merged: true }) }, seen: { "t30-x": ["a1"] } })).toEqual([]);
  });

  it("gives each step its own action, in step order", () => {
    const out = sync({
      steps: [step("t3"), step("t4"), step("t5")],
      sessions: [chat("s-h", "t4-docs")],
      branches: ["t3-export", "t4-docs"],
      facts: { "t3-export": facts({ merged: true }) },
      seen: { "t3-export": ["a1"] },
    });
    expect(out.map((a) => `${a.task}:${a.kind}`)).toEqual(["t3:done", "t4:with a helper"]);
  });
});

describe("a merge nobody saw coming", () => {
  const into = (at: string, commits = ["m1", "m2"]) => ({ "t3-export": facts({ merged: true, mergedInto: { commits, at } }) });
  const base = { branches: ["t3-export"] };

  it("closes a step from the merge commit when nothing was seen ahead", () => {
    const out = sync({ ...base, steps: [step("t3", "pending", undefined, "2026-11-27T09:00:00Z")], facts: into("2026-11-27T10:00:00Z") });
    expect(out).toEqual([{ task: "t3", kind: "done", branch: "t3-export", commits: ["m1", "m2"] }]);
  });

  it("prefers the commits seen over the merge's", () => {
    const out = sync({ ...base, steps: [step("t3", "pending", undefined, "2026-11-27T09:00:00Z")], facts: into("2026-11-27T10:00:00Z"), seen: { "t3-export": ["a1"] } });
    expect(out).toMatchObject([{ commits: ["a1"] }]);
  });

  it("does not close a step from an old merge of a branch linked only by its name", () => {
    expect(sync({ ...base, steps: [step("t3", "pending", undefined, "2026-11-27T09:00:00Z")], facts: into("2026-05-01T10:00:00Z") })).toEqual([]);
  });

  it("falls back to when the goal was claimed, and to nothing when neither is known", () => {
    expect(sync({ ...base, steps: [step("t3")], since: "2026-11-27T09:00:00Z", facts: into("2026-11-27T10:00:00Z") })).toHaveLength(1);
    expect(sync({ ...base, steps: [step("t3")], since: "2026-11-27T09:00:00Z", facts: into("2026-05-01T10:00:00Z") })).toEqual([]);
    expect(sync({ ...base, steps: [step("t3")], facts: into("2026-11-27T10:00:00Z") })).toEqual([]);
  });

  it("trusts the merge of a branch recorded on the step, whatever its age", () => {
    const out = sync({ branches: ["odd"], steps: [step("t3", "with a helper", "odd")], facts: { odd: facts({ merged: true, mergedInto: { commits: ["m1"], at: "2026-05-01T10:00:00Z" } }) } });
    expect(out).toEqual([{ task: "t3", kind: "done", branch: "odd", commits: ["m1"] }]);
  });

  it("still needs seen when no merge commit was found (fast-forward, or a branch just made)", () => {
    expect(sync({ ...base, steps: [step("t3", "pending", undefined, "2026-11-27T09:00:00Z")], facts: { "t3-export": facts({ merged: true }) } })).toEqual([]);
  });
});
