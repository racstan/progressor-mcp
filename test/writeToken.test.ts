import { describe, expect, it } from "vitest";
import { TOKEN_HEADER, withWriteToken } from "../src/ui/writeToken.js";

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
