// Which page the address shows: `#/goal/<id>` for a goal, or one hash per page. The project is in
// the address's ?project= part, so each page works on Home and in any project alike.

export type Page = "goal" | "context" | "talk" | "stats" | "wishlist" | "hotfix" | "history" | "handoffs" | "calendar" | "settings";

/** The hash of every page other than a goal's. */
export const PAGE_HASH: Record<Exclude<Page, "goal">, string> = {
  context: "#/context",
  talk: "#/talk",
  stats: "#/stats",
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
  stats: "Statistics",
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

export function routeFromHash(hash: string): Route {
  const goal = /^#\/goal\/(.+)$/.exec(hash);
  if (goal) return { page: "goal", goal: decodeURIComponent(goal[1]!) };
  for (const [page, h] of Object.entries(PAGE_HASH)) if (h === hash) return { page: page as Page };
  return { page: "goal" };
}

/** Pages that belong to one project; on Home they make no sense, so Home is shown instead. */
export const projectPage = (page: Page) => page !== "settings";
