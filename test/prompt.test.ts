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

// What the Developer pastes into their AI chat: a short pointer, since the AI has Progressor and
// looks the item up itself. They type what they want after it.
describe("Copy for your AI", () => {
  it("points at a step: what it is, where it stands, and how to look it up", () => {
    expect(copyAsPrompt({ kind: "node", node: node("t4"), goal, graph })).toBe(
      '[Progressor] Step t4 "Callback route" (in progress) in goal "Ship OAuth login". Look it up with get_item progressor://login/t4 (.progressor/goals/login.md:11).',
    );
  });

  it("says a cancelled step is not part of the plan", () => {
    expect(copyAsPrompt({ kind: "node", node: node("t2"), goal, graph })).toBe(
      '[Progressor] Step t2 "Callback route" (cancelled, not part of the plan) in goal "Ship OAuth login". Look it up with get_item progressor://login/t2 (.progressor/goals/login.md:6).',
    );
  });

  it("points at a side trip", () => {
    expect(copyAsPrompt({ kind: "node", node: node("d2"), goal, graph })).toBe(
      '[Progressor] Side trip d2 "Logger refactor" (open) in goal "Ship OAuth login". Look it up with get_item progressor://login/d2 (.progressor/goals/login.md:24).',
    );
  });

  it("points at a goal, with how far along it is", () => {
    expect(copyAsPrompt({ kind: "goal", goal, graph })).toBe(
      '[Progressor] Goal "Ship OAuth login" (active, 2 of 4 steps done). Look it up with get_item progressor://login (.progressor/goals/login.md).',
    );
  });

  it("tells the AI how to reopen a finished goal", () => {
    expect(copyAsPrompt({ kind: "goal", goal: { ...goal, status: "done", claim: undefined }, graph })).toBe(
      '[Progressor] Goal "Ship OAuth login" (finished, 2 of 4 steps done). Look it up with get_item progressor://login (.progressor/goals/login.md). For more work on it, reopen it with claim_goal.',
    );
  });

  it("counts released steps as done", () => {
    const g = buildGoalGraph(parsePlanFile("# G\n\n## Tasks\n\n- [x] One ^t1\n  - state: released\n- [/] Two ^t2\n  - state: with a helper\n", "login"));
    expect(copyAsPrompt({ kind: "goal", goal, graph: g })).toContain("(active, 1 of 2 steps done)");
  });

  it("marks an idea as parked, so the AI does not start building it", () => {
    expect(
      copyAsPrompt({
        kind: "idea",
        file: ROADMAP,
        idea: { id: "i1", ref: "progressor://roadmap/i1", title: "Magic-link login", line: 20, notes: ["From the Developer"], promotedTo: undefined },
      }),
    ).toBe('[Progressor] Idea i1 "Magic-link login" (parked: not planned, do not build it unless I ask). Look it up with get_item progressor://roadmap/i1 (.progressor/roadmap.md:20).');
  });

  it("points at a standing instruction", () => {
    expect(
      copyAsPrompt({
        kind: "standing instruction",
        file: ROADMAP,
        instruction: { id: "s1", ref: "progressor://roadmap/s1", text: "Ask me before recalibrating", line: 25, hard: false },
      }),
    ).toBe('[Progressor] Standing Instruction s1 "Ask me before recalibrating". Look it up with get_item progressor://roadmap/s1 (.progressor/roadmap.md:25).');
  });
});
