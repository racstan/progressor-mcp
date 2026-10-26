import { describe, expect, it } from "vitest";
import { contextBlocks, contextFromHash } from "../src/ui/context.js";

describe("contextBlocks", () => {
  it("is empty for empty text", () => {
    expect(contextBlocks("")).toEqual([]);
    expect(contextBlocks("  \n\n ")).toEqual([]);
  });
  it("splits paragraphs at blank lines and joins wrapped lines", () => {
    expect(contextBlocks("One\nstill one\n\nTwo")).toEqual([
      { kind: "paragraph", text: "One still one" },
      { kind: "paragraph", text: "Two" },
    ]);
  });
  it("reads bullet and numbered lists", () => {
    expect(contextBlocks("Facts:\n\n- a\n- b\n\n1. x\n2) y")).toEqual([
      { kind: "paragraph", text: "Facts:" },
      { kind: "list", ordered: false, items: ["a", "b"] },
      { kind: "list", ordered: true, items: ["x", "y"] },
    ]);
  });
  it("keeps a paragraph that only starts with a list line as a paragraph", () => {
    expect(contextBlocks("- a\nand more")).toEqual([{ kind: "paragraph", text: "- a and more" }]);
  });
});

describe("contextFromHash", () => {
  it("matches only the context address", () => {
    expect(contextFromHash("#/context")).toBe(true);
    expect(contextFromHash("#/goal/g1")).toBe(false);
    expect(contextFromHash("")).toBe(false);
  });
});
