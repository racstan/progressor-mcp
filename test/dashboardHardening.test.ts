// The dashboard can be used only by its own page, reaches nothing outside the project, and cannot be
// crashed by what is sent to it.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { addWorkspace, projectEntry } from "../src/dashboard/registry.js";
import { Project } from "../src/project.js";
import { MAX_WISH_CHARS } from "../src/wishlist.js";
import { tempDir } from "./tmp.js";

let d: Dashboard;
let project: Project;
let registry: string;
let id: string;
let origin: string;
let token: string;
let shown: unknown[];

interface Raw {
  status: number;
  body: string;
}
/** A request made with Node's own client, so nothing is added to it and it can be cut short. */
function raw(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Raw> {
  return new Promise((done, fail) => {
    const url = new URL(d.url);
    const req = request({ host: url.hostname, port: url.port, path, method: options.method ?? "GET", headers: options.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done({ status: res.statusCode!, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", fail);
    req.end(options.body);
  });
}

const page = (extra: Record<string, string> = {}) => ({
  origin,
  "x-progressor": "notes",
  "content-type": "application/json",
  ...extra,
});
const addWish = (headers: Record<string, string>, text = "A wish") => raw(`/api/projects/${id}/wishes`, { method: "POST", headers, body: JSON.stringify({ text }) });

beforeEach(async () => {
  shown = [];
  const root = tempDir("progressor-hardening-");
  const ui = tempDir("progressor-ui-");
  writeFileSync(join(ui, "index.html"), "<!doctype html><html><head><title>Progressor</title></head><body></body></html>");
  project = new Project({ root, session: { id: "s-a", pid: process.pid } });
  project.addGoal("Dark mode", [{ title: "Add the switch" }]);
  registry = join(tempDir("progressor-registry-"), "projects.json");
  d = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000), uiDir: ui, reveal: (c) => shown.push(c) });
  id = projectEntry(root).id;
  origin = new URL(d.url).origin;
  const html = (await raw("/")).body;
  token = /<meta name="progressor-token" content="([^"]+)">/.exec(html)?.[1] ?? "";
});
afterEach(async () => {
  await d.close();
});

describe("a token on every write", () => {
  it("is put in the page the dashboard serves, and is a long random value", async () => {
    expect(token).toMatch(/^[0-9a-f]{32,}$/);
    expect((await raw("/goals/anything")).body).toContain(`content="${token}"`);
  });

  it("refuses a write with no token or the wrong one, however right its other headers are", async () => {
    // The test setup adds the token to writes that carry none; an empty one is how a missing token is sent here.
    expect((await addWish(page({ "x-progressor-token": "" }))).status).toBe(403);
    expect((await addWish(page({ "x-progressor-token": "0".repeat(token.length) }))).status).toBe(403);
    expect((await addWish(page({ "x-progressor-token": `${token}x` }))).status).toBe(403);
    expect(project.wishes()).toEqual([]);
  });

  it("accepts a write with the token, and still checks the header and the page's own Origin", async () => {
    expect((await addWish(page({ "x-progressor-token": token }))).status).toBe(201);
    expect(project.wishes()).toHaveLength(1);
    expect((await addWish(page({ "x-progressor-token": token, origin: "https://evil.example" }))).status).toBe(403);
    expect((await addWish(page({ "x-progressor-token": token, "x-progressor": "stop" }))).status).toBe(403);
    expect(project.wishes()).toHaveLength(1);
  });

  it("covers the other writes too: Show in folder and the file upload", async () => {
    const reveal = (extra: Record<string, string>) =>
      raw(`/api/projects/${id}/reveal`, { method: "POST", headers: page({ "x-progressor": "reveal", ...extra }), body: JSON.stringify({ path: ".progressor" }) });
    expect((await reveal({ "x-progressor-token": "" })).status).toBe(403);
    expect((await reveal({ "x-progressor-token": token })).status).toBe(200);
    project.addWish("Look like this");
    const upload = (extra: Record<string, string>) =>
      raw(`/api/projects/${id}/wishes/w1/attachments`, { method: "POST", headers: page({ "content-type": "application/octet-stream", ...extra }), body: "data" });
    expect((await upload({ "x-progressor-token": "" })).status).toBe(403);
    expect((await upload({ "x-progressor-token": token })).status).toBe(201);
  });
});

describe("downloading a wish's attached file", () => {
  it("answers only for a wish that exists, and never reaches a folder outside the attachments", async () => {
    project.addWish("Look like this");
    project.attachToWish("w1", "shot.png", Buffer.from("PNG"));
    mkdirSync(join(project.root, ".progressor", "attachments", "w1", "x"), { recursive: true });
    expect((await raw(`/api/projects/${id}/wishes/w1/attachments/1-shot.png`)).status).toBe(200);
    expect((await raw(`/api/projects/${id}/wishes/w9/attachments/1-shot.png`)).status).toBe(404);
    expect((await raw(`/api/projects/${id}/wishes/..%2Fgoals/attachments/dark-mode.md`)).status).toBe(404);
    expect((await raw(`/api/projects/${id}/wishes/..%2F..%2F/attachments/index.json`)).status).toBe(404);
    expect((await raw(`/api/projects/${id}/wishes/w1/attachments/..%2F..%2Fwishlist.md`)).status).toBe(404);
  });

  it("is checked in the project too, so an odd wish ID never builds a path", () => {
    project.addWish("Look like this");
    project.attachToWish("w1", "shot.png", Buffer.from("PNG"));
    for (const bad of ["../goals", "..", "w1/../w1", "W1", "w", "w1 ", "w1\\..", ""]) {
      expect(project.attachmentFile(bad, "1-shot.png")).toBeUndefined();
      expect(() => project.removeAttachment(bad, "1-shot.png")).toThrow();
      expect(() => project.attachToWish(bad, "a.png", Buffer.from("x"))).toThrow();
    }
    expect(project.attachmentFile("w1", "1-shot.png")?.name).toBe("shot.png");
  });
});

describe("cross-site requests", () => {
  it("ignores a rescan asked for by another site", async () => {
    const ws = tempDir("progressor-ws-");
    addWorkspace(ws, registry);
    const names = async (path: string, headers?: Record<string, string>) => (JSON.parse((await raw(path, { headers })).body) as { name: string }[]).map((p) => p.name);
    await names("/api/projects"); // scans the Workspace once
    new Project({ root: join(ws, "notes"), session: { id: "s-y", pid: process.pid } }).addGoal("Write it up");
    expect(await names("/api/projects?rescan", { "sec-fetch-site": "cross-site" })).not.toContain("notes");
    expect(await names("/api/projects?rescan", { "sec-fetch-site": "same-origin" })).toContain("notes");
  });

  it("gives a cross-site search nothing, and any other its results", async () => {
    expect(JSON.parse((await raw("/api/search?q=dark", { headers: { "sec-fetch-site": "cross-site" } })).body)).toEqual([]);
    expect(JSON.parse((await raw("/api/search?q=dark")).body).length).toBeGreaterThan(0);
  });
});

describe("uploads and long wishes", () => {
  beforeEach(() => {
    project.addWish("Look like this");
  });
  const upload = (headers: Record<string, string> = {}, body?: string) =>
    raw(`/api/projects/${id}/wishes/w1/attachments`, {
      method: "POST",
      headers: page({ "content-type": "application/octet-stream", "x-progressor-token": token, ...headers }),
      body,
    });

  it("refuses a file that says up front it is too big, without reading it", async () => {
    const res = await upload({ "content-length": String(200 * 1024 * 1024) }); // past what is read and thrown away
    expect(res.status).toBe(413);
    expect(res.body).toMatch(/too big/);
  });

  it("stops reading a file that turns out too big, and closes the connection", async () => {
    const url = new URL(d.url);
    const result = await new Promise<{ status: number; closed: boolean; sent: number }>((done, fail) => {
      let status = 0;
      const req = request(
        {
          host: url.hostname,
          port: url.port,
          path: `/api/projects/${id}/wishes/w1/attachments`,
          method: "POST",
          headers: page({ "content-type": "application/octet-stream", "x-progressor-token": token }),
          agent: false,
        },
        (res) => {
          status = res.statusCode!;
          res.resume();
        },
      );
      req.on("error", () => undefined);
      let sent = 0;
      req.on("close", () => done({ status, closed: true, sent }));
      const chunk = Buffer.alloc(1024 * 1024, 1);
      const send = () => {
        if (req.destroyed || sent > 200) return;
        sent += 1;
        req.write(chunk, () => setTimeout(send, 0));
      };
      send();
      setTimeout(() => fail(new Error("the server kept reading")), 20_000);
    });
    // The server answers "too big" and hangs up; the sender may see the answer or only the hang-up.
    expect(result.closed).toBe(true);
    expect([0, 413]).toContain(result.status);
    expect(result.sent).toBeLessThan(150); // it stopped taking the file soon after the 25 MB limit
  });

  it("allows only a few uploads at once", async () => {
    const url = new URL(d.url);
    const held: ReturnType<typeof request>[] = [];
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const req = request(
        {
          host: url.hostname,
          port: url.port,
          path: `/api/projects/${id}/wishes/w1/attachments`,
          method: "POST",
          headers: page({ "content-type": "application/octet-stream", "x-progressor-token": token, "content-length": "1000" }),
          agent: false,
        },
        (res) => {
          statuses.push(res.statusCode!);
          res.resume();
        },
      );
      req.on("error", () => undefined);
      req.write("part"); // never finished, so this upload stays in progress
      held.push(req);
      await new Promise((r) => setTimeout(r, 40));
    }
    expect(statuses).toContain(429);
    expect(statuses.length).toBeLessThan(8); // the first ones are still waiting for their files
    for (const r of held) r.destroy();
    await new Promise((r) => setTimeout(r, 300));
    expect((await upload({}, "data")).status).toBe(201); // once they are gone, an upload goes through again
  });

  it("keeps a wish to a sensible length on the server, saying so plainly", async () => {
    project.removeWish("w1");
    const long = "x".repeat(MAX_WISH_CHARS + 1);
    const res = await addWish(page({ "x-progressor-token": token }), long);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/too long/);
    expect(project.wishes()).toEqual([]);
    expect((await addWish(page({ "x-progressor-token": token }), "x".repeat(MAX_WISH_CHARS))).status).toBe(201);
    expect(() => project.updateWish("w1", { text: long })).toThrow(/too long/);
  });
});

describe("a malformed address", () => {
  it("is answered 400 on every kind of route, and the server goes on", async () => {
    const routes: [string, string][] = [
      ["GET", "/api/projects/%zz/roadmap"],
      ["GET", "/%E0%A4%A"],
      ["GET", "/api/projects/%/goals/x"],
      ["POST", "/api/projects/%zz/reveal"],
      ["POST", "/api/projects/a/wishes/%zz/attachments"],
      ["POST", "/api/projects/a/goals/%zz/messages"],
    ];
    for (const [method, path] of routes) {
      const res = await raw(path, { method, headers: method === "POST" ? page({ "x-progressor-token": token }) : undefined });
      expect([method, path, res.status]).toEqual([method, path, 400]);
    }
    expect((await raw("/api/info")).status).toBe(200);
  });
});

describe("Show in folder", () => {
  it("opens nothing for a network or absolute path", async () => {
    for (const path of ["\\\\server\\share\\x", "//server/share/x", "C:\\Windows", "/etc/passwd", "\\\\?\\C:\\x"]) {
      const res = await raw(`/api/projects/${id}/reveal`, {
        method: "POST",
        headers: page({ "x-progressor": "reveal", "x-progressor-token": token }),
        body: JSON.stringify({ path }),
      });
      expect([path, res.status]).toEqual([path, 404]);
    }
    expect(shown).toEqual([]);
    expect(existsSync(project.root)).toBe(true);
  });
});
