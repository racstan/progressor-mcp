// Text the AI or the Developer types must never add fake steps, hide a section or make a plan unreadable.
import { describe, expect, it } from "vitest";
import { MAX_ESTIMATE_MINUTES, parseDuration } from "../src/estimate.js";
import { parseMarkdown, serialiseMarkdown } from "../src/markdown.js";
import { newPlanFile, parsePlanFile } from "../src/planFile.js";
import { parseRoadmap } from "../src/roadmap.js";

const plan = `# Goal\n\n## Tasks\n\n- [ ] First ^t1\n`;

describe("files a step touches", () => {
  it("can't add a fake finished step through a line break", () => {
    const p = parsePlanFile(plan, "g");
    p.addTasks([{ title: "Real", code: ["src/a.ts`\n- [x] Fake step ^t9\n  - code: `b"] }]);
    const back = parsePlanFile(p.toString(), "g");
    expect(back.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(back.tasks[1]!.code).toHaveLength(1);
    expect(back.tasks[1]!.code[0]).not.toContain("`");
    expect(back.tasks[1]!.code[0]).not.toContain("\n");
  });

  it("stays one line when changed or added to", () => {
    const p = parsePlanFile(plan, "g");
    p.updateTask("t1", { code: ["a.ts\n- [x] Fake ^t8"] });
    p.addCode("t1", ["b.ts\r\n## Decisions"]);
    const back = parsePlanFile(p.toString(), "g");
    expect(back.tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(back.tasks[0]!.code).toEqual(["a.ts - [x] Fake ^t8", "b.ts ## Decisions"]);
  });
});

describe("titles", () => {
  it("a new goal's title stays on its heading line", () => {
    const p = newPlanFile("g", "Title\n## Tasks\n- [x] Fake ^t1");
    expect(p.tasks).toEqual([]);
    expect(p.toString().split("\n")[0]).toBe("# Title ## Tasks - [x] Fake ^t1");
  });

  it("an idea's title and note stay on one line", () => {
    const r = parseRoadmap("# Roadmap\n\n## Goals\n");
    r.addIdea("Idea\n## Goals\n- [ ] Fake goal", "note\n- [ ] Another");
    const back = parseRoadmap(r.toString());
    expect(back.goals).toEqual([]);
    expect(back.ideas).toHaveLength(1);
  });

  it("a blank title is refused", () => {
    const p = parsePlanFile(plan, "g");
    expect(() => p.addTasks([{ title: "   " }])).toThrow(/title/i);
  });
});

describe("estimates", () => {
  it("huge or endless times are not taken", () => {
    expect(parseDuration("1e30h")).toBeUndefined();
    expect(parseDuration("Infinity h")).toBeUndefined();
    expect(parseDuration(`${MAX_ESTIMATE_MINUTES + 1}m`)).toBeUndefined();
    expect(parseDuration(`1${"0".repeat(30)}h`)).toBeUndefined();
    expect(parseDuration("2h")).toBe(120);
  });
});

describe("line endings", () => {
  it("reads a file where one line ends differently", () => {
    const src = "# Goal\n\n## Tasks\r\n\n- [ ] First ^t1\n- [ ] Second ^t2\n";
    const p = parsePlanFile(src, "g");
    expect(p.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("keeps the line ending most lines use", () => {
    expect(parseMarkdown("a\r\nb\r\nc\nd\r\n").eol).toBe("\r\n");
    expect(parseMarkdown("a\nb\r\nc\nd\n").eol).toBe("\n");
  });
});

describe("byte order mark", () => {
  it("doesn't hide the first heading, and is put back on save", () => {
    const src = "﻿## Tasks\n\n- [ ] First ^t1\n";
    const p = parsePlanFile(src, "g");
    expect(p.tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(serialiseMarkdown(parseMarkdown(src))).toBe(src);
  });
});
