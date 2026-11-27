// stepSync: which steps to move on, from the chats working in worktrees and the state of their branches.
import { describe, expect, it } from "vitest";
import type { LiveSession } from "../src/liveSessions.js";
import type { CiCache, PullRequest } from "../src/ci.js";
import { branchMatchesStep, linkedBranch, syncFromPullRequests, syncSteps, type BranchFacts, type SyncStep } from "../src/stepSync.js";

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

describe("steps and pull requests", () => {
  const pr = (over: Partial<PullRequest> = {}): PullRequest => ({ number: 12, title: "x", url: "https://h/pull/12", state: "open", branch: "t3-export", headSha: "a1b2c3d4e5f6a1b2c3d4", ...over });
  const cache = (prs: PullRequest[], where: "branch" | "recent" = "branch"): CiCache => ({
    commits: {},
    branches: where === "branch" ? { "t3-export": { at: 1, prs } } : {},
    ...(where === "recent" ? { recent: { at: 1, prs } } : {}),
  });
  const run = (over: Partial<Parameters<typeof syncFromPullRequests>[0]> = {}) =>
    syncFromPullRequests({ goal: "less", steps: [step("t3", "in progress", undefined, "2026-11-27T09:00:00Z")], branches: ["t3-export"], cache: cache([]), ...over });

  it("closes a step whose pull request is merged, with the head and merge commits", () => {
    const out = run({ cache: cache([pr({ state: "merged", mergeSha: "99887766554433", mergedAt: "2026-11-27T10:00:00Z" })]) });
    expect(out).toEqual([{ task: "t3", kind: "done", pr: 12, commits: ["a1b2c3d", "9988776"] }]);
  });

  it("uses the head commit alone when the merge commit is not known, and skips a bad hash", () => {
    expect(run({ cache: cache([pr({ state: "merged", mergedAt: "2026-11-27T10:00:00Z" })]) })[0]).toMatchObject({ commits: ["a1b2c3d"] });
    expect(run({ cache: cache([pr({ state: "merged", headSha: "zzz", mergedAt: "2026-11-27T10:00:00Z" })]) })).toEqual([{ task: "t3", kind: "done", pr: 12, commits: [] }]);
  });

  it("marks a step checked, with evidence, when its open pull request's checks passed", () => {
    expect(run({ cache: cache([pr({ checks: "passed", createdAt: "2026-11-27T09:30:00Z" })]) })).toEqual([{ task: "t3", kind: "checked", pr: 12, evidence: "CI passed on PR #12" }]);
  });

  it("does nothing for failed or running checks, no checks, or a closed pull request", () => {
    for (const p of [pr({ checks: "failed" }), pr({ checks: "running" }), pr({}), pr({ state: "closed" })])
      expect(run({ cache: cache([{ ...p, createdAt: "2026-11-27T09:30:00Z" }]) })).toEqual([]);
  });

  it("checks only a pending, in progress or with a helper step; a checked one is left", () => {
    const c = cache([pr({ checks: "passed", createdAt: "2026-11-27T09:30:00Z" })]);
    for (const s of ["pending", "in progress", "with a helper"] as const) expect(run({ steps: [step("t3", s, undefined, "2026-11-27T09:00:00Z")], cache: c })).toHaveLength(1);
    for (const s of ["checked", "waiting on you", "done", "released", "dropped"] as const) expect(run({ steps: [step("t3", s, undefined, "2026-11-27T09:00:00Z")], cache: c }), s).toEqual([]);
  });

  it("closes a checked or waiting step when its pull request merges, but never a finished one", () => {
    const c = cache([pr({ state: "merged", mergedAt: "2026-11-27T10:00:00Z" })]);
    for (const s of ["pending", "checked", "waiting on you", "with a helper"] as const) expect(run({ steps: [step("t3", s, undefined, "2026-11-27T09:00:00Z")], cache: c }), s).toHaveLength(1);
    for (const s of ["done", "released", "dropped"] as const) expect(run({ steps: [step("t3", s, undefined, "2026-11-27T09:00:00Z")], cache: c }), s).toEqual([]);
  });

  it("finds a pull request by a ref to the step, whatever its branch, and only for this goal", () => {
    const c = cache([pr({ branch: "whatever", state: "merged", refs: ["less/t3"] }), pr({ number: 13, url: "https://h/pull/13", branch: "other", state: "merged", refs: ["other-goal/t3"] })], "recent");
    expect(run({ branches: [], cache: c })).toEqual([{ task: "t3", kind: "done", pr: 12, commits: ["a1b2c3d"] }]);
  });

  it("finds a pull request in the recent list by the step's branch", () => {
    expect(run({ cache: cache([pr({ state: "merged", mergedAt: "2026-11-27T10:00:00Z" })], "recent") })).toHaveLength(1);
  });

  it("does not take an old pull request of a branch linked only by name for this step", () => {
    const old = cache([pr({ state: "merged", mergedAt: "2026-05-01T10:00:00Z" })]);
    expect(run({ cache: old })).toEqual([]);
    expect(run({ cache: cache([pr({ state: "merged" })]) })).toEqual([]); // no merge time known
    expect(run({ cache: old, steps: [step("t3", "pending", "t3-export", "2026-11-27T09:00:00Z")] })).toHaveLength(1); // recorded branch
    expect(run({ steps: [step("t3")], since: "2026-11-27T09:00:00Z", cache: cache([pr({ state: "merged", mergedAt: "2026-11-27T10:00:00Z" })]) })).toHaveLength(1);
    expect(run({ steps: [step("t3")], cache: cache([pr({ state: "merged", mergedAt: "2026-11-27T10:00:00Z" })]) })).toEqual([]);
  });

  it("an old pull request pointed at by a ref still counts", () => {
    expect(run({ branches: [], cache: cache([pr({ state: "merged", branch: "z", refs: ["less/t3"], mergedAt: "2026-05-01T10:00:00Z" })], "recent") })).toHaveLength(1);
  });

  it("merged beats open", () => {
    const c = cache([pr({ checks: "passed", createdAt: "2026-11-27T09:30:00Z" }), pr({ number: 14, url: "https://h/pull/14", state: "merged", mergedAt: "2026-11-27T10:00:00Z" })]);
    expect(run({ cache: c })[0]).toMatchObject({ kind: "done", pr: 14 });
  });
});
