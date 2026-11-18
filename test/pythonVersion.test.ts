import { describe, expect, it } from "vitest";
import { pythonVersion } from "../src/pythonVersion.js";

describe("the Python package's version", () => {
  it("is the npm version for a release", () => {
    expect(pythonVersion("1.4.0")).toBe("1.4.0");
    expect(pythonVersion("12.0.31")).toBe("12.0.31");
  });

  it("spells test versions the Python way", () => {
    expect(pythonVersion("1.5.0-alpha.1")).toBe("1.5.0a1");
    expect(pythonVersion("1.5.0-beta.2")).toBe("1.5.0b2");
    expect(pythonVersion("1.5.0-rc.3")).toBe("1.5.0rc3");
  });

  it("refuses a version Python can't hold, rather than publish a wrong one", () => {
    expect(() => pythonVersion("1.5.0-next")).toThrow(/1\.5\.0-next/);
    expect(() => pythonVersion("v1.4.0")).toThrow();
  });
});
