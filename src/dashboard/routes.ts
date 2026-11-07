// The dashboard routes that belong to a feature. Each feature keeps its routes in
// src/dashboard/routes/<feature>.ts and adds one line to `featureRoutes` below; the hub tries these
// before its own built-in routes (http.ts), so a feature never edits that chain.
//
// A route that changes something names its `header`: the request must then come from the dashboard's
// own page with `x-progressor: <header>` (respond.ts), or it is refused with 403 before it is handled.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Project } from "../project.js";
import { isFromDashboardPage, json, readJsonBody } from "./respond.js";
import { ntfyRoutes } from "./routes/ntfy.js";
import { historyRoutes } from "./routes/history.js";
import { checkupRoutes } from "./routes/checkup.js";
import { handoffRoutes } from "./routes/handoffs.js";
import { settingsRoutes } from "./routes/settings.js";

/** What the hub gives every feature route. */
export interface HubContext {
  /** The project with this dashboard ID, or undefined when the dashboard has no such project. */
  project(id: string): Project | undefined;
  /** The settings file (settings.ts). */
  settingsFile: string;
  /** The project list (registry.ts). */
  registryFile: string;
  /** Tells every open dashboard page something changed (a server-sent event). */
  send(event: string, data: unknown): void;
  /** How web requests are made, so a test can stand in for the network (ntfy). Undefined means the real one. */
  fetch?: unknown;
}

export interface RouteContext extends HubContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  /** What the route's pattern matched in the path, already decoded. */
  match: string[];
  /** The JSON object sent; when it is wrong, the request is answered and this gives undefined. */
  body(limit?: number): Promise<Record<string, unknown> | undefined>;
  json(status: number, body: unknown): void;
}

export interface FeatureRoute {
  method: "GET" | "POST";
  pattern: RegExp;
  /** For a route that changes something: the x-progressor value the dashboard's page sends. */
  header?: string;
  handle(ctx: RouteContext): void | Promise<void>;
}

/** Every feature's routes. A feature adds one line: `...myFeatureRoutes,`. */
export const featureRoutes: FeatureRoute[] = [
  ...settingsRoutes,
  ...ntfyRoutes,
  ...historyRoutes,
  ...checkupRoutes,
  ...handoffRoutes,
];

/** A body bigger than this is refused unread, unless the route asks for more. */
const MAX_BODY = 65_536;

/** A thrown error's message for the dashboard: 404 for something missing, else 400. */
function answerError(res: ServerResponse, e: unknown): void {
  const message = (e as Error).message ?? String(e);
  if (!res.headersSent) json(res, /^No /.test(message) ? 404 : 400, { error: message });
}

/** Runs the first feature route that matches the request; false when none does. */
export function runFeatureRoute(routes: FeatureRoute[], req: IncomingMessage, res: ServerResponse, url: URL, hub: HubContext): boolean {
  const method = req.method === "HEAD" ? "GET" : req.method;
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(url.pathname);
    if (!m) continue;
    if (route.header !== undefined && !isFromDashboardPage(req, route.header)) {
      json(res, 403, { error: "This can only be sent from the dashboard's own page." });
      return true;
    }
    const ctx: RouteContext = {
      ...hub,
      req,
      res,
      url,
      match: m.map((part) => {
        try {
          return decodeURIComponent(part ?? "");
        } catch {
          return part ?? "";
        }
      }),
      body: (limit = MAX_BODY) => readJsonBody(req, res, limit),
      json: (status, body) => json(res, status, body),
    };
    try {
      const done = route.handle(ctx);
      if (done instanceof Promise) done.catch((e) => answerError(res, e));
    } catch (e) {
      answerError(res, e);
    }
    return true;
  }
  return false;
}
