import { describe, expect, it } from "vitest";
import { buildGoalGraph, withoutDetours } from "../src/dashboard/graph.js";
import { parsePlanFile } from "../src/planFile.js";
import { edgePath, positionOf } from "../src/ui/geometry.js";
import { checklistRows, pickView } from "../src/ui/views.js";

const PLAN = `# Ship OAuth login

## Tasks

- [x] Add provider config ^t1
- [-] Callback route ^t2
  - dropped by: ^d2
- [x] Swap session library ^t3
  - added by: ^d2
- [/] Callback route ^t4
  - added by: ^d2

## Detour: Fix flaky CI test ^d1

- branched from: ^t1
- reason: CI kept failing
- status: merged back

## Detour: Session library lacks PKCE ^d2

- branched from: ^t2
- reason: The provider requires PKCE
- status: recalibrated

## Detour: Upgrade Node ^d3

- reason: The new API needs Node 22
- status: open
`;
const graph = buildGoalGraph(parsePlanFile(PLAN, "login"));
const rows = (g = graph) => checklistRows(g).map((r) => [r.task?.id ?? "-", r.detours.map((d) => d.id)]);

describe("the checklist view", () => {
  it("lists the Tasks in plan order with each Detour under the Task it hangs off on the map", () => {
    expect(rows()).toEqual([
      ["t1", ["d1"]],
      ["t2", ["d2"]],
      ["t3", ["d3"]],
      ["t4", []],
    ]);
  });

  it("puts a Detour with nothing to branch from before the first Task", () => {
    const g = buildGoalGraph(parsePlanFile("# G\n\n## Tasks\n\n- [ ] One ^t1\n\n## Detour: Set up ^d1\n\n- status: open\n", "g"));
    expect(rows(g)).toEqual([
      ["-", ["d1"]],
      ["t1", []],
    ]);
  });

  it("leaves the Detours out when they are switched off", () => {
    expect(rows(withoutDetours(graph))).toEqual([
      ["t1", []],
      ["t2", []],
      ["t3", []],
      ["t4", []],
    ]);
  });
});

describe("choosing a view", () => {
  it("takes the view from the address, then the browser's last choice, else the horizontal map", () => {
    expect(pickView("?view=checklist", "vertical")).toBe("checklist");
    expect(pickView("?project=x", "vertical")).toBe("vertical");
    expect(pickView("", undefined)).toBe("horizontal");
    expect(pickView("?view=nonsense", "also-nonsense")).toBe("horizontal");
  });
});

describe("the vertical map", () => {
  it("runs the plan top to bottom, with branches to the right", () => {
    const at = (step: number, lane: number, o: "horizontal" | "vertical") => positionOf({ step, lane }, o);
    // a later stop sits further down (vertical) or further right (horizontal)
    expect(at(3, 0, "vertical")).toMatchObject({ x: 0 });
    expect(at(3, 0, "vertical").y).toBeGreaterThan(at(2, 0, "vertical").y);
    expect(at(3, 0, "horizontal")).toMatchObject({ y: 0 });
    expect(at(3, 0, "horizontal").x).toBeGreaterThan(at(2, 0, "horizontal").x);
    // a branch sits to the right (vertical) or below (horizontal) of its line
    expect(at(0, 2, "vertical")).toMatchObject({ y: 0 });
    expect(at(0, 2, "vertical").x).toBeGreaterThan(0);
    expect(at(0, 2, "horizontal")).toMatchObject({ x: 0 });
    expect(at(0, 2, "horizontal").y).toBeGreaterThan(0);
  });

  it("curves lines along the direction of travel", () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 100, y: 200 }, "plan", "vertical")).toBe("M0,0 C0,100 100,100 100,200");
    expect(edgePath({ x: 0, y: 0 }, { x: 200, y: 100 }, "plan", "horizontal")).toBe("M0,0 C100,0 100,100 200,100");
  });
});
