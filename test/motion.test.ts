import { describe, expect, it } from "vitest";
import { MOTION_KEY, readMotion, writeMotion } from "../src/ui/motion.js";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe("how much the page moves", () => {
  it("is full unless the person chose otherwise", () => {
    expect(readMotion(memory())).toBe("full");
    const s = memory();
    s.setItem(MOTION_KEY, "nonsense");
    expect(readMotion(s)).toBe("full");
  });

  it("remembers gentle and off, and forgets full (the usual)", () => {
    const s = memory();
    writeMotion(s, "gentle");
    expect(readMotion(s)).toBe("gentle");
    writeMotion(s, "off");
    expect(readMotion(s)).toBe("off");
    writeMotion(s, "full");
    expect(s.m.has(MOTION_KEY)).toBe(false);
  });

  it("works when the browser can't remember anything", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readMotion(broken)).toBe("full");
    expect(() => writeMotion(broken, "off")).not.toThrow();
  });
});
