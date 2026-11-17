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

/** Makes every change the page asks for carry the token. Called once, when the page starts. */
export function installWriteToken(): void {
  const token = document.querySelector<HTMLMetaElement>('meta[name="progressor-token"]')?.content;
  const plainFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    return plainFetch(input, withWriteToken(init, token, url.origin === location.origin));
  };
}
