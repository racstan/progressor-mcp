import { describe, expect, it } from "vitest";
import { newestOnly, sharedEvents } from "../src/ui/liveEvents.js";

/** Stands in for the browser's EventSource: records listeners and whether it was closed. */
class FakeSource {
  static made: FakeSource[] = [];
  listeners = new Map<string, Set<(e: MessageEvent<string>) => void>>();
  closed = false;
  readyState = 0;
  constructor(readonly url: string) {
    FakeSource.made.push(this);
  }
  addEventListener(type: string, f: (e: MessageEvent<string>) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(f);
  }
  removeEventListener(type: string, f: (e: MessageEvent<string>) => void) {
    this.listeners.get(type)?.delete(f);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, e = new MessageEvent<string>(type)) {
    for (const f of this.listeners.get(type) ?? []) f(e);
  }
}

describe("one live connection per tab", () => {
  it("opens one connection for every listener, and closes it when the last one leaves", () => {
    FakeSource.made = [];
    const events = sharedEvents("/api/events", (url) => new FakeSource(url));
    const seen: string[] = [];
    const a = events.on({ change: () => seen.push("a change"), open: () => seen.push("a open") });
    const b = events.on({ change: () => seen.push("b change"), projects: () => seen.push("b projects") });
    expect(FakeSource.made).toHaveLength(1);
    const source = FakeSource.made[0]!;
    source.emit("open");
    source.emit("change");
    source.emit("projects");
    expect(seen).toEqual(["a open", "a change", "b change", "b projects"]);
    a();
    source.emit("change");
    expect(seen.at(-1)).toBe("b change");
    expect(source.closed).toBe(false);
    b();
    expect(source.closed).toBe(true);
    // a new listener later opens a fresh connection
    events.on({ change: () => undefined });
    expect(FakeSource.made).toHaveLength(2);
  });

  it("tells a listener that joins an open connection that it is open", () => {
    FakeSource.made = [];
    const events = sharedEvents("/api/events", (url) => new FakeSource(url));
    events.on({ change: () => undefined });
    FakeSource.made[0]!.readyState = 1;
    let opened = false;
    events.on({ open: () => (opened = true) });
    expect(opened).toBe(true);
  });

  it("leaving twice does not close a connection others still use", () => {
    FakeSource.made = [];
    const events = sharedEvents("/api/events", (url) => new FakeSource(url));
    const a = events.on({ change: () => undefined });
    events.on({ change: () => undefined });
    a();
    a();
    expect(FakeSource.made[0]!.closed).toBe(false);
  });
});

describe("a tab in the background", () => {
  it("lets go of its connection while hidden and opens a fresh one, with every listener, when shown again", () => {
    FakeSource.made = [];
    const events = sharedEvents("/api/events", (url) => new FakeSource(url));
    const seen: string[] = [];
    events.on({ change: () => seen.push("change"), open: () => seen.push("open") });
    events.pause();
    expect(FakeSource.made[0]!.closed).toBe(true);
    events.pause();
    expect(FakeSource.made).toHaveLength(1);
    events.resume();
    expect(FakeSource.made).toHaveLength(2);
    const fresh = FakeSource.made[1]!;
    fresh.emit("open");
    fresh.emit("change");
    expect(seen).toEqual(["open", "change"]);
    events.resume();
    expect(FakeSource.made).toHaveLength(2);
  });

  it("joins while hidden without opening, and leaving while hidden closes nothing twice", () => {
    FakeSource.made = [];
    const events = sharedEvents("/api/events", (url) => new FakeSource(url));
    events.pause();
    const stop = events.on({ change: () => undefined });
    expect(FakeSource.made).toHaveLength(0);
    stop();
    events.resume();
    expect(FakeSource.made).toHaveLength(0);
  });
});

describe("only the newest answer counts", () => {
  it("says an older load is stale once a newer one has started", () => {
    const newest = newestOnly();
    const first = newest();
    const second = newest();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });
});
