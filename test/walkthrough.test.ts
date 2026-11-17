import { describe, expect, it } from "vitest";
import { type WalkItem, type WalkState, mark, orderItems, progress, queue, skip } from "../src/ui/walkthrough.js";

const item = (key: string, added?: string): WalkItem => ({ key, projectId: "p", goalId: "g", goalTitle: "G", projectName: "P", testId: key, ...(added ? { added } : {}) });
const fresh: WalkState = { handled: [], skipped: [] };

describe("orderItems", () => {
  it("puts the oldest first across goals, undated ones last, keeping their order otherwise", () => {
    const items = [item("c"), item("b", "2026-11-02T00:00:00Z"), item("a", "2026-11-01T00:00:00Z"), item("d")];
    expect(orderItems(items).map((i) => i.key)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("the queue", () => {
  const items = orderItems([item("a", "2026-11-01T00:00:00Z"), item("b", "2026-11-02T00:00:00Z"), item("c", "2026-11-03T00:00:00Z")]);
  it("starts with the oldest", () => {
    expect(queue(items, fresh).map((i) => i.key)).toEqual(["a", "b", "c"]);
  });
  it("sends a skipped one to the end, after the rest", () => {
    expect(queue(items, skip(fresh, "a")).map((i) => i.key)).toEqual(["b", "c", "a"]);
  });
  it("keeps skipped ones in the order they were skipped, and skipping again moves one to the very end", () => {
    let s = skip(skip(fresh, "a"), "b");
    expect(queue(items, s).map((i) => i.key)).toEqual(["c", "a", "b"]);
    s = skip(s, "a");
    expect(queue(items, s).map((i) => i.key)).toEqual(["c", "b", "a"]);
  });
  it("drops marked ones, even if skipped before", () => {
    const s = mark(skip(fresh, "a"), "a");
    expect(queue(items, s).map((i) => i.key)).toEqual(["b", "c"]);
  });
  it("is empty when all are marked", () => {
    expect(queue(items, mark(mark(mark(fresh, "a"), "b"), "c"))).toEqual([]);
  });
});

describe("progress", () => {
  it("counts the one shown among all, and is done at the end", () => {
    expect(progress(7, fresh)).toEqual({ position: 1, total: 7, done: false });
    expect(progress(7, { handled: ["a", "b"], skipped: [] })).toEqual({ position: 3, total: 7, done: false });
    expect(progress(2, { handled: ["a", "b"], skipped: [] })).toEqual({ position: 2, total: 2, done: true });
  });
});
