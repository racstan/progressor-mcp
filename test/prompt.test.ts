import { describe, expect, it } from "vitest";
import { buildGoalGraph, type GraphNode } from "../src/dashboard/graph.js";
import { type PromptGoal, copyAsPrompt } from "../src/dashboard/prompt.js";
import { parsePlanFile } from "../src/planFile.js";

const PLAN = `# Ship OAuth login

## Tasks

- [x] Add provider config ^t1
- [-] Callback route ^t2
  - dropped by: ^d1
- [x] Swap to a PKCE-capable session library ^t3
  - added by: ^d1
  - code: \`package.json\`
- [/] Callback route ^t4
  - added by: ^d1
  - code: \`src/auth/callback.ts\`
  - code: \`src/auth/session.ts:42\`
- [ ] Session storage ^t5
  - added by: ^d1

## Detour: Session library lacks PKCE ^d1

- branched from: ^t2
- reason: The provider requires PKCE
- status: recalibrated

## Detour: Logger refactor ^d2

- branched from: ^t4
- reason: Callback errors were unreadable
- status: open
`;

const graph = buildGoalGraph(parsePlanFile(PLAN, "login"));
const node = (id: string) => graph.nodes.find((n) => n.id === id) as GraphNode;
const goal: PromptGoal = {
  id: "login",
  title: "Ship OAuth login",
  ref: "progressor://login",
  status: "active",
  line: 5,
  planFile: ".progressor/goals/login.md",
  claim: { session: "s-7f3a" },
};
const ROADMAP = ".progressor/roadmap.md";

describe("Copy as prompt", () => {
  it("describes a Task with its place in the plan, its code and how to look it up", () => {
    expect(copyAsPrompt({ kind: "node", node: node("t4"), goal, graph })).toBe(`[Progressor] Task t4 "Callback route" (in progress)
Ref: progressor://login/t4
Location: .progressor/goals/login.md:11
Goal: "Ship OAuth login" (progressor://login)
Position: Task 3 of 4 in the plan
Previous: t3 "Swap to a PKCE-capable session library" (done, line 8)
Next: t5 "Session storage" (pending, line 15)
Added by: Detour d1 "Session library lacks PKCE" (recalibrated)
References: src/auth/callback.ts, src/auth/session.ts:42

Read .progressor/goals/login.md:11 (or call get_item with progressor://login/t4) before acting on it.`);
  });

  it("warns that a dropped Task is no longer part of the plan", () => {
    expect(copyAsPrompt({ kind: "node", node: node("t2"), goal, graph })).toBe(`[Progressor] Task t2 "Callback route" (dropped)
Ref: progressor://login/t2
Location: .progressor/goals/login.md:6
Goal: "Ship OAuth login" (progressor://login)
Dropped by: Detour d1 "Session library lacks PKCE" (recalibrated)
This Task is no longer part of the plan. Do not work on it.

Read .progressor/goals/login.md:6 (or call get_item with progressor://login/t2) before acting on it.`);
  });

  it("describes a Detour with the Task it branched from, its Reason and how it ended", () => {
    expect(copyAsPrompt({ kind: "node", node: node("d2"), goal, graph })).toBe(`[Progressor] Detour d2 "Logger refactor" (open)
Ref: progressor://login/d2
Location: .progressor/goals/login.md:24
Goal: "Ship OAuth login" (progressor://login)
Branched from: Task t4 "Callback route" (.progressor/goals/login.md:11)
Reason: Callback errors were unreadable
Status: still open; it ends with a Merge back, Return or Recalibration.

Read .progressor/goals/login.md:24 (or call get_item with progressor://login/d2) before acting on it.`);
    expect(copyAsPrompt({ kind: "node", node: node("d1"), goal, graph })).toContain(
      "Status: recalibrated; the remaining Tasks were dropped and replaced with t3, t4, t5.",
    );
  });

  it("summarises a Goal: its Claim, progress, current Task, open Detour and next Task", () => {
    expect(copyAsPrompt({ kind: "goal", goal, graph })).toBe(`[Progressor] Goal "Ship OAuth login" (active, claimed by Session s-7f3a)
Ref: progressor://login
Location: .progressor/roadmap.md:5
Plan File: .progressor/goals/login.md
Progress: 2 of 4 Tasks done
Current Task: t4 "Callback route" (line 11)
Open Detour: d2 "Logger refactor" (line 24), branched from t4. Reason: Callback errors were unreadable
Next Task: t5 "Session storage" (line 15)

Read .progressor/goals/login.md (or call get_item with progressor://login) before acting on it.`);
  });

  it("marks an Idea as parked, so the Agent does not start building it", () => {
    expect(
      copyAsPrompt({
        kind: "idea",
        file: ROADMAP,
        idea: { id: "i1", ref: "progressor://roadmap/i1", title: "Magic-link login", line: 20, notes: ["From the Developer"], promotedTo: undefined },
      }),
    ).toBe(`[Progressor] Idea i1 "Magic-link login" (parked)
Ref: progressor://roadmap/i1
Location: .progressor/roadmap.md:20
Note: From the Developer

This Idea is parked, not planned: do not build it unless I ask you to promote it to a Task or Goal. Read .progressor/roadmap.md:20 (or call get_item with progressor://roadmap/i1) for details.`);
  });

  it("quotes a Standing Instruction", () => {
    expect(
      copyAsPrompt({
        kind: "standing instruction",
        file: ROADMAP,
        instruction: { id: "s1", ref: "progressor://roadmap/s1", text: "Ask me before recalibrating", line: 25 },
      }),
    ).toBe(`[Progressor] Standing Instruction s1 "Ask me before recalibrating"
Ref: progressor://roadmap/s1
Location: .progressor/roadmap.md:25

Read .progressor/roadmap.md:25 (or call get_item with progressor://roadmap/s1) before acting on it.`);
  });
});
