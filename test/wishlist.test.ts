import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { formatWishlist, MAX_WISH_LENGTH, parseWishlist } from "../src/wishlist.js";
import { tempDir } from "./tmp.js";

let root: string;
const NOW = new Date("2026-10-31T10:00:00.000Z");
const project = () => new Project({ root, session: { id: "s-a", pid: 100 }, isAlive: () => true, now: () => NOW });
const file = () => readFileSync(join(root, ".progressor", "wishlist.md"), "utf8");

beforeEach(() => {
  root = tempDir("progressor-");
});

describe("parseWishlist and formatWishlist", () => {
  it("reads open and granted wishes with their IDs", () => {
    expect(parseWishlist("# Wishlist\n\n- [ ] Dark mode on phones ^w1\n- [x] Export to PDF ^w3\n")).toEqual([
      { id: "w1", text: "Dark mode on phones", granted: false },
      { id: "w3", text: "Export to PDF", granted: true },
    ]);
  });
  it("is empty for a missing or empty file", () => {
    expect(parseWishlist("")).toEqual([]);
    expect(parseWishlist("# Wishlist\n")).toEqual([]);
  });
  it("gives a wish written by hand without an ID the next free one", () => {
    expect(parseWishlist("- [ ] One ^w2\n- [ ] Two\n- Three\n")).toEqual([
      { id: "w2", text: "One", granted: false },
      { id: "w3", text: "Two", granted: false },
      { id: "w4", text: "Three", granted: false },
    ]);
  });
  it("writes back what it reads", () => {
    const text = "# Wishlist\n\n- [ ] Dark mode on phones ^w1\n- [x] Export to PDF ^w3\n";
    expect(formatWishlist(parseWishlist(text))).toBe(text);
    expect(formatWishlist([])).toBe("# Wishlist\n");
  });
});

describe("a project's wishlist", () => {
  it("starts empty", () => {
    expect(project().wishes()).toEqual([]);
  });

  it("adds wishes with new IDs, kept in wishlist.md", () => {
    const p = project();
    expect(p.addWish("  Dark mode on phones ")).toEqual({ id: "w1", text: "Dark mode on phones", granted: false });
    expect(p.addWish("Export to PDF").id).toBe("w2");
    expect(file()).toBe("# Wishlist\n\n- [ ] Dark mode on phones ^w1\n- [ ] Export to PDF ^w2\n");
    expect(project().wishes().map((w) => w.text)).toEqual(["Dark mode on phones", "Export to PDF"]);
  });

  it("never reuses the ID of a removed wish while a later one is left", () => {
    const p = project();
    p.addWish("One");
    p.addWish("Two");
    p.removeWish("w1");
    expect(p.addWish("Three").id).toBe("w3");
  });

  it("rewords a wish and ticks it off or back", () => {
    const p = project();
    p.addWish("Dark mode");
    expect(p.updateWish("w1", { text: "Dark mode on phones" })).toEqual({ id: "w1", text: "Dark mode on phones", granted: false });
    expect(p.updateWish("w1", { granted: true }).granted).toBe(true);
    expect(file()).toBe("# Wishlist\n\n- [x] Dark mode on phones ^w1\n");
    expect(p.updateWish("w1", { granted: false }).granted).toBe(false);
  });

  it("removes a wish and says which it was", () => {
    const p = project();
    p.addWish("One");
    p.addWish("Two");
    expect(p.removeWish("w1")).toEqual({ id: "w1", text: "One", granted: false });
    expect(p.wishes().map((w) => w.id)).toEqual(["w2"]);
  });

  it("refuses empty, multi-line, too long and unknown wishes", () => {
    const p = project();
    expect(() => p.addWish("  ")).toThrow(/Write the wish first/);
    expect(() => p.addWish("x".repeat(MAX_WISH_LENGTH + 1))).toThrow(/too long/);
    expect(p.addWish("One\ntwo").text).toBe("One two");
    expect(() => p.updateWish("w9", { granted: true })).toThrow(/^No wish w9/);
    expect(() => p.removeWish("w9")).toThrow(/^No wish w9/);
    expect(() => p.updateWish("w1", { text: " " })).toThrow(/Write the wish first/);
  });

  it("keeps a wish that ends in something like an ID as its own words", () => {
    const p = project();
    p.addWish("Rename ^w7");
    expect(project().wishes()).toEqual([{ id: "w1", text: "Rename ^w7", granted: false }]);
  });

  it("reads a wishlist edited by hand", () => {
    project().addWish("One");
    writeFileSync(join(root, ".progressor", "wishlist.md"), "# Wishlist\n\n- [ ] One ^w1\n- [ ] Written by hand\n");
    expect(project().wishes().map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("is in the session status and the overview", () => {
    const p = project();
    p.addWish("Dark mode on phones");
    expect(p.sessionStatus().wishes).toEqual([{ id: "w1", text: "Dark mode on phones", granted: false }]);
    expect(p.overview().wishes).toHaveLength(1);
  });
});
