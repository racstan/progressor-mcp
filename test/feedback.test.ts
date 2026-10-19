import { describe, expect, it } from "vitest";
import { describeSystem, ISSUES_URL, issueUrl } from "../src/ui/feedback.js";

const params = (url: string) => new URL(url).searchParams;

describe("issueUrl", () => {
  it("opens the bug form with the version and system filled in", () => {
    const url = issueUrl("bug", { version: "0.4.0", system: "Windows · Chrome 141" });
    expect(url.startsWith(`${ISSUES_URL}/new?`)).toBe(true);
    const p = params(url);
    expect(p.get("template")).toBe("bug_report.yml");
    expect(p.get("version")).toBe("0.4.0");
    expect(p.get("system")).toBe("Windows · Chrome 141");
  });

  it("opens the idea form with no system details", () => {
    const p = params(issueUrl("idea", { version: "0.4.0", system: "macOS · Safari" }));
    expect(p.get("template")).toBe("idea.yml");
    expect(p.get("version")).toBe("0.4.0");
    expect(p.has("system")).toBe(false);
  });

  it("leaves out what is not known", () => {
    const p = params(issueUrl("bug", {}));
    expect(p.get("template")).toBe("bug_report.yml");
    expect(p.has("version")).toBe(false);
    expect(p.has("system")).toBe(false);
  });
});

describe("describeSystem", () => {
  it("names the OS and browser from a Chrome on Windows user agent", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    expect(describeSystem(ua)).toBe("Windows · Chrome 141");
  });

  it("tells Edge from Chrome", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
    expect(describeSystem(ua)).toBe("Windows · Edge 141");
  });

  it("names Firefox on Linux", () => {
    expect(describeSystem("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("Linux · Firefox 140");
  });

  it("names Safari on macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";
    expect(describeSystem(ua)).toBe("macOS · Safari 18");
  });

  it("falls back to unknown parts", () => {
    expect(describeSystem("curl/8.0")).toBe("unknown OS · unknown browser");
  });
});
