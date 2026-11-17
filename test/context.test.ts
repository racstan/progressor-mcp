import { describe, expect, it } from "vitest";
import { contextBlocks, contextFromHash, contextWithCopied, rulesToCopy } from "../src/ui/context.js";

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

describe("copying the rules and context for everything into a project", () => {
  it("offers only the rules the project does not have yet, ignoring case and spacing", () => {
    const global = [{ id: "g1", text: "Use plain English", hard: false }, { id: "g2", text: "Never push", hard: true }];
    expect(rulesToCopy(global, [{ text: "use  plain english." }]).map((r) => r.id)).toEqual(["g2"]);
    expect(rulesToCopy(global, []).map((r) => r.id)).toEqual(["g1", "g2"]);
  });

  it("adds each part of the context under its own heading, skips one already there, and says when it would be too long", () => {
    expect(contextWithCopied("", [{ title: "About this computer", text: "Windows 11." }], 4000)).toEqual({ text: "About this computer:\nWindows 11.", added: 1, fits: true });
    expect(contextWithCopied("A web app.", [{ title: "About me", text: "Plain words." }, { title: "Empty", text: "  " }], 4000)).toEqual({
      text: "A web app.\n\nAbout me:\nPlain words.",
      added: 1,
      fits: true,
    });
    expect(contextWithCopied("Has it. Plain words.", [{ title: "About me", text: "Plain words." }], 4000)).toEqual({ text: "Has it. Plain words.", added: 0, fits: true });
    expect(contextWithCopied("x".repeat(3990), [{ title: "About me", text: "Plain words." }], 4000).fits).toBe(false);
  });
});
