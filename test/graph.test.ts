import { describe, expect, it } from "vitest";
import { buildGoalGraph, withoutDetours } from "../src/dashboard/graph.js";
import { parsePlanFile } from "../src/planFile.js";

const graphOf = (markdown: string) => buildGoalGraph(parsePlanFile(markdown, "g"));

/** Compact view of the layout: id@step,lane per node and from>to:kind per edge. */
function layout(markdown: string) {
  const g = graphOf(markdown);
  return {
    nodes: g.nodes.map((n) => `${n.id}@${n.step},${n.lane}`),
    edges: g.edges.map((e) => `${e.from}>${e.to}:${e.kind}`),
  };
}

describe("the metro map of a Goal", () => {
  it("lays a plain Task list out as one line", () => {
    expect(
      layout(`# G

## Tasks

- [x] One ^t1
- [/] Two ^t2
- [ ] Three ^t3
`),
    ).toEqual({
      nodes: ["t1@0,0", "t2@1,0", "t3@2,0"],
      edges: ["t1>t2:plan", "t2>t3:plan"],
    });
  });

  it("draws a merged-back Detour as a branch that rejoins the line at the next Task", () => {
    expect(
      layout(`# G

## Tasks

- [x] One ^t1
- [/] Two ^t2
- [ ] Three ^t3

## Detour: Fix flaky CI ^d1

- branched from: ^t1
- reason: CI blocked every push
- status: merged back
`),
    ).toEqual({
      nodes: ["t1@0,0", "t2@2,0", "t3@3,0", "d1@1,1"],
      edges: ["t1>t2:plan", "t2>t3:plan", "t1>d1:detour", "d1>t2:merge"],
    });
  });

  it("starts a new line from a Recalibration and leaves the dropped Tasks on the old one", () => {
    const markdown = `# Ship OAuth login

## Tasks

- [x] Add provider config ^t1
- [-] Callback route ^t2
  - dropped by: ^d2
- [-] Session storage ^t3
  - dropped by: ^d2
- [-] Tests ^t4
  - dropped by: ^d2
- [x] Swap to a PKCE-capable session library ^t5
  - added by: ^d2
- [/] Callback route ^t6
  - added by: ^d2
- [ ] Session storage ^t7
  - added by: ^d2
- [ ] End-to-end tests ^t8
  - added by: ^d2

## Detour: Fix flaky CI test ^d1

- branched from: ^t1
- reason: CI kept failing
- status: merged back

## Detour: Session library lacks PKCE ^d2

- branched from: ^t2
- reason: The provider requires PKCE
- status: recalibrated

## Detour: Logger refactor ^d3

- branched from: ^t6
- reason: Callback errors were unreadable
- status: open
`;
    expect(layout(markdown)).toEqual({
      nodes: ["t1@0,0", "t2@2,0", "t3@3,0", "t4@4,0", "t5@4,1", "t6@5,1", "t7@6,1", "t8@7,1", "d1@1,1", "d2@3,1", "d3@6,2"],
      edges: [
        "t1>t2:plan",
        "t2>t3:plan",
        "t3>t4:plan",
        "t5>t6:plan",
        "t6>t7:plan",
        "t7>t8:plan",
        "t1>d1:detour",
        "d1>t2:merge",
        "t2>d2:detour",
        "d2>t5:recalibrate",
        "t6>d3:detour",
      ],
    });
  });

  it("sends a returned Detour back to its Task and marks the Tasks it appended", () => {
    const markdown = `# Billing

## Tasks

- [x] Create customers ^t1
- [/] Checkout flow ^t2
- [ ] Webhooks ^t3
- [ ] Pricing table redesign ^t4
  - added by: ^d1

## Detour: Pricing table redesign ^d1

- branched from: ^t2
- reason: Started restyling while wiring checkout
- status: returned
`;
    expect(layout(markdown)).toEqual({
      nodes: ["t1@0,0", "t2@1,0", "t3@2,0", "t4@3,0", "d1@2,1"],
      edges: ["t1>t2:plan", "t2>t3:plan", "t3>t4:plan", "t2>d1:detour", "d1>t2:return"],
    });
    const fromDetour = graphOf(markdown).nodes.filter((n) => n.kind === "task" && n.fromDetour);
    expect(fromDetour.map((n) => n.id)).toEqual(["t4"]);
  });

  it("hangs a Detour with no Task in progress off the last finished Task", () => {
    expect(
      layout(`# G

## Tasks

- [x] One ^t1
- [x] Two ^t2
- [ ] Three ^t3

## Detour: Upgrade Node ^d1

- reason: The new API needs Node 22
- status: open
`),
    ).toEqual({
      nodes: ["t1@0,0", "t2@1,0", "t3@2,0", "d1@2,1"],
      edges: ["t1>t2:plan", "t2>t3:plan", "t2>d1:detour"],
    });
  });

  it("puts a Detour on a Goal with nothing done at the start, unconnected", () => {
    expect(
      layout(`# G

## Tasks

- [ ] One ^t1

## Detour: Set up the repo ^d1

- reason: Nothing builds yet
- status: open
`),
    ).toEqual({ nodes: ["t1@0,0", "d1@0,1"], edges: [] });
  });

  it("keeps Detours that overlap in time on separate lanes", () => {
    expect(
      layout(`# G

## Tasks

- [x] One ^t1
- [-] Two ^t2
  - dropped by: ^d1
- [/] New two ^t3
  - added by: ^d1

## Detour: Rethink ^d1

- branched from: ^t1
- status: recalibrated

## Detour: Side fix ^d2

- branched from: ^t1
- status: merged back
`).nodes,
    ).toEqual(["t1@0,0", "t2@2,0", "t3@2,1", "d1@1,1", "d2@1,2"]);
  });

  it("can hide the Detours, joining each new line straight to the Task it branched from", () => {
    const g = withoutDetours(
      graphOf(`# G

## Tasks

- [x] One ^t1
- [-] Two ^t2
  - dropped by: ^d2
- [/] New two ^t3
  - added by: ^d2

## Detour: Side fix ^d1

- branched from: ^t1
- status: merged back

## Detour: Rethink ^d2

- branched from: ^t2
- status: recalibrated
`),
    );
    expect(g.nodes.map((n) => n.id)).toEqual(["t1", "t2", "t3"]);
    expect(g.edges.map((e) => `${e.from}>${e.to}:${e.kind}`)).toEqual(["t1>t2:plan", "t2>t3:plan"]);
  });
});
