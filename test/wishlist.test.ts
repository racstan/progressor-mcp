import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, Project } from "../src/project.js";
import { formatWishlist, parseWishlist } from "../src/wishlist.js";
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

  it("has no length limit", () => {
    const p = project();
    const long = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(" ");
    expect(p.addWish(long).text).toBe(long);
    expect(p.updateWish("w1", { text: `${long} more` }).text).toBe(`${long} more`);
    expect(project().wishes()[0]!.text).toBe(`${long} more`);
  });

  it("refuses empty and unknown wishes and joins lines", () => {
    const p = project();
    expect(() => p.addWish("  ")).toThrow(/Write the wish first/);
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

  describe("attachments", () => {
    const attached = (p: Project, name: string, data = "data") => p.attachToWish("w1", name, Buffer.from(data));

    it("keeps a file under .progressor/attachments/<wish>/ and lists its path on the wish", () => {
      const p = project();
      p.addWish("Make the logo like this");
      const a = attached(p, "logo.png", "PNG!");
      expect(a).toMatchObject({ name: "logo.png", size: 4, path: ".progressor/attachments/w1/1-logo.png" });
      expect(readFileSync(join(root, a.path))).toEqual(Buffer.from("PNG!"));
      expect(project().wishes()[0]!.attachments).toEqual([a]);
      expect(file()).toBe("# Wishlist\n\n- [ ] Make the logo like this ^w1\n");
    });

    it("leaves attachments off a wish with none, and numbers files so same names never clash", () => {
      const p = project();
      p.addWish("One");
      expect(p.wishes()[0]).toEqual({ id: "w1", text: "One", granted: false });
      expect(attached(p, "a.pdf").path).toBe(".progressor/attachments/w1/1-a.pdf");
      expect(attached(p, "a.pdf").path).toBe(".progressor/attachments/w1/2-a.pdf");
    });

    it("never builds a path from the name it came with", () => {
      const p = project();
      p.addWish("One");
      const a = attached(p, "..\\..\\..\\evil name?.PNG");
      expect(a.path).toMatch(/^\.progressor\/attachments\/w1\/1-[\w.\- ]+\.png$/);
      expect(a.path).not.toContain("..");
      expect(a.name).toBe("evil name?.PNG");
      expect(existsSync(join(root, a.path))).toBe(true);
    });

    it("refuses empty files, files over the limit and unknown wishes", () => {
      const p = project();
      p.addWish("One");
      expect(() => attached(p, "a.txt", "")).toThrow(/empty/);
      expect(() => p.attachToWish("w1", "big.bin", Buffer.alloc(MAX_ATTACHMENT_BYTES + 1))).toThrow(/MB/);
      expect(() => p.attachToWish("w9", "a.txt", Buffer.from("x"))).toThrow(/^No wish w9/);
    });

    it("finds a stored file only by a name the wish lists, and takes one away", () => {
      const p = project();
      p.addWish("One");
      const a = attached(p, "shot.png");
      expect(p.attachmentFile("w1", "1-shot.png")).toMatchObject({ path: join(root, a.path), mime: "image/png", name: "shot.png" });
      expect(p.attachmentFile("w1", "../../wishlist.md")).toBeUndefined();
      expect(p.attachmentFile("w2", "1-shot.png")).toBeUndefined();
      expect(p.removeAttachment("w1", "1-shot.png").name).toBe("shot.png");
      expect(existsSync(join(root, a.path))).toBe(false);
      expect(p.wishes()[0]!.attachments).toBeUndefined();
    });

    it("serves only images and PDFs as themselves; anything else is a download", () => {
      const p = project();
      p.addWish("One");
      attached(p, "a.pdf");
      attached(p, "b.html");
      expect(p.attachmentFile("w1", "1-a.pdf")).toMatchObject({ mime: "application/pdf", inline: true });
      expect(p.attachmentFile("w1", "2-b.html")).toMatchObject({ mime: "application/octet-stream", inline: false });
    });

    it("is removed with its wish, and kept out of git", () => {
      const p = project();
      p.addWish("One");
      attached(p, "a.png");
      p.removeWish("w1");
      expect(existsSync(join(root, ".progressor", "attachments", "w1"))).toBe(false);
    });

    it("keeps the wish's files out of git", () => {
      const p = project();
      p.addWish("One");
      attached(p, "a.png");
      expect(readFileSync(join(root, ".progressor", ".gitignore"), "utf8")).toMatch(/^attachments\/$/m);
    });
  });

  it("is in the session status and the overview", () => {
    const p = project();
    p.addWish("Dark mode on phones");
    expect(p.sessionStatus().wishes).toEqual([{ id: "w1", text: "Dark mode on phones", granted: false }]);
    expect(p.overview().wishes).toHaveLength(1);
  });
});
