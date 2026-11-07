import { describe, expect, it } from "vitest";
import { PAGE_HASH, PAGE_TITLE, routeFromHash } from "../src/ui/route.js";

describe("the page in the address", () => {
  it("is a goal's page for #/goal/<id>, and the default goal's page with no hash", () => {
    expect(routeFromHash("#/goal/ship%20it")).toEqual({ page: "goal", goal: "ship it" });
    expect(routeFromHash("")).toEqual({ page: "goal" });
    expect(routeFromHash("#/nowhere")).toEqual({ page: "goal" });
  });

  it("names every other page by its own hash", () => {
    for (const [page, hash] of Object.entries(PAGE_HASH)) expect(routeFromHash(hash)).toEqual({ page });
    expect(routeFromHash("#/settings")).toEqual({ page: "settings" });
  });

  it("gives every page a title in plain words", () => {
    expect(PAGE_TITLE.settings).toBe("Settings");
    for (const page of Object.keys(PAGE_HASH)) expect(PAGE_TITLE[page as keyof typeof PAGE_TITLE]).toMatch(/^[A-Z]/);
  });
});
