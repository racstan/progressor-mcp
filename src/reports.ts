// Reports on a step: a helper's (or any chat's) write-up, such as a test run, kept with the step in
// `.progressor/reports/<goal>/<id>.md` instead of in some folder nobody finds. Any chat in the project
// may add one to any goal's step, held or not, because a helper chat in a worktree serves the same plan.
// Like the handoffs they follow the plan's own git rule.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import type { Project } from "./project.js";

/** The longest report kept: 200 KB of text. */
export const MAX_REPORT_BYTES = 200 * 1024;
const MAX_TITLE = 120;
const FILE = /^r(\d+)\.md$/;
const ID = /^r\d+$/;

export interface Report {
  id: string;
  goal: string;
  task: string;
  title: string;
  /** When it was written (ISO). */
  written: string;
  /** The chat that wrote it. */
  session: string;
  bytes: number;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function heldGoal(project: Project, goalId: string | undefined): string {
  if (goalId) return goalId;
  const held = project.claimedGoals();
  if (held.length === 1) return held[0]!.id;
  if (held.length === 0) throw new Error("This chat holds no goal, so say which goal the step is in (goal).");
  throw new Error(`This chat holds several goals (${held.map((g) => g.id).join(", ")}); say which with goal.`);
}

function textOf(project: Project, input: { text?: string | undefined; path?: string | undefined }): string {
  const hasText = input.text !== undefined;
  const hasPath = !!input.path?.trim();
  if (hasText === hasPath) throw new Error("Give the report as text (markdown) or as the path of a .md or .txt file, not both and not neither.");
  if (hasText) {
    const bytes = Buffer.byteLength(input.text!);
    if (bytes > MAX_REPORT_BYTES) throw new Error(`That report is ${Math.ceil(bytes / 1024)} KB; the limit is ${MAX_REPORT_BYTES / 1024} KB.`);
    return input.text!;
  }
  const given = input.path!.trim();
  const ext = extname(given).toLowerCase();
  if (ext !== ".md" && ext !== ".txt") throw new Error(`${ext || "That file"} cannot be attached as a report; use a .md or .txt file.`);
  const candidates = isAbsolute(given) ? [given] : [resolve(project.root, given), ...(project.worktreeFolder ? [resolve(project.worktreeFolder, given)] : [])];
  const from = candidates.find((c) => existsSync(c)) ?? candidates[0]!;
  let size: number;
  try {
    const info = statSync(from);
    if (!info.isFile()) throw new Error("not a file");
    size = info.size;
  } catch {
    throw new Error(`There is no file at ${from}.`);
  }
  if (size > MAX_REPORT_BYTES) throw new Error(`That file is ${Math.ceil(size / 1024)} KB; the limit is ${MAX_REPORT_BYTES / 1024} KB.`);
  return readFileSync(from, "utf8");
}

/** Keeps a report on a step; the next ID is r1, r2, ... for the goal. */
export function attachReport(project: Project, input: { task: string; title: string; text?: string | undefined; path?: string | undefined }, goalId?: string): Report {
  const id = heldGoal(project, goalId);
  const goal = project.roadmap().goal(id);
  if (!goal) throw new Error(`No Goal ${id} on the Roadmap.`);
  if (goal.status === "dropped") throw new Error(`Goal ${goal.id} is dropped; nothing can be added to it.`);
  const task = project.plan(goal.id).task(input.task);
  if (!task) throw new Error(`No step ${input.task} in Goal ${goal.id}.`);
  if (task.status === "dropped") throw new Error(`Step ${input.task} in Goal ${goal.id} is dropped; nothing can be added to it.`);
  const title = oneLine(input.title ?? "").slice(0, MAX_TITLE);
  if (!title) throw new Error("Give the report a short title.");
  const body = textOf(project, input).replace(/\r\n?/g, "\n").trim();
  if (!body) throw new Error("The report is empty.");
  const next = readdirSync(project.reportsDir(goal.id)).reduce((n, f) => Math.max(n, Number(FILE.exec(f)?.[1] ?? 0)), 0) + 1;
  const written = project.now().toISOString();
  const text = `# ${title}\n\n- step: ${input.task}\n- written: ${written} by ${project.session.id}\n\n${body}\n`;
  project.saveReportFile(goal.id, `r${next}.md`, text);
  return { id: `r${next}`, goal: goal.id, task: input.task, title, written, session: project.session.id, bytes: Buffer.byteLength(text) };
}

function summaryOf(goal: string, file: string, text: string): Report {
  const detail = (key: string) => new RegExp(`^- ${key}: (.*)$`, "m").exec(text)?.[1]?.trim();
  const written = /^(\S+)(?: by (.+))?$/.exec(detail("written") ?? "");
  return {
    id: file.replace(/\.md$/, ""),
    goal,
    task: detail("step") ?? "",
    title: /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? file.replace(/\.md$/, ""),
    written: written?.[1] ?? "",
    session: written?.[2] ?? "",
    bytes: Buffer.byteLength(text),
  };
}

/** A goal's reports in the order they were written, or one step's. Never throws: no folder means none. */
export function listReports(project: Project, goal: string, task?: string): Report[] {
  const dir = project.reportsDir(goal, false);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => FILE.test(f))
    .sort((a, b) => Number(FILE.exec(a)![1]) - Number(FILE.exec(b)![1]))
    .flatMap((file) => {
      try {
        return [summaryOf(goal, file, readFileSync(join(dir, file), "utf8").replace(/\r\n?/g, "\n"))];
      } catch {
        return [];
      }
    })
    .filter((r) => task === undefined || r.task === task);
}

/** One report and its full text (the markdown, header included). */
export function readReport(project: Project, goal: string, id: string): { report: Report; text: string } {
  const file = `${id}.md`;
  const path = join(project.reportsDir(goal, false), file);
  if (!ID.test(id) || !existsSync(path)) throw new Error(`No report ${id} in Goal ${goal}.`);
  const text = readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
  return { report: summaryOf(goal, file, text), text };
}

/** Takes a report back. Only a report: the ID must be r<number>. */
export function removeReport(project: Project, goal: string, id: string): Report {
  const { report } = readReport(project, goal, id);
  project.removeReportFile(goal, `${id}.md`);
  return report;
}
