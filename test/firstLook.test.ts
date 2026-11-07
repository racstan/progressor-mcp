import { describe, expect, it } from "vitest";
import { onOpen, setWhatsNewAuto, tourClosed, whatsNewAuto } from "../src/ui/firstLook.js";

const store = (items: Record<string, string> = {}) => {
  const map = new Map(Object.entries(items));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};
const broken = {
  getItem: () => { throw new Error("no storage"); },
  setItem: () => { throw new Error("no storage"); },
  removeItem: () => { throw new Error("no storage"); },
};
const V = "1.3.0 · Your AI does more by itself";
const OLD = "1.2.2 · Hotfixes, and What's new";

describe("the tour", () => {
  it("opens on the first visit, and What's new waits", () => {
    expect(onOpen(store(), V)).toEqual({ tour: true, whatsNew: false });
  });

  it("comes back once on the next visit after Skip or ×, then not again", () => {
    const s = store();
    onOpen(s, V);
    tourClosed(s, "skip");
    expect(onOpen(s, V).tour).toBe(true);
    tourClosed(s, "close");
    expect(onOpen(s, V).tour).toBe(false);
    expect(onOpen(s, V).tour).toBe(false);
  });

  it("comes back once after a visit where it was left open and never closed", () => {
    const s = store();
    onOpen(s, V);
    expect(onOpen(s, V).tour).toBe(true);
    expect(onOpen(s, V).tour).toBe(false);
  });

  it("stops for good once finished", () => {
    const s = store();
    onOpen(s, V);
    tourClosed(s, "finish");
    expect(onOpen(s, V).tour).toBe(false);
  });

  it("stops for good after Don't show again, even on its first showing", () => {
    const s = store();
    onOpen(s, V);
    tourClosed(s, "never");
    expect(onOpen(s, V).tour).toBe(false);
  });

  it("counts a browser that saw the tour in an earlier build as done", () => {
    expect(onOpen(store({ "progressor.tour-seen": "2026-11-07" }), V).tour).toBe(false);
  });
});

describe("What's new", () => {
  const after = (items: Record<string, string>) => store({ "progressor.tour": "done", ...items });

  it("opens by itself the first time after the version changes", () => {
    expect(onOpen(after({ "progressor.seenChanges": OLD }), V)).toEqual({ tour: false, whatsNew: true });
    expect(onOpen(after({}), V).whatsNew).toBe(true);
  });

  it("does not open again for a version already seen", () => {
    expect(onOpen(after({ "progressor.seenChanges": V }), V).whatsNew).toBe(false);
  });

  it("stays shut on new versions after Don't show again, and can be turned back on", () => {
    const s = after({ "progressor.seenChanges": OLD });
    setWhatsNewAuto(s, false);
    expect(whatsNewAuto(s)).toBe(false);
    expect(onOpen(s, V).whatsNew).toBe(false);
    setWhatsNewAuto(s, true);
    expect(whatsNewAuto(s)).toBe(true);
    expect(onOpen(s, V).whatsNew).toBe(true);
  });

  it("never opens with no changelog to show", () => {
    expect(onOpen(after({}), undefined).whatsNew).toBe(false);
  });
});

describe("when the browser can't keep anything", () => {
  it("shows neither by itself, and never fails", () => {
    expect(onOpen(broken, V)).toEqual({ tour: false, whatsNew: false });
    expect(() => tourClosed(broken, "never")).not.toThrow();
    expect(() => setWhatsNewAuto(broken, false)).not.toThrow();
    expect(whatsNewAuto(broken)).toBe(true);
  });
});
