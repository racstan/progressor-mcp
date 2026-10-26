import { describe, expect, it } from "vitest";
import { sortProjects } from "../src/ui/projectList.js";

const project = (name: string, statuses: string[] = []) => ({
  id: name.toLowerCase(),
  name,
  root: `C:\work\${name}`,
  goals: statuses.map((status, i) => ({ id: `g${i}`, status })),
});

describe("sortProjects", () => {
  it("puts projects with a Goal in progress first, then the rest, each by name", () => {
    const sorted = sortProjects([
      project("zebra", ["planned"]),
      project("Winorater", ["paused"]),
      project("alpha", ["done"]),
      project("Mango", ["active", "planned"]),
      project("beta"),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["Mango", "Winorater", "alpha", "beta", "zebra"]);
  });

  it("puts a project with a step waiting on the Developer before everything else", () => {
    const waiting = { ...project("zulu", ["active"]), goals: [{ id: "g", status: "active", waitingOnYou: true }] };
    const sorted = sortProjects([project("alpha", ["active"]), waiting, project("beta", ["done"])]);
    expect(sorted.map((p) => p.name)).toEqual(["zulu", "alpha", "beta"]);
    // a finished Goal does not call for the Developer, whatever its steps said
    const over = { ...project("zulu", ["done"]), goals: [{ id: "g", status: "done", waitingOnYou: true }] };
    expect(sortProjects([project("alpha", ["active"]), over]).map((p) => p.name)).toEqual(["alpha", "zulu"]);
  });

  it("sorts by name alone when it knows nothing about Goals", () => {
    const sorted = sortProjects([{ id: "b", name: "b", root: "/b" }, { id: "a", name: "A", root: "/a" }]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
