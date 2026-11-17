import { describe, expect, it } from "vitest";
import { type FeedGoal, buildFeed, digestLines, markNew } from "../src/feed.js";

const goal = (over: Partial<FeedGoal> = {}): FeedGoal => ({
  id: "login",
  title: "Login",
  status: "active",
  tasks: [],
  decisions: [],
  handTests: [],
  questions: [],
  ...over,
});

describe("buildFeed", () => {
  it("makes items from the plan's own dates, newest first", () => {
    const feed = buildFeed([
      goal({
        tasks: [
          { id: "t3", title: "Fix callback", status: "done", finishedAt: "2026-11-10T10:00:00Z" },
          { id: "t4", title: "Not yet", status: "pending" },
          { id: "t5", title: "Dropped", status: "dropped", finishedAt: "2026-11-10T11:00:00Z" },
        ],
        decisions: [{ id: "d1", text: "Use cookies", added: { at: "2026-11-11T09:00:00Z", by: "AI" } }],
        handTests: [{ id: "h1", text: "Sign in", result: "pending", added: { at: "2026-11-12T09:00:00Z", by: "AI" } }],
        questions: [{ id: "q1", text: "Which?", state: "open", askedAt: "2026-11-13T09:00:00Z" }],
      }),
    ]);
    expect(feed.map((i) => i.kind)).toEqual(["question", "handTest", "decision", "step"]);
    expect(feed[3]).toMatchObject({ by: "AI", goalId: "login", text: "finished step t3 Fix callback" });
    expect(feed[0]!.text).toBe("asked you a question");
  });

  it("says a finished goal, and who did a Developer change", () => {
    const feed = buildFeed([
      goal({ status: "done", updated: { at: "2026-11-14T00:00:00Z", by: "AI" } }),
      goal({
        id: "b",
        title: "B",
        decisions: [{ id: "d1", text: "x", added: { at: "2026-11-15T00:00:00Z", by: "Developer" } }],
        questions: [{ id: "q1", text: "Which?", state: "answered", askedAt: "2026-11-01T00:00:00Z", answeredAt: "2026-11-16T00:00:00Z" }],
        handTests: [{ id: "h1", text: "t", result: "works", added: { at: "2026-11-02T00:00:00Z", by: "AI" }, markedAt: "2026-11-17T00:00:00Z" }],
      }),
    ]);
    expect(feed[0]).toMatchObject({ kind: "tried", by: "Developer", text: "tried something" });
    expect(feed[1]).toMatchObject({ kind: "answered", by: "Developer" });
    expect(feed[2]).toMatchObject({ kind: "decision", by: "Developer" });
    expect(feed.find((i) => i.kind === "goal")).toMatchObject({ text: "finished goal Login", by: "AI" });
  });

  it("leaves out anything with no date and caps the length", () => {
    expect(buildFeed([goal({ status: "done" })])).toEqual([]);
    const tasks = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: "s", status: "done", finishedAt: `2026-11-0${i + 1}T00:00:00Z` }));
    expect(buildFeed([goal({ tasks })], 3)).toHaveLength(3);
  });
});

describe("markNew and digestLines", () => {
  const feed = buildFeed([
    goal({
      status: "done",
      updated: { at: "2026-11-16T00:00:00Z", by: "AI" },
      tasks: [
        { id: "t1", title: "A", status: "done", finishedAt: "2026-11-15T00:00:00Z" },
        { id: "t2", title: "B", status: "done", finishedAt: "2026-11-16T00:00:00Z" },
        { id: "t0", title: "Old", status: "done", finishedAt: "2026-11-01T00:00:00Z" },
      ],
      questions: [{ id: "q1", text: "?", state: "open", askedAt: "2026-11-16T01:00:00Z" }],
      handTests: [{ id: "h1", text: "t", result: "pending", added: { at: "2026-11-16T02:00:00Z", by: "AI" } }],
    }),
  ]);
  const since = Date.parse("2026-11-10T00:00:00Z");
  const now = Date.parse("2026-11-17T00:00:00Z");

  it("marks items newer than the last look, and never your own", () => {
    expect(markNew(feed, since).filter((i) => i.isNew)).toHaveLength(5);
    expect(markNew(feed, undefined).some((i) => i.isNew)).toBe(false);
  });

  it("sums what is new in plain words", () => {
    expect(digestLines(markNew(feed, since), since, now)).toBe(
      "Since you last looked (7 days ago): 2 steps finished, goal Login finished, 1 question waiting for you, 1 thing to try",
    );
  });

  it("says nothing is new", () => {
    expect(digestLines(markNew(feed, now), now, now + 1000)).toBe("Nothing new since you last looked.");
    expect(digestLines(markNew(feed, undefined), undefined, now)).toBe("Nothing new since you last looked.");
  });
});
