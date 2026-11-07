import { describe, expect, it } from "vitest";
import { PAGE_HASH, PAGE_TITLE, breadcrumbs, routeFromHash } from "../src/ui/route.js";

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

describe("the breadcrumb trail", () => {
  it("is just Home on Home", () => {
    expect(breadcrumbs({ page: "goal" })).toEqual([{ label: "Home" }]);
  });

  it("names the Workspace shown on Home, with Home to go back", () => {
    expect(breadcrumbs({ page: "goal", workspace: "Clients" })).toEqual([{ label: "Home", to: "home" }, { label: "Clients" }]);
  });

  it("is Home › Settings for Settings opened from Home", () => {
    expect(breadcrumbs({ page: "settings" })).toEqual([{ label: "Home", to: "home" }, { label: "Settings" }]);
  });

  it("is Home › project › page in a project, with Home and the project to click", () => {
    expect(breadcrumbs({ page: "calendar", project: "Bindery" })).toEqual([
      { label: "Home", to: "home" },
      { label: "Bindery", to: "project" },
      { label: "Calendar" },
    ]);
    expect(breadcrumbs({ page: "settings", project: "Bindery" }).map((c) => c.label)).toEqual(["Home", "Bindery", "Settings"]);
  });

  it("ends with the goal's title on a goal's page, or at the project while it loads", () => {
    expect(breadcrumbs({ page: "goal", project: "Bindery", goal: "Ship OAuth login" }).map((c) => c.label)).toEqual(["Home", "Bindery", "Ship OAuth login"]);
    expect(breadcrumbs({ page: "goal", project: "Bindery" })).toEqual([{ label: "Home", to: "home" }, { label: "Bindery" }]);
  });
});
