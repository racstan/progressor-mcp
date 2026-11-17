import { describe, expect, it } from "vitest";
import { readLastLook, writeLastLook } from "../src/ui/lastLook.js";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("last look", () => {
  it("is unknown on a first look, then remembered per project", () => {
    const s = memory();
    expect(readLastLook("a", s)).toBeUndefined();
    writeLastLook("a", 1234, s);
    expect(readLastLook("a", s)).toBe(1234);
    expect(readLastLook("b", s)).toBeUndefined();
  });

  it("copes with storage that is missing or throws", () => {
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    expect(readLastLook("a", broken)).toBeUndefined();
    expect(() => writeLastLook("a", 1, broken)).not.toThrow();
    expect(readLastLook("a", undefined)).toBeUndefined();
  });
});
