// The dashboard puts a token in the page it serves (a meta tag); the page sends it back with every
// change it asks for, which is how the dashboard knows the change came from this page and not from
// another program on the computer (src/dashboard/respond.ts).

/** The header the token travels in. */
export const TOKEN_HEADER = "x-progressor-token";

/** The options of a request with the token added, when it changes something on this site; otherwise as they were. */
export function withWriteToken(init: RequestInit | undefined, token: string | undefined, sameSite: boolean): RequestInit | undefined {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!token || !sameSite || method === "GET" || method === "HEAD") return init;
  const headers = new Headers(init?.headers);
  headers.set(TOKEN_HEADER, token);
  return { ...init, headers };
}

/** The token in a page the dashboard served, if it has one. */
export function tokenFromPage(html: string): string | undefined {
  return /<meta name="progressor-token" content="([^"<>]+)">/.exec(html)?.[1];
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A fetch that adds the token to every change on this site. The token belongs to the Progressor that
 * serves the dashboard; when another one takes over while the page stays open, a change is refused
 * (403). Then the page reads the new token from the page served now and asks once more.
 */
export function tokenFetch(plain: Fetch, token: string | undefined, origin: string): Fetch {
  let current = token;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    const sameSite = url.origin === origin;
    const res = await plain(input, withWriteToken(init, current, sameSite));
    const method = (init?.method ?? "GET").toUpperCase();
    if (res.status !== 403 || !sameSite || method === "GET" || method === "HEAD") return res;
    try {
      const fresh = tokenFromPage(await (await plain(`${origin}/`, { cache: "no-store" })).text());
      if (!fresh || fresh === current) return res;
      current = fresh;
      return await plain(input, withWriteToken(init, current, true));
    } catch {
      return res;
    }
  };
}

/** Makes every change the page asks for carry the token. Called once, when the page starts. */
export function installWriteToken(): void {
  const token = document.querySelector<HTMLMetaElement>('meta[name="progressor-token"]')?.content;
  window.fetch = tokenFetch(window.fetch.bind(window), token, location.origin);
}
