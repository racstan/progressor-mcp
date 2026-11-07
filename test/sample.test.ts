import { describe, expect, it } from "vitest";
import { PASS, SAMPLE_ID, onSampleSwitch, sampleAnswer, sampleOn, setSample, shiftDays } from "../src/ui/sample.js";
import { SAMPLE_SNAPSHOT } from "../src/ui/sampleData.js";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const answers = SAMPLE_SNAPSHOT.answers as Record<string, Any>;
const P = `/api/projects/${SAMPLE_ID}`;

describe("the tour's sample project", () => {
  it("is one project, named as a sample, with no real folder", () => {
    expect(answers["/api/projects"]).toEqual([expect.objectContaining({ id: SAMPLE_ID, name: "Sample: Recipe box", root: "Sample project" })]);
    expect(answers["/api/workspaces"]).toEqual([]);
    expect(JSON.stringify(SAMPLE_SNAPSHOT)).not.toMatch(/[A-Za-z]:\\\\|\/tmp\/|\/Users\/|\/home\/|AppData|progressor-sample-/);
  });

  it("has finished goals, one in progress, one waiting on you, and one up next", () => {
    const goals = answers[`${P}/roadmap`].goals as Any[];
    expect(goals.map((g) => g.status)).toEqual(expect.arrayContaining(["done", "active", "paused", "planned"]));
    for (const g of goals) expect(answers[`${P}/goals/${g.id}`]?.goal.id).toBe(g.id);
  });

  it("shows a step in progress and a side trip on the goal being worked on", () => {
    const active = (answers[`${P}/roadmap`].goals as Any[]).find((g) => g.status === "active");
    const nodes = answers[`${P}/goals/${active.id}`].graph.nodes as Any[];
    expect(nodes.some((n) => n.kind === "task" && n.status === "in progress")).toBe(true);
    expect(nodes.some((n) => n.kind === "detour")).toBe(true);
    expect(answers[`${P}/goals/${active.id}`].messages[0].reply).toBeTruthy();
  });

  it("has something to try by hand under Needs you, and a message answered by the AI", () => {
    const waiting = (answers[`${P}/roadmap`].goals as Any[]).find((g) => g.untriedTests > 0);
    expect(answers[`${P}/goals/${waiting.id}`].handTests[0].result).toBe("pending");
    expect(answers[`${P}/roadmap`].projectTalk.messages[0].reply).toBeTruthy();
  });

  it("has Dashboard numbers and Calendar entries, on Home too", () => {
    expect(answers[`${P}/stats`].steps).toBeTruthy();
    expect(answers[`${P}/calendar`].events.length).toBeGreaterThan(5);
    expect(answers["/api/overview"]).toHaveLength(1);
    expect(answers["/api/stats"].perProject).toBeTruthy();
  });
});

describe("what the sample answers", () => {
  const now = Date.parse(SAMPLE_SNAPSHOT.takenAt);

  it("answers the project list, Home and the sample's own pages", () => {
    expect(sampleAnswer("/api/projects", now)).toEqual(answers["/api/projects"]);
    expect(sampleAnswer("/api/overview", now)).toEqual(answers["/api/overview"]);
    expect(sampleAnswer(`${P}/roadmap`, now)).toEqual(answers[`${P}/roadmap`]);
  });

  it("has nothing for the sample's other pages, and leaves the rest to the server", () => {
    expect(sampleAnswer(`${P}/history`, now)).toBeUndefined();
    expect(sampleAnswer("/api/projects/someone-real/roadmap", now)).toBeUndefined();
    for (const path of ["/api/info", "/api/settings", "/api/settings?project=x", "/api/servers", "/api/search?q=a", "/api/daemon"])
      expect(sampleAnswer(path, now)).toBe(PASS);
  });

  it("moves its dates on to today, keeping the time of day", () => {
    const later = now + 3 * 86_400_000 + 3_600_000;
    const days = (sampleAnswer(`${P}/stats`, later) as Any).perDay as Any[];
    const before = answers[`${P}/stats`].perDay as Any[];
    expect(Date.parse(days.at(-1).day) - Date.parse(before.at(-1).day)).toBe(3 * 86_400_000);
    const goal = (sampleAnswer(`${P}/roadmap`, later) as Any).goals[0];
    expect(Date.parse(goal.updated.at) - Date.parse(answers[`${P}/roadmap`].goals[0].updated.at)).toBe(3 * 86_400_000);
    expect(goal.updatedAt - answers[`${P}/roadmap`].goals[0].updatedAt).toBe(3 * 86_400_000);
  });

  it("never changes the fixed data it answers from", () => {
    const copy = JSON.stringify(answers);
    sampleAnswer(`${P}/roadmap`, now + 9 * 86_400_000);
    expect(JSON.stringify(answers)).toBe(copy);
  });
});

describe("shifting dates", () => {
  it("moves timestamps and plain days, and nothing else", () => {
    expect(shiftDays({ a: "2026-11-01T10:00:00.000Z", b: "2026-11-01", c: ["2026-10-31"], d: "not 2026-11-01", e: 4 }, 2)).toEqual({
      a: "2026-11-03T10:00:00.000Z",
      b: "2026-11-03",
      c: ["2026-11-02"],
      d: "not 2026-11-01",
      e: 4,
    });
    expect(shiftDays({ updatedAt: 1_800_000_000_000, count: 1_800_000_000_000, sentAt: 5 }, 1)).toEqual({ updatedAt: 1_800_086_400_000, count: 1_800_000_000_000, sentAt: 5 });
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("switching the sample in and out", () => {
  it("tells the page each time it changes, and only then", () => {
    const seen: boolean[] = [];
    const stop = onSampleSwitch(() => seen.push(sampleOn()));
    setSample(true);
    setSample(true);
    setSample(false);
    stop();
    setSample(true);
    setSample(false);
    expect(seen).toEqual([true, false]);
  });
});
