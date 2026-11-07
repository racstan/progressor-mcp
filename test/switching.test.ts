import { describe, expect, it } from "vitest";
import { type SwitchView, settled, switchWhere } from "../src/ui/settings/switching.js";

const on: SwitchView = { background: true, status: { serving: true }, text: "Served by the background dashboard" };
const off: SwitchView = { background: false, status: null, text: "The background dashboard is not running." };
const stopping: SwitchView = { background: false, status: { serving: true }, text: "still running" };
const starting: SwitchView = { background: true, status: null, text: "not yet" };

/** A server that answers in turn from `answers`: a view, "drop" (the connection is lost), or an error it says in words. */
function server(post: SwitchView | "drop" | Error, gets: (SwitchView | "drop")[]) {
  const said: string[] = [];
  let t = 0;
  return {
    said,
    io: {
      post: async () => {
        if (post === "drop") throw new TypeError("Failed to fetch");
        if (post instanceof Error) throw post;
        return post;
      },
      get: async () => {
        const next = gets.shift() ?? "drop";
        if (next === "drop") throw new TypeError("Failed to fetch");
        return next;
      },
      sleep: async (ms: number) => void (t += ms),
      now: () => t,
      onReconnecting: () => void said.push("reconnecting"),
    },
  };
}

describe("when the switch is done", () => {
  it("is done when the background dashboard is set up and runs, or is gone", () => {
    expect(settled(true, on)).toBe(true);
    expect(settled(true, starting)).toBe(false);
    expect(settled(false, off)).toBe(true);
    expect(settled(false, stopping)).toBe(false);
  });
});

describe("switching where the dashboard runs", () => {
  it("is done at once when the answer already says so", async () => {
    const s = server(on, []);
    expect(await switchWhere(true, s.io)).toEqual({ ok: true, view: on });
    expect(s.said).toEqual([]);
  });

  it("rides through the page's server changing: reconnecting, then the answer from the new one", async () => {
    const s = server("drop", ["drop", "drop", on]);
    expect(await switchWhere(true, s.io)).toEqual({ ok: true, view: on });
    expect(s.said).toEqual(["reconnecting"]);
  });

  it("waits for the background dashboard to stop after switching back", async () => {
    const s = server(stopping, [stopping, "drop", off]);
    expect(await switchWhere(false, s.io)).toEqual({ ok: true, view: off });
    expect(s.said).toEqual(["reconnecting"]);
  });

  it("is done switching back even when no AI chat is open to serve the page again", async () => {
    const s = server(stopping, []);
    expect(await switchWhere(false, s.io, { waitMs: 5000 })).toEqual({ ok: true, view: undefined });
  });

  it("says the server's error in its words", async () => {
    const s = server(new Error("The Startup folder could not be written."), []);
    expect(await switchWhere(true, s.io)).toEqual({ ok: false, error: "The Startup folder could not be written." });
  });

  it("gives up after a while if the background dashboard never answers", async () => {
    const s = server("drop", []);
    const r = await switchWhere(true, s.io, { waitMs: 5000 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/didn't answer/);
  });
});
