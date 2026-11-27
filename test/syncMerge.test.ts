import { describe, expect, it } from "vitest";
import { mergePlanFile, mergePlanFolder } from "../src/sync/merge.js";

const T1 = "2026-03-01T10:00:00.000Z";
const T2 = "2026-03-02T10:00:00.000Z";
const T3 = "2026-03-03T10:00:00.000Z";

const ROADMAP = `# Roadmap

## Goals

- [x] Login ^login
  - outcome: People can sign in
  - updated: ${T1} by AI
- [ ] Billing ^billing
  - outcome: Take payments
  - updated: ${T1} by AI
- [ ] Reports ^reports
  - outcome: Weekly reports
  - updated: ${T1} by AI

## Later

- [ ] Dark mode ^later1
`;

const GOAL = `# Login

## Tasks

- [ ] Build the form ^t1
  - files: src/form.ts
  - updated: ${T1} by AI
- [ ] Add tests ^t2
  - files: test/form.test.ts
  - updated: ${T1} by AI

## Notes

- Remember the rate limit ^n1

## Hand tests

## Decisions
`;

const setLine = (text: string, from: string, to: string): string => {
  expect(text).toContain(from);
  return text.replace(from, to);
};

describe("mergePlanFile", () => {
  it("returns identical files byte for byte", () => {
    for (const s of [ROADMAP, GOAL, "", "just text\n", "no newline", "# T\n\n\n## A\n\n- x ^a\n\n\n## B\n"]) {
      const r = mergePlanFile(s, s, s);
      expect(r.text).toBe(s);
      expect(r.conflicts).toEqual([]);
    }
  });

  it("keeps different goals changed on each side", () => {
    const ours = setLine(ROADMAP, `Take payments\n  - updated: ${T1}`, `Take card payments\n  - updated: ${T2}`);
    const theirs = setLine(ROADMAP, `Weekly reports\n  - updated: ${T1}`, `Monthly reports\n  - updated: ${T2}`);
    const r = mergePlanFile(ROADMAP, ours, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.text).toContain("Take card payments");
    expect(r.text).toContain("Monthly reports");
    expect(r.text).not.toContain("Weekly reports");
  });

  it("keeps different steps of one goal changed on each side", () => {
    const ours = setLine(GOAL, "- [ ] Build the form ^t1", "- [x] Build the form ^t1");
    const theirs = setLine(GOAL, "- [ ] Add tests ^t2", "- [x] Add tests ^t2");
    const r = mergePlanFile(GOAL, ours, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.text).toContain("- [x] Build the form ^t1");
    expect(r.text).toContain("- [x] Add tests ^t2");
  });

  it("keeps the newer of the same step changed on both sides and reports the other", () => {
    const old = `- [ ] Build the form ^t1\n  - files: src/form.ts\n  - updated: ${T1}`;
    const ours = setLine(GOAL, old, `- [x] Build the form ^t1\n  - files: src/form.ts\n  - updated: ${T2}`);
    const theirs = setLine(GOAL, old, `- [ ] Build the form quickly ^t1\n  - files: src/form.ts\n  - updated: ${T3}`);
    const r = mergePlanFile(GOAL, ours, theirs);
    expect(r.text).toContain("Build the form quickly ^t1");
    expect(r.text).not.toContain("- [x] Build the form ^t1");
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ section: "Tasks", id: "t1", kept: "theirs" });
    expect(r.conflicts[0]!.lost).toContain("- [x] Build the form ^t1");
    // and the other way round
    const r2 = mergePlanFile(GOAL, theirs, ours);
    expect(r2.conflicts[0]).toMatchObject({ id: "t1", kept: "ours" });
  });

  it("falls back to file times, then to ours, when blocks carry no time", () => {
    const base = "## A\n\n- x ^a\n";
    const ours = "## A\n\n- ours ^a\n";
    const theirs = "## A\n\n- theirs ^a\n";
    expect(mergePlanFile(base, ours, theirs, { oursTime: 1, theirsTime: 2 }).text).toBe(theirs);
    expect(mergePlanFile(base, ours, theirs, { oursTime: 2, theirsTime: 1 }).text).toBe(ours);
    const tie = mergePlanFile(base, ours, theirs);
    expect(tie.text).toBe(ours);
    expect(tie.conflicts[0]).toMatchObject({ kept: "ours", lost: "- theirs ^a" });
  });

  it("keeps both new steps added on both sides, in a sensible order", () => {
    const ours = setLine(GOAL, "- [ ] Add tests ^t2", "- [ ] Ours new ^t3\n- [ ] Add tests ^t2");
    const theirs = setLine(GOAL, "## Notes", "- [ ] Theirs new ^t4\n\n## Notes").replace("\n\n- [ ] Theirs", "\n- [ ] Theirs");
    const r = mergePlanFile(GOAL, ours, theirs);
    expect(r.conflicts).toEqual([]);
    const ids = [...r.text.matchAll(/\^(t\d)/g)].map((m) => m[1]);
    expect(ids).toEqual(["t1", "t3", "t2", "t4"]);
  });

  it("puts a block only theirs has after its predecessor in theirs, or at the section start", () => {
    const base = "## A\n\n- one ^a\n- two ^b\n";
    const theirs1 = "## A\n\n- one ^a\n- mid ^m\n- two ^b\n";
    const theirs2 = "## A\n\n- first ^f\n- one ^a\n- two ^b\n";
    expect(mergePlanFile(base, base, theirs1).text).toBe(theirs1);
    expect(mergePlanFile(base, base, theirs2).text).toBe(theirs2);
  });

  it("keeps a goal added on one side, and a new section added on the other", () => {
    const ours = ROADMAP.replace("\n## Later", "- [ ] Search ^search\n  - outcome: Find things\n\n## Later");
    const theirs = ROADMAP + "\n## Ideas\n\n- [ ] Voice ^idea1\n";
    const r = mergePlanFile(ROADMAP, ours, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.text).toContain("^search");
    expect(r.text).toContain("## Ideas");
    expect(r.text.indexOf("## Ideas")).toBeGreaterThan(r.text.indexOf("## Later"));
    expect(r.text.endsWith("^idea1\n")).toBe(true);
  });

  it("deletes a block deleted on one side and unchanged on the other", () => {
    const theirs = setLine(ROADMAP, `- [ ] Reports ^reports\n  - outcome: Weekly reports\n  - updated: ${T1} by AI\n`, "");
    const r = mergePlanFile(ROADMAP, ROADMAP, theirs);
    expect(r.text).toBe(theirs);
    expect(r.conflicts).toEqual([]);
    expect(mergePlanFile(ROADMAP, theirs, ROADMAP).text).toBe(theirs);
  });

  it("keeps a block deleted on one side but changed on the other, and records a conflict", () => {
    const theirs = setLine(ROADMAP, `- [ ] Reports ^reports\n  - outcome: Weekly reports\n  - updated: ${T1} by AI\n`, "");
    const ours = setLine(ROADMAP, "Weekly reports", "Daily reports");
    const r = mergePlanFile(ROADMAP, ours, theirs);
    expect(r.text).toContain("Daily reports");
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ id: "reports", kept: "ours" });
    const r2 = mergePlanFile(ROADMAP, theirs, ours);
    expect(r2.text).toContain("Daily reports");
    expect(r2.conflicts[0]).toMatchObject({ id: "reports", kept: "theirs" });
  });

  it("merges without a common version: one-sided blocks kept, differing blocks conflict", () => {
    const ours = "## A\n\n- x ^a\n- only ours ^o\n";
    const theirs = "## A\n\n- y ^a\n- only theirs ^t\n";
    const r = mergePlanFile(undefined, ours, theirs);
    expect(r.text).toContain("only ours");
    expect(r.text).toContain("only theirs");
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]!.id).toBe("a");
  });

  it("keys blocks without an id by their first line", () => {
    const base = "## Notes\n\n- plain note\n  - more\n";
    const ours = "## Notes\n\n- plain note\n  - more\n- another\n";
    const theirs = "## Notes\n\n- plain note\n  - more changed\n";
    const r = mergePlanFile(base, ours, theirs);
    expect(r.text).toBe("## Notes\n\n- plain note\n  - more changed\n- another\n");
  });

  it("merges the header and a section's intro text as single units", () => {
    const base = "# Title\n\nintro\n\n## A\n\nsome words\n\n- x ^a\n";
    const ours = base.replace("# Title", "# New title");
    const theirs = base.replace("some words", "other words");
    const r = mergePlanFile(base, ours, theirs);
    expect(r.text).toBe("# New title\n\nintro\n\n## A\n\nother words\n\n- x ^a\n");
    expect(r.conflicts).toEqual([]);
  });

  it("accepts CRLF input and writes LF", () => {
    const crlf = (s: string) => s.replace(/\n/g, "\r\n");
    const ours = crlf(setLine(GOAL, "- [ ] Build the form ^t1", "- [x] Build the form ^t1"));
    const theirs = crlf(setLine(GOAL, "- [ ] Add tests ^t2", "- [x] Add tests ^t2"));
    const r = mergePlanFile(crlf(GOAL), ours, theirs);
    expect(r.text).not.toContain("\r");
    expect(r.text).toContain("- [x] Build the form ^t1");
    expect(r.text).toContain("- [x] Add tests ^t2");
    expect(mergePlanFile(crlf(GOAL), crlf(GOAL), crlf(GOAL)).text).toBe(GOAL);
  });
});

describe("mergePlanFolder", () => {
  const m = (o: Record<string, string>) => new Map(Object.entries(o));
  const n = (o: Record<string, number>) => new Map(Object.entries(o));

  it("merges each file and keeps a goal (with its file) added on one side", () => {
    const base = m({ "roadmap.md": ROADMAP, "goals/login.md": GOAL });
    const ours = m({
      "roadmap.md": ROADMAP.replace("\n## Later", "- [ ] Search ^search\n\n## Later"),
      "goals/login.md": GOAL,
      "goals/search.md": "# Search\n\n## Tasks\n",
    });
    const theirs = m({ "roadmap.md": ROADMAP, "goals/login.md": setLine(GOAL, "^n1", "^n1\n- Second note ^n2") });
    const r = mergePlanFolder(base, ours, theirs);
    expect([...r.files.keys()].sort()).toEqual(["goals/login.md", "goals/search.md", "roadmap.md"]);
    expect(r.files.get("roadmap.md")).toContain("^search");
    expect(r.files.get("goals/login.md")).toContain("^n2");
    expect(r.conflicts).toEqual([]);
  });

  it("deletes a file deleted on one side and unchanged on the other; keeps it if changed", () => {
    const base = m({ "goals/x.md": "# X\n" });
    expect(mergePlanFolder(base, m({}), base).files.size).toBe(0);
    expect(mergePlanFolder(base, base, m({})).files.size).toBe(0);
    const changed = m({ "goals/x.md": "# X\n\n## Notes\n\n- n ^n1\n" });
    const r = mergePlanFolder(base, m({}), changed);
    expect(r.files.get("goals/x.md")).toBe(changed.get("goals/x.md"));
    expect(r.conflicts).toEqual([{ file: "goals/x.md", section: "", id: "", kept: "theirs", lost: "" }]);
  });

  it("tags conflicts with their file and uses per-file times", () => {
    const base = m({ "context.md": "## A\n\n- x ^a\n" });
    const ours = m({ "context.md": "## A\n\n- o ^a\n" });
    const theirs = m({ "context.md": "## A\n\n- t ^a\n" });
    const r = mergePlanFolder(base, ours, theirs, { oursTimes: n({ "context.md": 1 }), theirsTimes: n({ "context.md": 5 }) });
    expect(r.files.get("context.md")).toBe(theirs.get("context.md"));
    expect(r.conflicts[0]).toMatchObject({ file: "context.md", id: "a", kept: "theirs" });
  });
});
