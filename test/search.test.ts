import { describe, expect, it } from "vitest";
import { type SearchableProject, SearchIndex, search } from "../src/dashboard/search.js";

const shop: SearchableProject = {
  id: "shop-1",
  name: "shop-app",
  root: "C:\\work\\shop-app",
  goals: [
    {
      id: "ship-oauth-login",
      title: "Ship OAuth login",
      status: "active",
      outcome: "Users can sign in with Google",
      tasks: [
        { id: "t1", title: "Add the /login route", status: "done", summary: "Redirect to the provider" },
        { id: "t2", title: "Fix callback redirect loop", status: "in progress", summary: "Only set the session cookie after token exchange" },
      ],
    },
    { id: "billing", title: "Billing page", status: "planned", tasks: [{ id: "t1", title: "Stripe checkout", status: "pending" }] },
  ],
};
const blog: SearchableProject = {
  id: "blog-2",
  name: "blog",
  root: "C:\\work\\blog",
  goals: [{ id: "login", title: "Login for authors", status: "done", tasks: [] }],
};

const titles = (q: string) => search([shop, blog], q).map((h) => `${h.kind}:${h.title}`);

describe("search", () => {
  it("finds projects, Goals and Tasks across every project", () => {
    expect(titles("login")).toEqual(
      expect.arrayContaining(["goal:Ship OAuth login", "goal:Login for authors", "task:Add the /login route"]),
    );
    expect(titles("shop")).toContain("project:shop-app");
  });

  it("matches every word, in any order, ignoring case", () => {
    expect(titles("REDIRECT loop")).toEqual(["task:Fix callback redirect loop"]);
    expect(titles("loop redirect")).toEqual(["task:Fix callback redirect loop"]);
    expect(titles("redirect nothing")).toEqual([]);
  });

  it("looks in Outcomes, summaries and folders too", () => {
    expect(titles("google")).toEqual(["goal:Ship OAuth login"]);
    expect(titles("token exchange")).toEqual(["task:Fix callback redirect loop"]);
    expect(titles("work\\blog")).toEqual(["project:blog"]);
  });

  it("lets a project's name narrow the search to it", () => {
    expect(titles("blog login")).toEqual(["goal:Login for authors"]);
  });

  it("says where each hit lives, so the page can open it", () => {
    const [hit] = search([shop], "callback");
    expect(hit).toMatchObject({ kind: "task", project: { id: "shop-1", name: "shop-app" }, goal: { id: "ship-oauth-login", title: "Ship OAuth login" }, id: "t2", status: "in progress" });
  });

  it("ranks title matches and live work above the rest", () => {
    const hits = titles("login");
    expect(hits.indexOf("goal:Ship OAuth login")).toBeLessThan(hits.indexOf("goal:Login for authors"));
    expect(hits.indexOf("goal:Login for authors")).toBeLessThan(hits.indexOf("task:Add the /login route"));
  });

  it("returns nothing for an empty search and caps a long one", () => {
    expect(search([shop, blog], "  ")).toEqual([]);
    const many: SearchableProject = { ...shop, goals: [{ ...shop.goals[0]!, tasks: Array.from({ length: 80 }, (_, i) => ({ id: `t${i}`, title: `Step ${i}`, status: "pending" })) }] };
    expect(search([many], "step", 25)).toHaveLength(25);
  });
});

describe("the search index", () => {
  it("reads each project once and keeps it until the project changes", () => {
    let reads = 0;
    const index = new SearchIndex(60_000, () => 0);
    const build = () => {
      reads++;
      return shop;
    };
    expect(index.get("shop-1", build)).toBe(shop);
    expect(index.get("shop-1", build)).toBe(shop);
    expect(reads).toBe(1);
    index.drop("shop-1");
    index.get("shop-1", build);
    expect(reads).toBe(2);
  });

  it("reads a project again after a while, in case a change was missed", () => {
    let now = 0;
    let reads = 0;
    const index = new SearchIndex(30_000, () => now);
    const build = () => {
      reads++;
      return shop;
    };
    index.get("shop-1", build);
    now = 29_999;
    index.get("shop-1", build);
    expect(reads).toBe(1);
    now = 30_000;
    index.get("shop-1", build);
    expect(reads).toBe(2);
  });

  it("forgets projects no longer on the dashboard", () => {
    let reads = 0;
    const index = new SearchIndex(60_000, () => 0);
    const build = () => {
      reads++;
      return blog;
    };
    index.get("blog-2", build);
    index.keepOnly(["shop-1"]);
    index.get("blog-2", build);
    expect(reads).toBe(2);
  });
});
