import { describe, expect, it } from "vitest";
import { inlineCode, plainText } from "../src/ui/text.js";

describe("inlineCode", () => {
  it("leaves text without backticks as one plain segment", () => {
    expect(inlineCode("Serve the login page")).toEqual([{ code: false, text: "Serve the login page" }]);
  });

  it("splits backtick spans into code segments", () => {
    expect(inlineCode("`progressor-mcp hook <event>` reads stdin")).toEqual([
      { code: true, text: "progressor-mcp hook <event>" },
      { code: false, text: " reads stdin" },
    ]);
  });

  it("handles several spans and text between them", () => {
    expect(inlineCode("set `a` then `b`.")).toEqual([
      { code: false, text: "set " },
      { code: true, text: "a" },
      { code: false, text: " then " },
      { code: true, text: "b" },
      { code: false, text: "." },
    ]);
  });

  it("keeps an unmatched backtick as plain text", () => {
    expect(inlineCode("a `b and `c` d")).toEqual([
      { code: false, text: "a " },
      { code: true, text: "b and " },
      { code: false, text: "c` d" },
    ]);
    expect(inlineCode("it's a ` stray")).toEqual([{ code: false, text: "it's a ` stray" }]);
  });

  it("keeps an empty pair of backticks as plain text", () => {
    expect(inlineCode("empty `` here")).toEqual([{ code: false, text: "empty `` here" }]);
  });

  it("returns nothing for an empty string", () => {
    expect(inlineCode("")).toEqual([]);
  });
});

describe("plainText", () => {
  it("drops the backticks around code spans", () => {
    expect(plainText("`progressor-mcp hook <event>` reads stdin")).toBe("progressor-mcp hook <event> reads stdin");
  });

  it("keeps unmatched backticks", () => {
    expect(plainText("a ` stray")).toBe("a ` stray");
  });
});
