import { describe, expect, it } from "vitest";
import { parseRoadmap } from "../src/roadmap.js";

const example = `# Roadmap

## Goals

- [/] [Ship OAuth login](goals/ship-oauth-login.md) ^ship-oauth-login
  - claimed by: s-7f3a (pid 18244) since 2026-10-18T15:02:11.000Z
- [ ] [Billing](goals/billing.md) ^billing
- [/] Search ^search
- [x] [Project setup](goals/project-setup.md) ^project-setup

## Ideas

- Remember-me checkbox on the login form ^i1
- Rate-limit the token endpoint ^i2
  - promoted to: progressor://ship-oauth-login/t6

## Standing Instructions

- Ask me before recalibrating ^s1
- Run the tests before completing a Task ^s2
`;

describe("Roadmap parsing", () => {
  it("reads Goals in order with their status and Claim", () => {
    const roadmap = parseRoadmap(example);

    expect(roadmap.goals.map((g) => [g.id, g.title, g.status, g.line])).toEqual([
      ["ship-oauth-login", "Ship OAuth login", "active", 5],
      ["billing", "Billing", "planned", 7],
      ["search", "Search", "paused", 8],
      ["project-setup", "Project setup", "done", 9],
    ]);
    expect(roadmap.goals[0]!.claim).toEqual({
      session: "s-7f3a",
      pid: 18244,
      since: "2026-10-18T15:02:11.000Z",
    });
    expect(roadmap.goals[0]!.ref).toBe("progressor://ship-oauth-login");
    expect(roadmap.goals[1]!.claim).toBeUndefined();
  });

  it("reads Ideas, including where a promoted Idea went", () => {
    const roadmap = parseRoadmap(example);

    expect(roadmap.ideas).toEqual([
      { id: "i1", ref: "progressor://roadmap/i1", title: "Remember-me checkbox on the login form", line: 13, notes: [], promotedTo: undefined },
      { id: "i2", ref: "progressor://roadmap/i2", title: "Rate-limit the token endpoint", line: 14, notes: [], promotedTo: "progressor://ship-oauth-login/t6" },
    ]);
  });

  it("reads Standing Instructions", () => {
    expect(parseRoadmap(example).standingInstructions).toEqual([
      { id: "s1", ref: "progressor://roadmap/s1", text: "Ask me before recalibrating", line: 19 },
      { id: "s2", ref: "progressor://roadmap/s2", text: "Run the tests before completing a Task", line: 20 },
    ]);
  });

  it("serialises an unchanged file back to the same text", () => {
    expect(parseRoadmap(example).toString()).toBe(example);
  });

  it("writes a Claim, then removes it on release leaving the Goal paused", () => {
    const roadmap = parseRoadmap(example);
    roadmap.setClaim("billing", { session: "s-1", pid: 7, since: "2026-10-18T16:00:00.000Z" });
    roadmap.setGoalStatus("billing", "started");

    expect(roadmap.toString()).toContain(
      "- [/] [Billing](goals/billing.md) ^billing\n  - claimed by: s-1 (pid 7) since 2026-10-18T16:00:00.000Z\n",
    );
    expect(roadmap.goal("billing")!.status).toBe("active");

    roadmap.setClaim("billing", undefined);
    expect(roadmap.goal("billing")!.status).toBe("paused");
    expect(roadmap.toString()).toContain("- [/] [Billing](goals/billing.md) ^billing\n- [/] Search");
  });

  it("creates the sections a new file needs", () => {
    const roadmap = parseRoadmap("");
    roadmap.addGoal("Ship OAuth login");
    roadmap.addIdea("Dark mode", "maybe after billing");
    roadmap.addStandingInstruction("Ask me before recalibrating");

    expect(roadmap.toString()).toBe(`# Roadmap

## Goals

- [ ] [Ship OAuth login](goals/ship-oauth-login.md) ^ship-oauth-login

## Ideas

- Dark mode ^i1
  - note: maybe after billing

## Standing Instructions

- Ask me before recalibrating ^s1
`);
  });

  it("gives each new Goal a unique slug", () => {
    const roadmap = parseRoadmap(example);
    expect(roadmap.addGoal("Billing!").id).toBe("billing-2");
    expect(roadmap.addGoal("Roadmap").id).toBe("roadmap-2");
  });

  it("gives hand-typed Goals, Ideas and Standing Instructions an ID", () => {
    const roadmap = parseRoadmap("## Goals\n- [ ] Billing ^billing\n- [ ] Billing\n## Ideas\n- Dark mode\n");
    expect(roadmap.goals.map((g) => g.id)).toEqual(["billing"]);
    roadmap.assignMissingIds();
    expect(roadmap.goals.map((g) => g.id)).toEqual(["billing", "billing-2"]);
    expect(roadmap.toString()).toBe("## Goals\n- [ ] Billing ^billing\n- [ ] Billing ^billing-2\n## Ideas\n- Dark mode ^i1\n");
  });
});

describe("Standing Instructions with line breaks", () => {
  it("keeps the rule on one line", () => {
    const roadmap = parseRoadmap("# Roadmap\n\n## Goals\n");
    roadmap.addStandingInstruction("Ask me\nbefore pushing");
    expect(parseRoadmap(roadmap.toString()).standingInstructions.map((s) => s.text)).toEqual(["Ask me before pushing"]);
  });
});

describe("changing Standing Instructions", () => {
  const roadmap = () => {
    const r = parseRoadmap("# Roadmap\n\n## Goals\n");
    r.addStandingInstruction("Ask before pushing");
    r.addStandingInstruction("Write tests first");
    return r;
  };

  it("changes a rule's text, keeping its ID", () => {
    const r = roadmap();
    r.setStandingInstruction("s1", "Ask before pushing\nor publishing");
    expect(parseRoadmap(r.toString()).standingInstructions.map((s) => [s.id, s.text])).toEqual([
      ["s1", "Ask before pushing or publishing"],
      ["s2", "Write tests first"],
    ]);
  });

  it("removes a rule", () => {
    const r = roadmap();
    r.removeStandingInstruction("s1");
    expect(parseRoadmap(r.toString()).standingInstructions.map((s) => [s.id, s.text])).toEqual([["s2", "Write tests first"]]);
  });

  it("names an unknown rule", () => {
    expect(() => roadmap().setStandingInstruction("s9", "x")).toThrow(/s9/);
    expect(() => roadmap().removeStandingInstruction("s9")).toThrow(/s9/);
  });
});
