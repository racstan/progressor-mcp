import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { insideProject, revealCommand } from "../src/dashboard/reveal.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

describe("the command that shows a file in the file manager", () => {
  it("selects the file on Windows and macOS, and opens its folder on Linux", () => {
    expect(revealCommand("win32", "C:\\p\\.progressor\\goals\\a.md", false)).toEqual({ command: "explorer.exe", args: ["/select,C:\\p\\.progressor\\goals\\a.md"] });
    expect(revealCommand("darwin", "/p/.progressor/goals/a.md", false)).toEqual({ command: "open", args: ["-R", "/p/.progressor/goals/a.md"] });
    expect(revealCommand("linux", "/p/.progressor/goals/a.md", false)).toEqual({ command: "xdg-open", args: ["/p/.progressor/goals"] });
  });

  it("opens a folder itself", () => {
    expect(revealCommand("win32", "C:\\p\\src", true)).toEqual({ command: "explorer.exe", args: ["C:\\p\\src"] });
    expect(revealCommand("darwin", "/p/src", true)).toEqual({ command: "open", args: ["/p/src"] });
    expect(revealCommand("linux", "/p/src", true)).toEqual({ command: "xdg-open", args: ["/p/src"] });
  });
});

describe("what may be shown", () => {
  let root: string;
  beforeEach(() => {
    root = tempDir("progressor-reveal-");
    mkdirSync(join(root, ".progressor/goals"), { recursive: true });
    writeFileSync(join(root, ".progressor/goals/a.md"), "# A\n");
  });

  it("is a file or folder inside the project that exists", () => {
    expect(insideProject(root, ".progressor/goals/a.md")).toEqual({ path: join(root, ".progressor/goals/a.md"), isDir: false });
    expect(insideProject(root, ".progressor/goals/a.md:12")).toEqual({ path: join(root, ".progressor/goals/a.md"), isDir: false });
    expect(insideProject(root, ".progressor")).toEqual({ path: join(root, ".progressor"), isDir: true });
  });

  it("is never outside the project, nor something missing", () => {
    expect(insideProject(root, "../etc/passwd")).toBeUndefined();
    expect(insideProject(root, "/etc/passwd")).toBeUndefined();
    expect(insideProject(root, ".progressor/goals/nope.md")).toBeUndefined();
    expect(insideProject(root, "")).toBeUndefined();
  });
});

describe("the dashboard's Show in folder", () => {
  let d: Dashboard;
  let root: string;
  let id: string;
  const shown: { command: string; args: string[] }[] = [];
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(new URL(`/api/projects/${id}/reveal`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": "reveal", "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    shown.length = 0;
    root = tempDir("progressor-reveal-");
    const project = new Project({ root, session: { id: "s-a", pid: process.pid } });
    project.addGoal("Dark mode", [{ title: "Add the switch" }]);
    const registry = join(tempDir("progressor-registry-"), "projects.json");
    d = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000), reveal: (c) => shown.push(c) });
    id = projectEntry(root).id;
  });
  afterEach(async () => {
    await d.close();
  });

  it("opens the file manager at a plan file", async () => {
    const res = await post({ path: ".progressor/goals/dark-mode.md" });
    expect(res.status).toBe(200);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.args.join(" ")).toContain(process.platform === "linux" ? join(root, ".progressor/goals") : "dark-mode.md");
  });

  it("refuses other pages, paths outside the project and missing files", async () => {
    expect((await post({ path: ".progressor/goals/dark-mode.md" }, { "x-progressor": "talk" })).status).toBe(403);
    expect((await post({ path: ".progressor/goals/dark-mode.md" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ path: "../../etc/passwd" })).status).toBe(404);
    expect((await post({ path: 5 })).status).toBe(400);
    expect(shown).toHaveLength(0);
  });
});
