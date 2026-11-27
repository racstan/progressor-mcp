// Reports on a step: a helper's write-up kept with the step instead of in a notes folder nobody finds.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { MAX_REPORT_BYTES, attachReport, listReports, readReport, removeReport } from "../src/reports.js";
import { tempDir } from "./tmp.js";

let root: string;
let now: Date;
const alive = new Set<number>();
const chat = (id: string, pid: number) => {
  alive.add(pid);
  return new Project({ root, session: { id, pid }, isAlive: (p) => alive.has(p), now: () => now });
};
let lead: Project;
let helper: Project;

beforeEach(() => {
  root = tempDir("progressor-reports-");
  now = new Date("2026-11-27T10:00:00.000Z");
  alive.clear();
  lead = chat("s-lead", 100);
  lead.addGoal("Login", [{ title: "Route" }, { title: "Docs" }]);
  lead.claimGoal("login");
  lead.addGoal("Billing", [{ title: "Checkout" }]);
  helper = chat("s-help", 200);
});

describe("attaching a report", () => {
  it("keeps the text under the goal with a header, and numbers reports per goal", () => {
    const r1 = attachReport(lead, { task: "t1", title: "Test run", text: "## Results\n\n715 passed" }, "login");
    expect(r1).toMatchObject({ id: "r1", goal: "login", task: "t1", title: "Test run", session: "s-lead", written: "2026-11-27T10:00:00.000Z" });
    const text = readFileSync(join(root, ".progressor", "reports", "login", "r1.md"), "utf8");
    expect(text).toContain("# Test run");
    expect(text).toContain("- step: t1");
    expect(text).toContain("- written: 2026-11-27T10:00:00.000Z by s-lead");
    expect(text).toContain("715 passed");
    expect(attachReport(lead, { task: "t2", title: "Second", text: "x" }, "login").id).toBe("r2");
  });

  it("numbers each goal's reports on their own", () => {
    attachReport(lead, { task: "t1", title: "A", text: "x" }, "login");
    expect(attachReport(helper, { task: "t1", title: "B", text: "x" }, "billing").id).toBe("r1");
  });

  it("works from a chat that holds no goal, when the goal is named", () => {
    const r = attachReport(helper, { task: "t1", title: "From a helper", text: "done" }, "login");
    expect(r.session).toBe("s-help");
    expect(() => attachReport(helper, { task: "t1", title: "x", text: "y" })).toThrow(/holds no goal.*goal/i);
  });

  it("uses the one goal a chat holds when none is named", () => {
    expect(attachReport(lead, { task: "t1", title: "x", text: "y" }).goal).toBe("login");
  });

  it("reads a file given by path: absolute, from the project folder, or from the chat's own worktree", () => {
    const wt = tempDir("progressor-wt-");
    writeFileSync(join(wt, "notes.md"), "# From the worktree\n\nbody");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "run.txt"), "plain text run");
    const abs = join(tempDir("progressor-notes-"), "report.md");
    writeFileSync(abs, "absolute one");
    helper.setWorktree(wt);
    expect(readReport(helper, "login", attachReport(helper, { task: "t1", title: "a", path: abs }, "login").id).text).toContain("absolute one");
    expect(readReport(helper, "login", attachReport(helper, { task: "t1", title: "b", path: "docs/run.txt" }, "login").id).text).toContain("plain text run");
    expect(readReport(helper, "login", attachReport(helper, { task: "t1", title: "c", path: "notes.md" }, "login").id).text).toContain("From the worktree");
  });

  it("refuses a file that is not .md or .txt, missing, or too big, and says why", () => {
    const bad = join(tempDir("progressor-notes-"), "x.png");
    writeFileSync(bad, "x");
    expect(() => attachReport(lead, { task: "t1", title: "x", path: bad }, "login")).toThrow(/\.md or \.txt/);
    expect(() => attachReport(lead, { task: "t1", title: "x", path: join(root, "nope.md") }, "login")).toThrow(/no file at/i);
    const big = join(tempDir("progressor-notes-"), "big.md");
    writeFileSync(big, "a".repeat(MAX_REPORT_BYTES + 1));
    expect(() => attachReport(lead, { task: "t1", title: "x", path: big }, "login")).toThrow(/200 KB/);
    expect(() => attachReport(lead, { task: "t1", title: "x", text: "a".repeat(MAX_REPORT_BYTES + 1) }, "login")).toThrow(/200 KB/);
  });

  it("needs a title and exactly one of text or path", () => {
    expect(() => attachReport(lead, { task: "t1", title: " ", text: "x" }, "login")).toThrow(/title/i);
    expect(() => attachReport(lead, { task: "t1", title: "x" }, "login")).toThrow(/text.*path/i);
    expect(() => attachReport(lead, { task: "t1", title: "x", text: "a", path: "b.md" }, "login")).toThrow(/text.*path/i);
    expect(() => attachReport(lead, { task: "t1", title: "x", text: "  " }, "login")).toThrow(/empty/i);
  });

  it("refuses an unknown or dropped goal or step", () => {
    expect(() => attachReport(lead, { task: "t1", title: "x", text: "y" }, "nope")).toThrow(/No Goal nope/);
    expect(() => attachReport(lead, { task: "t9", title: "x", text: "y" }, "login")).toThrow(/No step t9/);
    lead.dropTask("t2", "not needed", "login");
    expect(() => attachReport(lead, { task: "t2", title: "x", text: "y" }, "login")).toThrow(/dropped/);
    lead.dropGoal("billing", "not needed");
    expect(() => attachReport(lead, { task: "t1", title: "x", text: "y" }, "billing")).toThrow(/dropped/);
  });

  it("keeps a finished step's reports", () => {
    attachReport(lead, { task: "t1", title: "Run", text: "ok" }, "login");
    lead.completeTask("t1", [], undefined, "login");
    attachReport(lead, { task: "t1", title: "After", text: "ok" }, "login");
    expect(listReports(lead, "login", "t1").map((r) => r.title)).toEqual(["Run", "After"]);
  });
});

describe("listing, reading and removing", () => {
  it("lists a step's reports with size, and a goal's all", () => {
    attachReport(lead, { task: "t1", title: "One", text: "12345" }, "login");
    now = new Date("2026-11-27T11:00:00.000Z");
    attachReport(lead, { task: "t2", title: "Two", text: "x" }, "login");
    expect(listReports(lead, "login", "t1")).toMatchObject([{ id: "r1", title: "One", task: "t1", written: "2026-11-27T10:00:00.000Z" }]);
    expect(listReports(lead, "login", "t1")[0]!.bytes).toBeGreaterThan(5);
    expect(listReports(lead, "login").map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(listReports(lead, "billing")).toEqual([]);
  });

  it("reads one report's full text, and refuses a bad id", () => {
    const r = attachReport(lead, { task: "t1", title: "One", text: "the body" }, "login");
    expect(readReport(lead, "login", r.id)).toMatchObject({ report: { id: "r1", title: "One" }, text: expect.stringContaining("the body") });
    expect(() => readReport(lead, "login", "r7")).toThrow(/No report r7/);
    expect(() => readReport(lead, "login", "../roadmap")).toThrow(/No report/);
  });

  it("removes a report, and only a report", () => {
    const r = attachReport(lead, { task: "t1", title: "One", text: "x" }, "login");
    writeFileSync(join(root, ".progressor", "reports", "login", "keep.md"), "not a report");
    expect(() => removeReport(helper, "login", "../../roadmap")).toThrow(/No report/);
    expect(() => removeReport(helper, "login", "keep")).toThrow(/No report/);
    expect(removeReport(helper, "login", r.id).id).toBe("r1");
    expect(existsSync(join(root, ".progressor", "reports", "login", "r1.md"))).toBe(false);
    expect(existsSync(join(root, ".progressor", "reports", "login", "keep.md"))).toBe(true);
    expect(() => removeReport(lead, "login", "r1")).toThrow(/No report r1/);
  });

  it("is not kept out of git, like the handoffs", () => {
    attachReport(lead, { task: "t1", title: "One", text: "x" }, "login");
    const ignore = join(root, ".progressor", ".gitignore");
    expect(!existsSync(ignore) || !/reports/.test(readFileSync(ignore, "utf8"))).toBe(true);
  });
});
