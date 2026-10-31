import { describe, expect, it } from "vitest";
import { finishedNote, newlyFinished, snapshot } from "../src/ui/notify.js";

const project = (id: string, goals: [string, string][]) => ({ id, name: id.toUpperCase(), goals: goals.map(([g, status]) => ({ id: g, title: `Goal ${g}`, status })) });

describe("newlyFinished", () => {
  it("finds goals that went from open to finished, in any project", () => {
    const before = snapshot([project("a", [["login", "active"], ["logo", "planned"]]), project("b", [["seo", "paused"]])]);
    const now = [project("a", [["login", "done"], ["logo", "planned"]]), project("b", [["seo", "done"]])];
    expect(newlyFinished(before, now).map((f) => [f.project.id, f.goal.id])).toEqual([["a", "login"], ["b", "seo"]]);
  });

  it("finds nothing on the first look, when nothing was seen before", () => {
    expect(newlyFinished(undefined, [project("a", [["login", "done"]])])).toEqual([]);
  });

  it("leaves out goals already finished, new goals added finished, new projects and cancelled goals", () => {
    const before = snapshot([project("a", [["old", "done"], ["dropped", "active"]])]);
    const now = [project("a", [["old", "done"], ["added", "done"], ["dropped", "dropped"]]), project("new", [["x", "done"]])];
    expect(newlyFinished(before, now)).toEqual([]);
  });
});

describe("finishedNote", () => {
  it("says which goal finished in which project", () => {
    const now = [project("shop", [["login", "done"]])];
    expect(finishedNote({ project: now[0]!, goal: now[0]!.goals[0]! })).toEqual({
      title: "Finished: Goal login",
      body: "In SHOP. Click to open it.",
      tag: "progressor-finished/shop/login",
    });
  });
});
