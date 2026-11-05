import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChangelog, spans } from "../src/ui/changelog.js";

describe("What's new", () => {
  it("reads releases, headings, paragraphs and lists with sub-items", () => {
    const log = parseChangelog([
      "# Changelog", "", "About these notes.", "",
      "## 1.1.0 · A wishlist", "", "Some words", "that go on.", "",
      "### Wishlist", "", "- **One** thing", "- Two", "  - two a", "  - two b", "    still b", "",
      "## 1.0.0", "", "- First",
    ].join("\r\n"));
    expect(log.intro).toEqual(["About these notes."]);
    expect(log.releases.map((r) => [r.version, r.name])).toEqual([["1.1.0", "A wishlist"], ["1.0.0", undefined]]);
    expect(log.releases[0]!.blocks).toEqual([
      { kind: "p", text: "Some words that go on." },
      { kind: "h", text: "Wishlist" },
      { kind: "list", items: [{ text: "**One** thing", sub: [] }, { text: "Two", sub: ["two a", "two b still b"] }] },
    ]);
  });

  it("picks out bold, italic, code and links, resolving relative links against a base", () => {
    expect(spans("a **b `c`** *d* [e](docs/x.md#y) [f](https://x.org) g", "https://h/")).toEqual([
      { kind: "text", text: "a " },
      { kind: "b", children: [{ kind: "text", text: "b " }, { kind: "code", text: "c" }] },
      { kind: "text", text: " " },
      { kind: "i", children: [{ kind: "text", text: "d" }] },
      { kind: "text", text: " " },
      { kind: "link", href: "https://h/docs/x.md#y", children: [{ kind: "text", text: "e" }] },
      { kind: "text", text: " " },
      { kind: "link", href: "https://x.org", children: [{ kind: "text", text: "f" }] },
      { kind: "text", text: " g" },
    ]);
    expect(spans("[e](docs/x.md)")).toEqual([{ kind: "link", href: undefined, children: [{ kind: "text", text: "e" }] }]);
    expect(spans("`[ ]` not tried, 2 * 3")).toEqual([{ kind: "code", text: "[ ]" }, { kind: "text", text: " not tried, 2 * 3" }]);
  });

  it("reads Progressor's own changelog, newest release first, with every release named", () => {
    const log = parseChangelog(readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"));
    expect(log.releases.length).toBeGreaterThan(10);
    expect(log.releases.some((r) => r.version === "1.2.1")).toBe(true);
    for (const r of log.releases) expect(r.blocks.length, r.title).toBeGreaterThan(0);
  });
});
