import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultRegistryFile, listProjects, registerProject } from "../src/dashboard/registry.js";
import { tempDir } from "./tmp.js";

let registry: string;

/** A project folder with a .progressor/ in it, as a running Progressor server leaves behind. */
function project(name: string): string {
  const root = join(tempDir("progressor-reg-"), name);
  mkdirSync(join(root, ".progressor"), { recursive: true });
  return root;
}

beforeEach(() => {
  registry = join(tempDir("progressor-reg-"), "projects.json");
});

describe("the project registry", () => {
  it("records each project once, under a stable ID made from its folder name", () => {
    const root = project("my-app");
    const first = registerProject(root, registry);
    const again = registerProject(root, registry);
    expect(first).toEqual(again);
    expect(first.name).toBe("my-app");
    expect(first.root).toBe(root);
    expect(first.id).toMatch(/^my-app-[0-9a-f]{6}$/);
    expect(listProjects(registry)).toEqual([first]);
  });

  it("tells apart two projects whose folders have the same name", () => {
    const a = registerProject(project("api"), registry);
    const b = registerProject(project("api"), registry);
    expect(a.id).not.toBe(b.id);
    expect(listProjects(registry).map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("lists projects by name and hides those whose folder or .progressor/ is gone", () => {
    const zed = registerProject(project("zed"), registry);
    const alpha = registerProject(project("alpha"), registry);
    const noRecord = join(tempDir("progressor-reg-"), "empty");
    mkdirSync(noRecord);
    registerProject(noRecord, registry);
    registerProject(join(tempDir("progressor-reg-"), "deleted"), registry);
    expect(listProjects(registry).map((p) => p.name)).toEqual([alpha.name, zed.name]);
  });

  it("starts over when the registry file is missing or unreadable", () => {
    writeFileSync(registry, "{ not json");
    expect(listProjects(registry)).toEqual([]);
    const p = registerProject(project("app"), registry);
    expect(listProjects(registry)).toEqual([p]);
  });
});

describe("where the registry lives", () => {
  const saved = process.env.PROGRESSOR_REGISTRY;
  afterEach(() => {
    if (saved === undefined) delete process.env.PROGRESSOR_REGISTRY;
    else process.env.PROGRESSOR_REGISTRY = saved;
  });

  it("is ~/.progressor/projects.json unless PROGRESSOR_REGISTRY says otherwise", () => {
    delete process.env.PROGRESSOR_REGISTRY;
    expect(defaultRegistryFile()).toBe(join(homedir(), ".progressor", "projects.json"));
    process.env.PROGRESSOR_REGISTRY = "/tmp/elsewhere.json";
    expect(defaultRegistryFile()).toBe("/tmp/elsewhere.json");
  });

  it("is never the real one while the tests run", () => {
    expect(basename(saved ?? "")).toBe("projects.json");
    expect(saved).not.toBe(join(homedir(), ".progressor", "projects.json"));
  });
});
