import { describe, expect, it } from "vitest";
import { LOST_AFTER_MS, pageStaleness } from "../src/ui/stale.js";

const NOW = new Date(2026, 9, 28, 16, 0).getTime();

describe("whether the dashboard page is out of date", () => {
  it("is fine when the build is the one the page opened with and the page is in touch", () => {
    expect(pageStaleness({ openedWith: "a", serverBuild: "a", lostSince: undefined, now: NOW })).toBeUndefined();
    expect(pageStaleness({ openedWith: undefined, serverBuild: "a", lostSince: undefined, now: NOW })).toBeUndefined();
    expect(pageStaleness({ openedWith: "a", serverBuild: undefined, lostSince: undefined, now: NOW })).toBeUndefined();
  });

  it("says Progressor was updated when the server serves another build", () => {
    expect(pageStaleness({ openedWith: "a", serverBuild: "b", lostSince: undefined, now: NOW })).toEqual({
      kind: "updated",
      text: "Progressor was updated since this page was opened. Refresh to see the new version.",
    });
  });

  it("says when it lost touch, once that has lasted a minute", () => {
    expect(pageStaleness({ openedWith: "a", serverBuild: "a", lostSince: NOW - LOST_AFTER_MS + 1000, now: NOW })).toBeUndefined();
    const lost = new Date(2026, 9, 28, 15, 58).getTime();
    expect(pageStaleness({ openedWith: "a", serverBuild: "a", lostSince: lost, now: NOW })).toEqual({
      kind: "lost",
      text: "This page lost touch with Progressor at 15:58, so it may be out of date. It catches up by itself once Progressor runs again (open your AI chat), or press Refresh.",
    });
  });

  it("puts a new version first", () => {
    expect(pageStaleness({ openedWith: "a", serverBuild: "b", lostSince: 0, now: NOW })?.kind).toBe("updated");
  });
});
