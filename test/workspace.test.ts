import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { addWorkspace, registerProject } from "../src/dashboard/registry.js";
import { allProjects, findProjects } from "../src/dashboard/workspace.js";
import { tempDir } from "./tmp.js";

/** Makes a folder a Project: it has a Roadmap in its own .progressor/. */
function initialize(dir: string): void {
  mkdirSync(join(dir, ".progressor"), { recursive: true });
  writeFileSync(join(dir, ".progressor", "roadmap.md"), "# Roadmap\n");
}

const found = (root: string, options?: Parameters<typeof findProjects>[1]) =>
  findProjects(root, options).map((p) => relative(root, p).split("\\").join("/")).sort();

describe("findProjects", () => {
  it("finds the initialized folders at any depth, including the Workspace folder itself", () => {
    const root = tempDir("progressor-ws-");
    initialize(root);
    initialize(join(root, "shop"));
    initialize(join(root, "clients", "acme", "api"));
    mkdirSync(join(root, "notes"), { recursive: true });

    expect(found(root)).toEqual(["", "clients/acme/api", "shop"]);
  });

  it("finds Projects nested inside other Projects", () => {
    const root = tempDir("progressor-ws-");
    initialize(join(root, "mono"));
    initialize(join(root, "mono", "packages", "web"));

    expect(found(root)).toEqual(["mono", "mono/packages/web"]);
  });

  it("skips dependency, build and hidden folders", () => {
    const root = tempDir("progressor-ws-");
    for (const skipped of ["node_modules/pkg", ".git/x", "dist/app", ".cache/y", "target/z"]) initialize(join(root, skipped));
    initialize(join(root, "real"));

    expect(found(root)).toEqual(["real"]);
  });

  it("ignores a .progressor folder without a Roadmap, such as the per-user registry's", () => {
    const root = tempDir("progressor-ws-");
    mkdirSync(join(root, ".progressor"));
    writeFileSync(join(root, ".progressor", "projects.json"), "{}");

    expect(found(root)).toEqual([]);
  });

  it("stops at the depth limit", () => {
    const root = tempDir("progressor-ws-");
    initialize(join(root, "a", "b", "c"));

    expect(found(root, { maxDepth: 2 })).toEqual([]);
    expect(found(root, { maxDepth: 3 })).toEqual(["a/b/c"]);
  });

  it("finds nothing in a folder that does not exist", () => {
    expect(findProjects(join(tempDir("progressor-ws-"), "missing"))).toEqual([]);
  });
});

describe("allProjects", () => {
  it("combines registered and scanned projects once each, tagged with their innermost Workspace", () => {
    const registry = join(tempDir("progressor-ws-reg-"), "projects.json");
    const outer = tempDir("progressor-ws-");
    const inner = join(outer, "clients");
    initialize(join(outer, "shop"));
    initialize(join(inner, "acme"));
    const loose = tempDir("progressor-ws-loose-");
    initialize(loose);
    registerProject(join(outer, "shop"), registry);
    registerProject(loose, registry);
    const o = addWorkspace(outer, registry);
    mkdirSync(inner, { recursive: true });
    const i = addWorkspace(inner, registry);

    const all = allProjects(registry);
    const tag = (root: string) => all.find((p) => p.root === root)?.workspace;
    expect(all).toHaveLength(3);
    expect(tag(join(outer, "shop"))).toBe(o.id);
    expect(tag(join(inner, "acme"))).toBe(i.id);
    expect(tag(loose)).toBeUndefined();
  });

  it("does not tag a folder whose name only starts like the Workspace's", () => {
    const registry = join(tempDir("progressor-ws-reg-"), "projects.json");
    const base = tempDir("progressor-ws-");
    mkdirSync(join(base, "app"));
    initialize(join(base, "app-two"));
    addWorkspace(join(base, "app"), registry);
    registerProject(join(base, "app-two"), registry);

    expect(allProjects(registry)[0]!.workspace).toBeUndefined();
  });
});
