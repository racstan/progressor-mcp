import { describe, expect, it } from "vitest";
import { PAGE_HASH, PAGE_TITLE, breadcrumbs, newHash, pageHeading, routeFromHash, tabTitle } from "../src/ui/route.js";

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

describe("the Dashboard page (once called Statistics)", () => {
  it("lives at #/dashboard and is called Dashboard", () => {
    expect(routeFromHash("#/dashboard")).toEqual({ page: "dashboard" });
    expect(PAGE_TITLE.dashboard).toBe("Dashboard");
    expect(breadcrumbs({ page: "dashboard", project: "Bindery" }).map((c) => c.label)).toEqual(["Home", "Bindery", "Dashboard"]);
  });

  it("still opens from the old #/stats address, which moves to the new one", () => {
    expect(routeFromHash("#/stats")).toEqual({ page: "dashboard" });
    expect(newHash("#/stats")).toBe("#/dashboard");
    expect(newHash("#/dashboard")).toBeUndefined();
    expect(newHash("#/goal/stats")).toBeUndefined();
  });
});

describe("a page's heading", () => {
  it("names the project on every page that belongs to one", () => {
    const p = "Bindery";
    expect(pageHeading("dashboard", p)).toBe("Bindery Dashboard");
    expect(pageHeading("wishlist", p)).toBe("Bindery Wishlist");
    expect(pageHeading("hotfix", p)).toBe("Bindery Hotfixes");
    expect(pageHeading("calendar", p)).toBe("Bindery Calendar");
    expect(pageHeading("history", p)).toBe("Bindery History");
    expect(pageHeading("handoffs", p)).toBe("Bindery Handoffs");
    expect(pageHeading("context", p)).toBe("Bindery project notes");
    expect(pageHeading("talk", p)).toBe("Message your AI about Bindery");
  });

  it("keeps Settings plain, since it is for every project", () => {
    expect(pageHeading("settings", "Bindery")).toBe("Settings");
    expect(pageHeading("settings")).toBe("Settings");
  });

  it("is the page's plain name when there is no project", () => {
    expect(pageHeading("dashboard")).toBe("Dashboard");
    expect(pageHeading("talk")).toBe("Message your AI");
  });
});

describe("the browser tab's title", () => {
  it("leads with the page named after its project", () => {
    expect(tabTitle({ page: "dashboard", project: "Bindery" })).toBe("Bindery Dashboard · Progressor");
    expect(tabTitle({ page: "goal", project: "Bindery", goal: "Ship it" })).toBe("Ship it · Bindery · Progressor");
    expect(tabTitle({ page: "settings", project: "Bindery" })).toBe("Settings · Progressor");
    expect(tabTitle({ page: "goal", home: "Home" })).toBe("Home · Progressor");
  });
});
