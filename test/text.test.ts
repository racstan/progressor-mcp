import { describe, expect, it } from "vitest";
import { highlights, inlineCode, plainText } from "../src/ui/text.js";

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

  it("leaves out refs in brackets, which only the AI needs", () => {
    expect(plainText('Moved to the goal "Voice" (progressor://voice/t3)')).toBe('Moved to the goal "Voice"');
  });

  it("keeps unmatched backticks", () => {
    expect(plainText("a ` stray")).toBe("a ` stray");
  });
});

describe("highlights", () => {
  const kinds = (text: string) => highlights(text).filter((s) => s.kind !== "plain").map((s) => [s.kind, s.text]);

  it("leaves ordinary text as one plain segment", () => {
    expect(highlights("Serve the login page.")).toEqual([{ kind: "plain", text: "Serve the login page." }]);
    expect(highlights("")).toEqual([]);
  });

  it("finds the parts of a hand test worth looking at", () => {
    const text =
      'Restart the app (close its window, run start.ps1), open it in Chrome and go to Settings › Notifications › Desktop pop-ups. ' +
      'Follow what it says, then click "Send a test pop-up": a Windows pop-up should appear.';
    expect(kinds(text)).toEqual([
      ["file", "start.ps1"],
      ["path", "Settings › Notifications › Desktop pop-ups"],
      ["label", "Send a test pop-up"],
    ]);
    expect(highlights(text).map((s) => (s.kind === "label" ? `"${s.text}"` : s.text)).join("")).toBe(text);
  });

  it("keeps backtick code as code, and finds nothing inside it", () => {
    expect(highlights('Run `npm test` and "Retry"')).toEqual([
      { kind: "plain", text: "Run " },
      { kind: "code", text: "npm test" },
      { kind: "plain", text: " and " },
      { kind: "label", text: "Retry" },
    ]);
    expect(kinds('`open "a.json"`')).toEqual([["code", 'open "a.json"']]);
  });

  it("finds things to click in straight or curly quotes, but not long quotes or apostrophes", () => {
    expect(kinds("press “Works” or \"Doesn't work\"")).toEqual([["label", "Works"], ["label", "Doesn't work"]]);
    expect(kinds(`it's the user's choice`)).toEqual([]);
    expect(kinds(`"${"word ".repeat(20)}"`)).toEqual([]);
  });

  it("ends a menu path at punctuation or a joining word", () => {
    expect(kinds("then open File › Save as and pick a folder")).toEqual([["path", "File › Save as"]]);
    expect(kinds("in Control Panel › Sound.")).toEqual([["path", "Control Panel › Sound"]]);
    expect(kinds("in Settings › Help, then")).toEqual([["path", "Settings › Help"]]);
    expect(kinds("a › b")).toEqual([["path", "a › b"]]);
    expect(kinds("just › alone at the end ›")).toEqual([["path", "just › alone"]]);
  });

  it("finds file names with a known ending, with folders, and dotfiles", () => {
    expect(kinds("edit src/ui/App.tsx and package.json, then .env and .progressor/.gitignore")).toEqual([
      ["file", "src/ui/App.tsx"],
      ["file", "package.json"],
      ["file", ".env"],
      ["file", ".progressor/.gitignore"],
    ]);
  });

  it("does not take abbreviations, versions, web addresses or sentence ends for files", () => {
    expect(kinds("e.g. version 1.1.0 on github.com, see example.com. Done.")).toEqual([]);
  });
});
