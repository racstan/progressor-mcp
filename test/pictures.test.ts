import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { createServer } from "../src/server.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

/** A real 1x1 PNG. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
const NOW = new Date("2026-10-28T10:00:00.000Z");

let root: string;
let agent: Project;
let client: Client;
let shots: string;

beforeEach(async () => {
  root = tempDir("progressor-pictures-");
  shots = tempDir("progressor-shots-");
  agent = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => NOW });
  const goal = agent.addGoal("Dark mode", [{ title: "Add the switch" }]);
  agent.claimGoal(goal.id);
  agent.addHandTest("Flip the switch", undefined, "t1");
  const server = createServer(agent);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

const call = async (args: Record<string, unknown>) => {
  const r = (await client.callTool({ name: "attach_picture", arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
};
const shot = (name = "shot.png", bytes: Buffer = PNG) => {
  const file = join(shots, name);
  writeFileSync(file, bytes);
  return file;
};
const stored = (name: string) => join(root, ".progressor/pictures/dark-mode", name);
const ignore = () => readFileSync(join(root, ".progressor/.gitignore"), "utf8");

describe("attach_picture", () => {
  it("attaches to the goal, a step or a hand test, with a safe stored name", async () => {
    expect((await call({ path: shot(), caption: "The switch" })).text).toMatch(/^Attached p1 to the Goal: The switch\. The Developer sees it on the dashboard\./);
    expect((await call({ path: shot("Weird Name.JPG"), caption: "Step view", task: "t1" })).text).toMatch(/^Attached p2 to step t1: Step view\./);
    expect((await call({ path: shot("rec.webm"), caption: "Recording", hand_test: "h1" })).text).toMatch(/^Attached p3 to hand test h1: Recording\./);
    expect(readFileSync(stored("p1.png"))).toEqual(PNG);
    expect(existsSync(stored("p2.jpg"))).toBe(true);
    expect(agent.pictures("dark-mode")).toEqual([
      { id: "p1", file: "p1.png", caption: "The switch", kind: "image", addedAt: NOW.toISOString() },
      { id: "p2", file: "p2.jpg", caption: "Step view", task: "t1", kind: "image", addedAt: NOW.toISOString() },
      { id: "p3", file: "p3.webm", caption: "Recording", handTest: "h1", kind: "video", addedAt: NOW.toISOString() },
    ]);
    expect(JSON.parse(readFileSync(stored("index.json"), "utf8"))).toHaveLength(3);
  });

  it("copies the file and never moves it, and takes a path from the project folder", async () => {
    writeFileSync(join(root, "local.png"), PNG);
    expect((await call({ path: "local.png", caption: "Local" })).isError).toBe(false);
    expect(existsSync(join(root, "local.png"))).toBe(true);
    expect(existsSync(stored("p1.png"))).toBe(true);
  });

  it("cuts a long caption to 200 characters", async () => {
    await call({ path: shot(), caption: "x".repeat(300) });
    expect(agent.pictures("dark-mode")[0]!.caption).toHaveLength(200);
  });

  it("is refused for an unknown step or hand test, a missing file, a wrong type, a big file or an empty caption", async () => {
    const bad: [Record<string, unknown>, RegExp][] = [
      [{ path: shot(), caption: "c", task: "t9" }, /No step t9/],
      [{ path: shot(), caption: "c", hand_test: "h9" }, /No hand test h9/],
      [{ path: join(shots, "nope.png"), caption: "c" }, /no file/i],
      [{ path: shot("notes.txt", Buffer.from("hi")), caption: "c" }, /cannot be attached/],
      [{ path: shot("huge.png", Buffer.alloc(10 * 1024 * 1024 + 1)), caption: "c" }, /limit is 10 MB/],
      [{ path: shot(), caption: "   " }, /needs a caption/],
    ];
    for (const [args, error] of bad) {
      const r = await call(args);
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(error);
    }
    expect(agent.pictures("dark-mode")).toEqual([]);
    expect(existsSync(join(root, ".progressor/pictures"))).toBe(false);
  });

  it("is refused when the goal is not claimed", async () => {
    agent.releaseGoal();
    const r = await call({ path: shot(), caption: "c" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/no Goal|claim/i);
  });

  it("removes a picture and its file", async () => {
    await call({ path: shot(), caption: "One" });
    await call({ path: shot(), caption: "Two" });
    expect((await call({ remove: "p1" })).text).toMatch(/^Removed picture p1\./);
    expect(existsSync(stored("p1.png"))).toBe(false);
    expect(agent.pictures("dark-mode").map((p) => p.id)).toEqual(["p2"]);
    await call({ path: shot(), caption: "Three" });
    expect(agent.pictures("dark-mode").map((p) => p.id)).toEqual(["p2", "p3"]);
    expect((await call({ remove: "p9" })).isError).toBe(true);
  });
});

describe("keeping pictures out of git", () => {
  it("adds pictures/ once and keeps talk/ and what was there", async () => {
    writeFileSync(join(root, ".progressor/.gitignore"), "scratch/\n");
    await call({ path: shot(), caption: "a" });
    await call({ path: shot(), caption: "b" });
    expect(ignore().match(/^pictures\/$/gm)).toHaveLength(1);
    agent.askDeveloper("A or B?", ["A", "B"]);
    agent.askDeveloper("C or D?", ["C", "D"]);
    await call({ path: shot(), caption: "c" });
    expect(ignore().match(/^talk\/$/gm)).toHaveLength(1);
    expect(ignore().match(/^pictures\/$/gm)).toHaveLength(1);
    expect(ignore()).toContain("scratch/");
  });
});

describe("pictures on the dashboard", () => {
  let d: Dashboard;
  let id: string;
  const get = (path: string, headers: Record<string, string> = {}) => fetch(new URL(`/api/projects/${id}/${path}`, d.url), { headers });

  beforeEach(async () => {
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    d = await startDashboard({ project: agent, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    id = projectEntry(root).id;
    await call({ path: shot(), caption: "The switch", task: "t1" });
  });
  afterEach(async () => {
    await d.close();
  });

  it("the goal view lists them with an address", async () => {
    const view = (await (await get("goals/dark-mode")).json()) as { pictures: { id: string; url: string }[] };
    expect(view.pictures).toMatchObject([{ id: "p1", caption: "The switch", task: "t1", file: "p1.png", url: `/api/projects/${id}/goals/dark-mode/pictures/p1.png?v=2026-10-28T10%3A00%3A00.000Z` }]);
    expect((await fetch(new URL(view.pictures[0]!.url, d.url))).status).toBe(200);
  });

  it("serves a listed file with its content type", async () => {
    const res = await get("goals/dark-mode/pictures/p1.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
  });

  it("serves a part of a recording when asked", async () => {
    await call({ path: shot("rec.mp4", Buffer.from("0123456789")), caption: "Clip" });
    const res = await get("goals/dark-mode/pictures/p2.mp4", { range: "bytes=2-5" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await res.text()).toBe("2345");
    expect((await get("goals/dark-mode/pictures/p2.mp4", { range: "bytes=50-" })).status).toBe(416);
  });

  it("answers 404 for a name that is not listed, for .. and for another goal's picture", async () => {
    writeFileSync(stored("secret.png"), PNG);
    agent.addGoal("Other goal", []);
    expect((await get("goals/dark-mode/pictures/secret.png")).status).toBe(404);
    expect((await get("goals/dark-mode/pictures/p9.png")).status).toBe(404);
    expect((await get("goals/dark-mode/pictures/..%2Findex.json")).status).toBe(404);
    expect((await get("goals/dark-mode/pictures/%2e%2e%2f..%2fgoals%2Fdark-mode.md")).status).toBe(404);
    expect((await get("goals/..%2Fpictures%2Fdark-mode/pictures/p1.png")).status).toBe(404);
    expect((await get("goals/other-goal/pictures/p1.png")).status).toBe(404);
    expect((await get("goals/no-such-goal/pictures/p1.png")).status).toBe(404);
    mkdirSync(join(root, ".progressor/pictures/other-goal"), { recursive: true });
    expect((await get("goals/other-goal/pictures/p1.png")).status).toBe(404);
  });
});
