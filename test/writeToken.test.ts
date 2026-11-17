import { describe, expect, it } from "vitest";
import { TOKEN_HEADER, tokenFetch, tokenFromPage, withWriteToken } from "../src/ui/writeToken.js";

describe("the token the page sends with every change", () => {
  it("is added to a change on this site, beside the headers it already has", () => {
    const init = withWriteToken({ method: "POST", headers: { "x-progressor": "notes", "content-type": "application/json" }, body: "{}" }, "abc", true)!;
    const headers = new Headers(init.headers);
    expect(headers.get(TOKEN_HEADER)).toBe("abc");
    expect(headers.get("x-progressor")).toBe("notes");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.body).toBe("{}");
  });

  it("is left off reads, requests to other sites, and a page that was given no token", () => {
    expect(withWriteToken(undefined, "abc", true)).toBeUndefined();
    const read = { cache: "no-store" as const };
    expect(withWriteToken(read, "abc", true)).toBe(read);
    const post = { method: "post" };
    expect(withWriteToken(post, "abc", false)).toBe(post);
    expect(withWriteToken(post, undefined, true)).toBe(post);
    expect(new Headers(withWriteToken(post, "abc", true)!.headers).get(TOKEN_HEADER)).toBe("abc"); // method case does not matter
  });
});

describe("a page left open while another Progressor takes over the dashboard", () => {
  it("reads the new token from the page the dashboard serves now", () => {
    expect(tokenFromPage('<head><meta name="progressor-token" content="f00d">\n</head>')).toBe("f00d");
    expect(tokenFromPage("<head></head>")).toBeUndefined();
  });

  it("asks once more with the new token when a change is refused", async () => {
    const sent: (string | null)[] = [];
    const plain = async (_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const token = new Headers(init.headers).get(TOKEN_HEADER);
        sent.push(token);
        return new Response("", { status: token === "new" ? 200 : 403 });
      }
      return new Response('<meta name="progressor-token" content="new">', { status: 200 });
    };
    const fetchWithToken = tokenFetch(plain, "old", "http://localhost:4747");
    const res = await fetchWithToken("http://localhost:4747/api/x", { method: "POST" });
    expect(res.status).toBe(200);
    expect(sent).toEqual(["old", "new"]);
    await fetchWithToken("http://localhost:4747/api/x", { method: "POST" });
    expect(sent).toEqual(["old", "new", "new"]); // the new one is kept
  });
});
