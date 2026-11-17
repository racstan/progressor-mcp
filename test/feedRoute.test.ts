import { describe, expect, it } from "vitest";
import { buildFeed } from "../src/feed.js";
import { feedGoals } from "../src/dashboard/routes/feed.js";
import { Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

describe("the feed of a real project", () => {
  it("lists a finished step, a decision and a question in plain words", () => {
    const root = tempDir("progressor-feed-");
    const p = new Project({ root, session: { id: "s", pid: process.pid }, isAlive: (pid) => pid === process.pid });
    p.addGoal("Login", [{ title: "Route" }]);
    p.claimGoal("login");
    p.startTask("t1");
    p.completeTask("t1", []);
    p.addDecision("Use cookies");
    p.askDeveloper("Which provider?", ["A", "B"]);
    const feed = buildFeed(feedGoals(p));
    const texts = feed.map((i) => i.text);
    expect(texts).toContain("finished step t1 Route");
    expect(texts).toContain("added a decision");
    expect(texts).toContain("asked you a question");
    expect(feed.every((i) => i.goalTitle === "Login")).toBe(true);
  });
});
