import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { announceServer, listServers, requestStop } from "../src/servers.js";
import { tempDir } from "./tmp.js";

let dir: string;
const closers: (() => void)[] = [];
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function until(check: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await wait(10);
  }
}

function announce(pid: number, extra: Partial<Parameters<typeof announceServer>[1]> = {}) {
  const stops: number[] = [];
  const s = announceServer(
    { kind: "session", root: `/work/app-${pid}`, session: `s-${pid}` },
    { dir, pid, version: "9.9.9", pollMs: 10, onStop: () => stops.push(pid), ...extra },
  );
  closers.push(() => s.close());
  return { ...s, stops };
}

beforeEach(() => {
  dir = join(tempDir("progressor-servers-"), "servers");
});
afterEach(() => closers.splice(0).forEach((c) => c()));

describe("running servers", () => {
  it("lists every server that announced itself, with its folder, Session, version and memory", () => {
    announce(101);
    announce(102);
    const list = listServers(dir, { isAlive: () => true });
    expect(list.map((s) => s.pid)).toEqual([101, 102]);
    expect(list[0]).toMatchObject({ kind: "session", root: "/work/app-101", session: "s-101", version: "9.9.9" });
    expect(list[0]!.memory).toBeGreaterThan(0);
    expect(Date.parse(list[0]!.startedAt)).not.toBeNaN();
  });

  it("forgets a server when it closes", () => {
    const s = announce(101);
    s.close();
    expect(listServers(dir, { isAlive: () => true })).toEqual([]);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("leaves out servers whose process has died, and clears their record", () => {
    announce(101);
    announce(102);
    const list = listServers(dir, { isAlive: (pid) => pid === 102 });
    expect(list.map((s) => s.pid)).toEqual([102]);
    expect(existsSync(join(dir, "101.json"))).toBe(false);
  });

  it("leaves out a server that stopped refreshing its record", () => {
    announce(101);
    const later = () => new Date(Date.now() + 120_000);
    expect(listServers(dir, { isAlive: () => true, now: later })).toEqual([]);
  });

  it("refreshes the record while running", async () => {
    announce(101, { beatMs: 20 });
    const first = listServers(dir, { isAlive: () => true })[0]!.beatAt;
    await until(() => listServers(dir, { isAlive: () => true })[0]!.beatAt !== first);
  });

  it("asks a listed server to stop, and the server hears it", async () => {
    const a = announce(101);
    const b = announce(102);
    expect(requestStop(dir, 101, { isAlive: () => true })).toBe(true);
    await until(() => a.stops.length === 1);
    await wait(50);
    expect(a.stops).toEqual([101]);
    expect(b.stops).toEqual([]);
  });

  it("refuses to stop a process that is not a listed server", () => {
    announce(101);
    expect(requestStop(dir, 999, { isAlive: () => true })).toBe(false);
    expect(existsSync(join(dir, "999.stop"))).toBe(false);
  });

  it("ignores records it cannot read", () => {
    announce(101);
    writeFileSync(join(dir, "55.json"), "not json");
    expect(listServers(dir, { isAlive: () => true }).map((s) => s.pid)).toEqual([101]);
  });
});
