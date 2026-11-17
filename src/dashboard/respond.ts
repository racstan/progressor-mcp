// What every dashboard route uses to answer and to read what it was sent: shared by the built-in
// routes in http.ts and the feature routes in routes.ts.
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Made when the dashboard starts, put into the page it serves, and sent back by the page with every
 * change (the x-progressor-token header). A program on this computer that has not been given the
 * page cannot know it, so it cannot fake a change just by copying the other headers.
 */
export const dashboardToken = randomBytes(24).toString("hex");

/** Whether a request carries this dashboard's token. */
export function hasDashboardToken(req: IncomingMessage): boolean {
  const sent = Buffer.from(String(req.headers["x-progressor-token"] ?? ""));
  const want = Buffer.from(dashboardToken);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

/** Whether the browser says another site made this request (it sends Sec-Fetch-Site, which a page cannot change). */
export function isCrossSite(req: IncomingMessage): boolean {
  return req.headers["sec-fetch-site"] === "cross-site";
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * Whether a request that changes something comes from the dashboard's own page. Browsers always send
 * Origin on a POST, and a custom header cannot be sent from another site without a CORS preflight,
 * which the dashboard never answers, so other web pages cannot stop servers. Each kind of change has
 * its own header value ("stop", "mark", "talk", "reveal", "notes", "settings", and one per feature).
 * It must also carry the dashboard's token, which only the page the dashboard served has.
 */
export function isFromDashboardPage(req: IncomingMessage, header: string): boolean {
  if (req.headers["x-progressor"] !== header || !hasDashboardToken(req)) return false;
  try {
    const origin = new URL(String(req.headers.origin ?? ""));
    const port = (req.headers.host ?? "").match(/:(\d+)$/)?.[1] ?? "80";
    return ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && (origin.port || "80") === port;
  } catch {
    return false;
  }
}

/**
 * Reads a request body as bytes, or undefined when it is bigger than the limit. After undefined the
 * caller answers and closes the connection (answerTooBig), so the rest of the body is never read.
 */
export function readBytes(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  return new Promise((done) => {
    const chunks: Buffer[] = [];
    let size = 0;
    if (Number(req.headers["content-length"]) > limit) return done(undefined); // it says so up front: not read at all
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        chunks.length = 0; // nothing more is kept
        done(undefined);
        req.pause();
      } else chunks.push(c);
    });
    req.on("end", () => done(Buffer.concat(chunks)));
    req.on("error", () => done(undefined));
  });
}

/** Reads a request body as text, or undefined when it is bigger than the limit. */
export async function readBody(req: IncomingMessage, limit: number): Promise<string | undefined> {
  return (await readBytes(req, limit))?.toString("utf8");
}

/**
 * Reads a JSON object sent as JSON, answering the request itself (415, 413 or 400) and giving
 * undefined when anything is wrong with it.
 */
export async function readJsonBody(req: IncomingMessage, res: ServerResponse, limit: number): Promise<Record<string, unknown> | undefined> {
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return void json(res, 415, { error: "Send it as JSON." });
  const text = await readBody(req, limit);
  if (text === undefined) {
    res.once("finish", () => req.destroy());
    return void json(res, 413, { error: "That is too long." });
  }
  try {
    const body = JSON.parse(text) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // answered below
  }
  return void json(res, 400, { error: "That is not valid JSON." });
}

/**
 * Answers 413 and then closes the connection, so what is still being sent is not read. The body is
 * left unread, so the sender stalls and can see the answer; a moment later the connection is cut.
 */
export function answerTooBig(req: IncomingMessage, res: ServerResponse, error: string): void {
  res.once("finish", () => setTimeout(() => req.destroy(), 1000).unref());
  res.setHeader("connection", "close");
  json(res, 413, { error });
}
