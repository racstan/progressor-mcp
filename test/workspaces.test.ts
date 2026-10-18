import { describe, expect, it } from "vitest";
import { groupByWorkspace, placeIn } from "../src/ui/workspaces.js";

const ws = (id: string, root: string) => ({ id, name: id, root });
const project = (id: string, root: string, workspace?: string) => ({ id, name: id, root, workspace });

describe("groupByWorkspace", () => {
  it("groups projects under their Workspace by name, then the ones in no Workspace", () => {
    const work = ws("work", "C:\\work");
    const play = ws("play", "C:\\play");
    const empty = ws("empty", "C:\\empty");
    const groups = groupByWorkspace(
      [project("a", "C:\\work\\a", "work"), project("b", "C:\\play\\b", "play"), project("c", "D:\\c"), project("d", "C:\\gone\\d", "gone")],
      [work, play, empty],
    );
    expect(groups.map((g) => [g.workspace?.id, g.projects.map((p) => p.id)])).toEqual([
      ["play", ["b"]],
      ["work", ["a"]],
      [undefined, ["c", "d"]],
    ]);
  });
});

describe("placeIn", () => {
  it("shows a project's folder relative to its Workspace", () => {
    const work = ws("work", "C:\\work");
    expect(placeIn("C:\\work\\clients\\acme", work)).toBe("clients/acme");
    expect(placeIn("C:\\work", work)).toBe(".");
    expect(placeIn("/home/me/app", undefined)).toBe("/home/me/app");
    expect(placeIn("/srv/x/app", ws("w", "/srv/x"))).toBe("app");
  });
});
