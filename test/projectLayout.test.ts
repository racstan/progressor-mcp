import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT, addGroup, arrange, cleanLayout, moveGroup, moveProject, removeGroup, renameGroup } from "../src/projectLayout.js";

const p = (id: string) => ({ id, name: id.toUpperCase() });
const all = [p("a"), p("b"), p("c"), p("d")];
const ids = (sections: ReturnType<typeof arrange<{ id: string; name: string }>>) =>
  sections.map((s) => `${s.group?.name ?? "-"}: ${s.projects.map((x) => x.id).join(" ")}`);

describe("arranging projects into groups and a chosen order", () => {
  it("with nothing chosen, is one list in the usual order", () => {
    expect(ids(arrange(all, EMPTY_LAYOUT))).toEqual(["-: a b c d"]);
  });

  it("puts projects in the order chosen, new ones after in the usual order, then each group, even an empty one", () => {
    const layout = { groups: [{ id: "g1", name: "Work" }, { id: "g2", name: "Fun" }], order: ["c", "a", "gone"], groupOf: { d: "g1", b: "nope" } };
    expect(ids(arrange(all, layout))).toEqual(["-: c a b", "Work: d", "Fun: "]);
  });
});

describe("moving a project", () => {
  it("drops it before another project, in that project's group", () => {
    let layout = addGroup(EMPTY_LAYOUT, "Work").layout;
    const g = layout.groups[0]!.id;
    layout = moveProject(layout, all, "d", g, undefined);
    expect(ids(arrange(all, layout))).toEqual(["-: a b c", "Work: d"]);
    layout = moveProject(layout, all, "a", g, "d");
    expect(ids(arrange(all, layout))).toEqual(["-: b c", "Work: a d"]);
    layout = moveProject(layout, all, "c", undefined, "b");
    expect(ids(arrange(all, layout))).toEqual(["-: c b", "Work: a d"]);
  });

  it("dropped on a group itself, goes to the end of it", () => {
    let layout = addGroup(EMPTY_LAYOUT, "Work").layout;
    const g = layout.groups[0]!.id;
    layout = moveProject(layout, all, "a", g, undefined);
    layout = moveProject(layout, all, "b", g, undefined);
    expect(ids(arrange(all, layout))).toEqual(["-: c d", "Work: a b"]);
  });

  it("moves up or down one place with the keyboard", () => {
    let layout = moveProject(EMPTY_LAYOUT, all, "c", undefined, "b");
    expect(ids(arrange(all, layout))).toEqual(["-: a c b d"]);
    layout = moveProject(layout, all, "a", undefined, "d");
    expect(ids(arrange(all, layout))).toEqual(["-: c b a d"]);
  });
});

describe("groups", () => {
  it("are added with a unique ID, renamed, moved and removed (their projects go back to no group)", () => {
    let { layout, id } = addGroup(EMPTY_LAYOUT, "  Work  ");
    const second = addGroup(layout, "Work");
    layout = second.layout;
    expect(layout.groups.map((g) => g.name)).toEqual(["Work", "Work"]);
    expect(second.id).not.toBe(id);
    layout = renameGroup(layout, id, "Clients");
    layout = moveGroup(layout, second.id, -1);
    expect(layout.groups.map((g) => g.name)).toEqual(["Work", "Clients"]);
    layout = moveProject(layout, all, "a", id, undefined);
    layout = removeGroup(layout, id);
    expect(layout.groups.map((g) => g.name)).toEqual(["Work"]);
    expect(layout.groupOf).toEqual({});
  });

  it("refuses an empty name", () => {
    expect(() => addGroup(EMPTY_LAYOUT, "  ")).toThrow(/name/);
    expect(() => renameGroup(addGroup(EMPTY_LAYOUT, "W").layout, "x", "")).toThrow(/name/);
  });
});

describe("a layout read from a file or a request", () => {
  it("keeps only what makes sense", () => {
    expect(cleanLayout(null)).toEqual(EMPTY_LAYOUT);
    expect(cleanLayout({ groups: [{ id: "g1", name: "W" }, { id: 3 }, { id: "g1", name: "dup" }], order: ["a", 4, "a"], groupOf: { a: "g1", b: "missing", c: 5 } })).toEqual({
      groups: [{ id: "g1", name: "W" }],
      order: ["a"],
      groupOf: { a: "g1" },
    });
    expect(cleanLayout({ groups: [{ id: "g1", name: "x".repeat(200) }] }).groups[0]!.name).toHaveLength(60);
  });
});

describe("the dashboard keeps the layout", () => {
  it("answers it, saves a cleaned one from its own page only, and keeps it on this computer", async () => {
    const { join } = await import("node:path");
    const { existsSync } = await import("node:fs");
    const { startDashboard } = await import("../src/dashboard/http.js");
    const { Project } = await import("../src/project.js");
    const { tempDir } = await import("./tmp.js");
    const registry = join(tempDir("progressor-layout-"), "projects.json");
    const project = new Project({ root: tempDir("progressor-layout-p-"), session: { id: "s", pid: process.pid } });
    const d = await startDashboard({ project, registryFile: registry, port: 20000 + Math.floor(Math.random() * 20000) });
    try {
      const url = new URL("/api/project-layout", d.url);
      expect(await (await fetch(url)).json()).toEqual(EMPTY_LAYOUT);
      const post = (body: unknown, origin = new URL(d.url).origin) =>
        fetch(url, { method: "POST", headers: { origin, "x-progressor": "layout", "content-type": "application/json" }, body: JSON.stringify(body) });
      expect((await post({ layout: { groups: [] } }, "https://evil.example")).status).toBe(403);
      const saved = await post({ layout: { groups: [{ id: "g1", name: "Work" }], order: ["b", "a"], groupOf: { a: "g1", z: "gone" } } });
      expect(saved.status).toBe(200);
      const want = { groups: [{ id: "g1", name: "Work" }], order: ["b", "a"], groupOf: { a: "g1" } };
      expect(await saved.json()).toEqual(want);
      expect(await (await fetch(url)).json()).toEqual(want);
      expect(existsSync(join(registry, "..", "project-layout.json"))).toBe(true);
      expect((await post({ nope: 1 })).status).toBe(400);
    } finally {
      await d.close();
    }
  });
});
