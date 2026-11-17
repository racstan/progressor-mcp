import { describe, expect, it } from "vitest";
import { busyClass, skeletonLines } from "../src/ui/Loading.js";

describe("loading look", () => {
  it("draws more shimmering lines for a page than a card, and none inline", () => {
    expect(skeletonLines("page").length).toBeGreaterThan(skeletonLines("card").length);
    expect(skeletonLines("inline")).toEqual([]);
    for (const w of [...skeletonLines("page"), ...skeletonLines("card")]) expect(w).toBeGreaterThan(0), expect(w).toBeLessThanOrEqual(100);
  });

  it("marks a button busy only while it is sending", () => {
    expect(busyClass("btn small", true)).toBe("btn small busy");
    expect(busyClass("btn small", false)).toBe("btn small");
    expect(busyClass("btn", undefined)).toBe("btn");
  });
});
