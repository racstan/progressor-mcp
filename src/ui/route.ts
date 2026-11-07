// Which page the address shows: `#/goal/<id>` for a goal, or one hash per page. The project is in
// the address's ?project= part, so each page works on Home and in any project alike.

export type Page = "goal" | "context" | "talk" | "dashboard" | "wishlist" | "hotfix" | "history" | "handoffs" | "calendar" | "settings";

/** The hash of every page other than a goal's. */
export const PAGE_HASH: Record<Exclude<Page, "goal">, string> = {
  context: "#/context",
  talk: "#/talk",
  dashboard: "#/dashboard",
  wishlist: "#/wishlist",
  hotfix: "#/hotfix",
  history: "#/history",
  handoffs: "#/handoffs",
  calendar: "#/calendar",
  settings: "#/settings",
};

/** What each page is called, in the page's title and the sidebar. */
export const PAGE_TITLE: Record<Exclude<Page, "goal">, string> = {
  context: "Project notes",
  talk: "Message your AI",
  dashboard: "Dashboard",
  wishlist: "Wishlist",
  hotfix: "Hotfixes",
  history: "History",
  handoffs: "Handoffs",
  calendar: "Calendar",
  settings: "Settings",
};

export interface Route {
  page: Page;
  /** The goal asked for by `#/goal/<id>`; without one the page picks a goal itself. */
  goal?: string;
}

/** Addresses pages had before, and where they are now: Statistics became Dashboard in 1.3.0. */
const MOVED: Record<string, string> = { "#/stats": PAGE_HASH.dashboard };

/** The address an old hash moved to, so the page can show the new one; undefined when it did not move. */
export const newHash = (hash: string): string | undefined => MOVED[hash];

export function routeFromHash(hash: string): Route {
  hash = newHash(hash) ?? hash;
  const goal = /^#\/goal\/(.+)$/.exec(hash);
  if (goal) return { page: "goal", goal: decodeURIComponent(goal[1]!) };
  for (const [page, h] of Object.entries(PAGE_HASH)) if (h === hash) return { page: page as Page };
  return { page: "goal" };
}

/** Pages that belong to one project; on Home they make no sense, so Home is shown instead. */
export const projectPage = (page: Page) => page !== "settings";

/** One link of the breadcrumb trail at the top of every page; the last one, the page itself, has no `to`. */
export interface Crumb {
  label: string;
  to?: "home" | "project";
}

/** Home › project › page (or the goal's title): where the page is, each step back clickable. */
export function breadcrumbs(at: { page: Page; project?: string; workspace?: string; goal?: string }): Crumb[] {
  const here = at.page === "goal" ? at.goal : PAGE_TITLE[at.page];
  const trail: Crumb[] = [{ label: "Home", to: "home" }];
  if (at.project) trail.push({ label: at.project, to: "project" });
  else if (at.page === "goal" && at.workspace) trail.push({ label: at.workspace });
  if (at.page !== "goal" || (at.project && here)) trail.push({ label: here! });
  const last = trail.length - 1;
  return trail.map((c, i) => (i === last ? { label: c.label } : c));
}
