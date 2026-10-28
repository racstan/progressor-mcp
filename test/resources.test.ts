import { existsSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dashboardApi } from "../src/dashboard/http.js";
import { Project } from "../src/project.js";
import { DEFAULT_MINUTES, MAX_MINUTES, normalizeResource, resourceLine, resourcesFile } from "../src/resources.js";
import { createServer } from "../src/server.js";
import { resourceWords } from "../src/ui/words.js";
import { tempDir } from "./tmp.js";

let root: string;
let clock: Date;
const at = (iso: string) => {
  clock = new Date(iso);
};
const alive = new Set<number>();
/** A Session: its own id and a made-up pid that counts as running until it is removed from `alive`. */
const session = (id: string, pid: number) => {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, now: () => clock, isAlive: (p) => alive.has(p) });
};

beforeEach(() => {
  root = tempDir("progressor-locks-");
  at("2026-10-28T10:00:00.000Z");
  alive.clear();
});

afterEach(() => rmSync(resourcesFile(root), { force: true }));

describe("naming a resource", () => {
  it("ignores case and spacing, and refuses an empty name", () => {
    expect(normalizeResource("  Dev   Window ")).toBe("dev-window");
    expect(() => normalizeResource("   ")).toThrow(/name/);
  });
});

describe("claiming a resource", () => {
  it("claims a free resource and shows it", () => {
    const a = session("s-a", 9001);
    const r = a.resources().claim("dev window", { reason: "running the UI test" });
    expect(r.refreshed).toBe(false);
    const [lock] = a.resources().list();
    expect(lock).toMatchObject({ resource: "dev-window", session: "s-a", reason: "running the UI test", minutes: DEFAULT_MINUTES });
  });

  it("refuses a resource another Session holds, saying who, since when and why, and when to try again", () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    a.resources().claim("dev-window", { reason: "UI test", label: "helper: media run", task: "t3" });
    at("2026-10-28T10:04:00.000Z");
    expect(() => b.resources().claim("dev-window", { reason: "my test" })).toThrow(
      /dev-window is in use by helper: media run \(Session s-a\) since 4 m ago.*Reason: UI test \(task t3\).*free again in 26 m at the latest/s,
    );
  });

  it("refreshes its own claim and keeps the first start time", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "UI test" });
    at("2026-10-28T10:20:00.000Z");
    const r = a.resources().claim("dev-window", { reason: "UI test, second run" });
    expect(r.refreshed).toBe(true);
    const [lock] = a.resources().list();
    expect(lock!.since).toBe("2026-10-28T10:00:00.000Z");
    expect(lock!.refreshed).toBe("2026-10-28T10:20:00.000Z");
    expect(lock!.reason).toBe("UI test, second run");
  });

  it("treats a label as a separate holder inside one Session, so a second helper is refused", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "x", label: "helper: media" });
    expect(() => a.resources().claim("dev-window", { reason: "y", label: "helper: voice" })).toThrow(/in use by helper: media/);
    expect(() => a.resources().claim("dev-window", { reason: "z" })).toThrow(/in use by helper: media/);
    expect(a.resources().claim("dev-window", { reason: "again", label: "helper: media" }).refreshed).toBe(true);
  });

  it("frees a lock once its time is up, and a refresh restarts the time", () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    a.resources().claim("dev-window", { reason: "x", minutes: 10 });
    at("2026-10-28T10:09:00.000Z");
    expect(() => b.resources().claim("dev-window", { reason: "y" })).toThrow(/in use/);
    a.resources().claim("dev-window", { reason: "x", minutes: 10 });
    at("2026-10-28T10:18:00.000Z");
    expect(() => b.resources().claim("dev-window", { reason: "y" })).toThrow(/in use/);
    at("2026-10-28T10:20:00.000Z");
    expect(a.resources().list()).toEqual([]);
    expect(b.resources().claim("dev-window", { reason: "y" }).refreshed).toBe(false);
  });

  it("frees the locks of a Session that has ended", () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    a.resources().claim("plasmashell", { reason: "restart" });
    alive.delete(9001);
    expect(b.resources().list()).toEqual([]);
    expect(b.resources().claim("plasmashell", { reason: "mine" }).refreshed).toBe(false);
  });

  it("keeps the time within limits", () => {
    const a = session("s-a", 9001);
    a.resources().claim("x", { reason: "r", minutes: 100000 });
    a.resources().claim("y", { reason: "r", minutes: 0 });
    expect(a.resources().list().map((l) => l.minutes).sort((p, q) => p - q)).toEqual([1, MAX_MINUTES]);
  });
});

describe("releasing", () => {
  it("releases its own lock, says when nothing was held, and refuses another's unless forced", () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    a.resources().claim("dev-window", { reason: "x" });
    expect(() => b.resources().release("dev-window", {})).toThrow(/held by Session s-a/);
    expect(a.resources().release("dev-window", {})).toBe(true);
    expect(a.resources().release("dev-window", {})).toBe(false);
    a.resources().claim("dev-window", { reason: "x" });
    expect(b.resources().release("dev-window", { force: true })).toBe(true);
    expect(a.resources().list()).toEqual([]);
  });

  it("releaseAll frees what this Session holds, labelled or not, and nothing else", () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    a.resources().claim("one", { reason: "r" });
    a.resources().claim("two", { reason: "r", label: "helper" });
    b.resources().claim("three", { reason: "r" });
    a.resources().releaseAll();
    expect(b.resources().list().map((l) => l.resource)).toEqual(["three"]);
  });
});

describe("where the locks are kept", () => {
  it("never touches the plan: nothing is added under .progressor, the file is in the temp folder", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "x" });
    expect(existsSync(join(root, ".progressor"))).toBe(false);
    expect(existsSync(resourcesFile(root))).toBe(true);
    expect(readdirSync(root)).toEqual([]);
  });

  it("survives a damaged file", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "x" });
    writeFileSync(resourcesFile(root), "{ nope");
    expect(a.resources().list()).toEqual([]);
    expect(a.resources().claim("dev-window", { reason: "x" }).refreshed).toBe(false);
    expect(JSON.parse(readFileSync(resourcesFile(root), "utf8"))).toHaveLength(1);
  });
});

describe("how locks read", () => {
  it("says it in a line for get_status, and in plain words for the dashboard", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "UI test", label: "helper: media run", task: "t3" });
    at("2026-10-28T10:04:00.000Z");
    const [lock] = a.resources().list();
    expect(resourceLine(lock!, clock)).toBe("dev-window: helper: media run (Session s-a) for 4 m: UI test (task t3); free again in 26 m unless refreshed");
    expect(resourceWords(lock!, clock)).toBe("In use: dev window, by helper: media run, 4 m");
    expect(resourceWords({ ...lock!, label: undefined }, clock)).toBe("In use: dev window, by your AI, 4 m");
  });

  it("is listed by get_status and the dashboard's data", () => {
    const a = session("s-a", 9001);
    a.resources().claim("dev-window", { reason: "UI test" });
    const api = dashboardApi(new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now: () => clock, isAlive: (p) => alive.has(p) }));
    expect(api.roadmap().resources).toHaveLength(1);
  });
});

describe("through the tools", () => {
  it("claims, refuses, lists and releases, and get_status shows what is held", async () => {
    const a = session("s-a", 9001);
    const b = session("s-b", 9002);
    const connect = async (p: Project) => {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await createServer(p).connect(st);
      const c = new Client({ name: "t", version: "1" });
      await c.connect(ct);
      return async (name: string, args: Record<string, unknown> = {}) => {
        const r = (await c.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
        return { text: r.content.map((x) => x.text).join("\n"), isError: r.isError ?? false };
      };
    };
    const ca = await connect(a);
    const cb = await connect(b);
    const ok = await ca("claim_resource", { resource: "dev-window", reason: "UI test", label: "helper: media run" });
    expect(ok.isError).toBe(false);
    expect(ok.text).toMatch(/Claimed dev-window/);
    const refused = await cb("claim_resource", { resource: "dev-window", reason: "mine" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/in use by helper: media run/);
    expect((await cb("list_resources")).text).toMatch(/dev-window/);
    expect((await cb("get_status")).text).toMatch(/In use now.*dev-window/s);
    expect((await cb("release_resource", { resource: "dev-window" })).isError).toBe(true);
    expect((await ca("release_resource", { resource: "dev-window", label: "helper: media run" })).text).toMatch(/Released dev-window/);
    expect((await cb("list_resources")).text).toMatch(/Nothing is in use/);
  });
});
