import { describe, expect, it } from "vitest";
import { BROWSER_SETTINGS, clearBrowserSettings, resetAll } from "../src/ui/settings/reset.js";
import { FREE_NOTICE, SETTINGS_WHERE } from "../src/ui/words.js";

/** A stand-in for the browser's storage. */
function storage(items: Record<string, string>) {
  const map = new Map(Object.entries(items));
  return {
    map,
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("resetting the dashboard's settings", () => {
  it("clears how the page looks from the browser, and nothing else kept there", () => {
    const s = storage({
      "progressor.theme": "dark",
      "progressor.pop-ups": "on",
      "progressor.finished": "review",
      "progressor.editor": "zed",
      "progressor.put-off": "{}",
      "progressor.hidden.shop-123": "[]",
      "progressor.sidebar-collapsed": "1",
    });
    clearBrowserSettings(s);
    expect([...s.map.keys()]).toEqual(["progressor.hidden.shop-123", "progressor.sidebar-collapsed"]);
    expect(BROWSER_SETTINGS).toContain("progressor.theme");
  });

  it("resets every section, then the browser's settings, then the settings on this computer, once", async () => {
    const done: string[] = [];
    const sections = ["theme", "history", "phone"].map((id) => ({ id, reset: async () => void done.push(id) }));
    const s = storage({ "progressor.theme": "dark" });
    await resetAll(sections, s, async () => void done.push("computer"));
    expect(done).toEqual(["theme", "history", "phone", "computer"]);
    expect(s.map.size).toBe(0);
  });

  it("still resets the rest when one section fails, and says which", async () => {
    const done: string[] = [];
    const sections = [
      { id: "theme", reset: () => void done.push("theme") },
      { id: "broken", reset: () => { throw new Error("nope"); } },
      { id: "phone", reset: () => void done.push("phone") },
    ];
    await expect(resetAll(sections, storage({}), async () => void done.push("computer"))).rejects.toThrow(/broken/);
    expect(done).toEqual(["theme", "phone", "computer"]);
  });
});

describe("the words", () => {
  it("says Progressor is free in the Developer's words", () => {
    expect(FREE_NOTICE).toBe("Progressor is free. There is no paid version or subscription; anyone selling one is not us, so beware of impostors.");
  });

  it("says which settings are kept where", () => {
    expect(SETTINGS_WHERE).toMatch(/this browser/);
    expect(SETTINGS_WHERE).toMatch(/this computer/);
  });
});
