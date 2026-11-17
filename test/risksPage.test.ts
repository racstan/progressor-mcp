import { describe, expect, it } from "vitest";
import { PAGE_HASH, pageHeading, routeFromHash } from "../src/ui/route.js";
import { gridCell, goalStateWords, impactWords, likelihoodWords, riskStatusWords, scoreWords, splitRisks } from "../src/ui/risks.js";

describe("the Risks page", () => {
  it("has its own address and heading", () => {
    expect(routeFromHash(PAGE_HASH.risks)).toEqual({ page: "risks" });
    expect(pageHeading("risks", "Bindery")).toBe("Bindery Risks");
  });

  it("says how likely and how bad in plain words", () => {
    expect(likelihoodWords("high")).toBe("Likely");
    expect(impactWords("low")).toBe("Minor");
    expect(scoreWords("high", "high", 9)).toBe("Likely and severe: 9 out of 9");
  });

  it("places a risk on the 3 by 3 grid, likely to the right and severe at the top", () => {
    expect(gridCell("high", "high")).toEqual({ col: 2, row: 0 });
    expect(gridCell("low", "low")).toEqual({ col: 0, row: 2 });
    expect(gridCell("medium", "high")).toEqual({ col: 1, row: 0 });
  });

  it("names a linked goal's state, including one that is gone", () => {
    expect(["done", "dropped", "planned", "active", undefined].map(goalStateWords)).toEqual(["Finished", "Cancelled", "Not started", "In progress", "No longer in the plan"]);
  });

  it("folds reduced and closed risks away from the open ones", () => {
    const s = splitRisks([{ status: "open" }, { status: "reduced" }, { status: "closed" }, { status: "open" }]);
    expect([s.open.length, s.quiet.length]).toEqual([2, 2]);
    expect(riskStatusWords("reduced")).toBe("Reduced");
  });
});
