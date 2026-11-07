// Handoffs: a markdown write-up of a stretch of work, for whoever picks it up next (another AI chat,
// a teammate, the Developer after a break). Progressor gathers the facts for a range of time or
// commits — the steps finished, decisions, what is left open, commits and files — and the AI writes
// the handoff from them and saves it here. Saved in `.progressor/handoffs/`, which follows the plan's
// own git rule, so a shared plan shares its handoffs too.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GitRange } from "./gitFacts.js";
import type { Project } from "./project.js";

/** With no start given and no handoff yet, a handoff covers this many days. */
const DEFAULT_DAYS = 7;
const MAX_COMMITS = 40;
const MAX_STEPS = 12;
const FILE = /^[\w.-]+\.md$/;

export interface HandoffRange {
  /** An ISO date or time, or a commit or tag to start after. */
  since?: string;
  /** An ISO date or time; now when left out. */
  until?: string;
  /** Exactly these commits, instead of a range. */
  commits?: string[];
}

export interface HandoffSummary {
  file: string;
  title: string;
  range: string | undefined;
  commits: number | undefined;
  written: string | undefined;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s.trim());
const day = (iso: string) => iso.slice(0, 10);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const sentence = (s: string) => oneLine(s).replace(/([^.!?])$/, "$1.");

/** `2026-11-07-week-one.md` from a date and a title. */
export function handoffName(date: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "handoff";
  return `${date}-${slug}.md`;
}

/** The facts to write a handoff from, and the range they cover in words. */
export function handoffFacts(project: Project, r: HandoffRange): { range: string; commits: number | undefined; text: string } {
  const now = project.now().toISOString();
  let git: GitRange;
  let from: string | undefined;
  let to = now;
  let label: string;
  let stepFits: (t: { finishedAt?: string; commits?: string[] }) => boolean;
  if (r.until) {
    const until = isDate(r.until) ? new Date(r.until) : undefined;
    if (!until || Number.isNaN(until.getTime())) throw new Error(`until must be a date such as 2026-11-07, not "${r.until}".`);
    to = until.toISOString();
  }
  if (r.commits?.length) {
    git = { commits: r.commits };
    const wanted = r.commits.map((c) => c.trim().toLowerCase());
    stepFits = (t) => (t.commits ?? []).some((c) => wanted.some((w) => w.startsWith(c.toLowerCase()) || c.toLowerCase().startsWith(w)));
    label = `commits ${r.commits.join(", ")}`;
  } else {
    if (r.since && !isDate(r.since)) {
      from = project.gitTimeOf(r.since);
      if (!from) throw new Error(`Found no commit or date "${r.since}". Give a date such as 2026-11-01, or a commit git knows.`);
      git = { from: r.since, until: to };
      label = `${r.since} to ${day(to)}`;
    } else {
      const start = r.since ? new Date(r.since) : undefined;
      if (start && Number.isNaN(start.getTime())) throw new Error(`since must be a date such as 2026-11-01 or a commit, not "${r.since}".`);
      from = start?.toISOString() ?? listHandoffs(project)[0]?.written ?? new Date(Date.parse(now) - DEFAULT_DAYS * 86_400_000).toISOString();
      git = { since: from, until: to };
      label = `${day(from)} to ${day(to)}`;
    }
    stepFits = (t) => !!t.finishedAt && t.finishedAt >= from! && t.finishedAt <= to;
  }
  const inRange = (at: string | undefined) => !!at && (!from || at >= from) && at <= to;

  const out: string[] = [`Handoff facts for ${label}:`];
  let stepsFound = 0;
  for (const g of project.roadmap().goals) {
    if (g.status === "dropped") continue;
    let plan;
    try {
      plan = project.plan(g.id);
    } catch {
      continue;
    }
    const finished = plan.tasks.filter((t) => (t.status === "done" || t.status === "released") && stepFits(t));
    const held = g.status === "active" || g.status === "paused" || g.status === "testing";
    if (finished.length === 0 && !held) continue;
    stepsFound += finished.length;
    const left = plan.tasks.filter((t) => t.status !== "done" && t.status !== "released" && t.status !== "dropped");
    const decisions = plan.decisions.filter((d) => inRange(d.added?.at));
    const notes = plan.notes.filter((n) => !n.resolved);
    const tests = [...new Set(finished.map((t) => t.tests).filter((t): t is string => !!t))];
    let questions: string[] = [];
    try {
      questions = project.talk(g.id).questions.filter((q) => q.state === "open").map((q) => oneLine(q.text));
    } catch {
      // no talk file: nothing asked
    }
    out.push(`- ${g.id}: ${oneLine(g.title)} (${g.status}).${g.outcome ? ` Finished when: ${sentence(g.outcome)}` : ""}`);
    const list = (ts: typeof finished) => ts.slice(0, MAX_STEPS).map((t) => `${t.id} ${oneLine(t.title)}`).join("; ") + (ts.length > MAX_STEPS ? `; and ${ts.length - MAX_STEPS} more` : "");
    if (finished.length) out.push(`  Steps finished: ${list(finished)}`);
    if (tests.length) out.push(`  Test runs: ${tests.join("; ")}`);
    if (left.length) out.push(`  Steps left: ${list(left)}`);
    if (decisions.length) out.push(`  Decisions: ${decisions.map((d) => oneLine(d.text)).join("; ")}`);
    if (notes.length) out.push(`  Open notes: ${notes.map((n) => oneLine(n.text)).join("; ")}`);
    if (questions.length) out.push(`  Open questions: ${questions.join("; ")}`);
  }
  const commits = project.gitRange(git, MAX_COMMITS);
  if (commits && commits.total > 0) {
    out.push(`Commits (${commits.total}):`, ...commits.lines.map((l) => `- ${l}`));
    if (commits.total > commits.lines.length) out.push(`- and ${commits.total - commits.lines.length} older`);
    if (commits.files.length) out.push(`Files changed: ${commits.files.join(", ")}`);
  }
  if (stepsFound === 0 && !commits?.total) out.push("No steps were finished and no commits made in this range.");
  out.push(
    "Write the handoff in markdown for someone picking this work up cold, from these facts only: # <title>, then ## Summary, ## What changed, ## Decisions, ## Open questions and risks, ## Next steps. " +
      "Then call handoff again with text (the markdown), title and the same range, to save it for the Developer's dashboard.",
  );
  // Without git there is no commit count to give.
  return { range: label, commits: commits?.total, text: out.join("\n") };
}

/** Saves a handoff the AI wrote, then keeps only the newest `keep`. */
export function saveHandoff(project: Project, h: { title: string; text: string; range: string; commits?: number }, keep: number): HandoffSummary {
  const title = oneLine(h.title);
  if (!title) throw new Error("Give the handoff a title.");
  const lines = h.text.replace(/\r\n?/g, "\n").trim().split("\n");
  const heading = /^#\s+(.+)$/.exec(lines[0] ?? "");
  const body = (heading ? lines.slice(1) : lines).join("\n").trim();
  if (!body) throw new Error("Write the handoff's text.");
  const written = project.now().toISOString();
  const taken = new Set(existsSync(project.handoffsDir) ? readdirSync(project.handoffsDir) : []);
  let file = handoffName(day(written), title);
  for (let n = 2; taken.has(file); n++) file = handoffName(day(written), title).replace(/\.md$/, `-${n}.md`);
  const head = [`# ${heading ? oneLine(heading[1]!) : title}`, "", `- range: ${oneLine(h.range)}`, ...(h.commits !== undefined ? [`- commits: ${h.commits}`] : []), `- written: ${written} by AI`];
  project.saveHandoffFile(file, `${head.join("\n")}\n\n${body}\n`);
  for (const old of listHandoffs(project).slice(Math.max(1, keep))) project.removeHandoffFile(old.file);
  return listHandoffs(project).find((x) => x.file === file)!;
}

/** The saved handoffs, newest first. */
export function listHandoffs(project: Project): HandoffSummary[] {
  if (!existsSync(project.handoffsDir)) return [];
  return readdirSync(project.handoffsDir)
    .filter((f) => FILE.test(f))
    .map((file) => {
      const text = readFileSync(join(project.handoffsDir, file), "utf8").replace(/\r\n?/g, "\n");
      const detail = (key: string) => new RegExp(`^- ${key}: (.*)$`, "m").exec(text)?.[1]?.trim();
      const commits = detail("commits");
      return {
        file,
        title: /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? file.replace(/\.md$/, ""),
        range: detail("range"),
        commits: commits && /^\d+$/.test(commits) ? Number(commits) : undefined,
        written: detail("written")?.replace(/\s+by\s+.*$/, ""),
      };
    })
    .sort((a, b) => (b.written ?? "").localeCompare(a.written ?? "") || b.file.replace(/\.md$/, "").localeCompare(a.file.replace(/\.md$/, "")));
}

/** One saved handoff's text. */
export function readHandoff(project: Project, file: string): string {
  const path = join(project.handoffsDir, file);
  if (!FILE.test(file) || !existsSync(path)) throw new Error(`No handoff ${file}.`);
  return readFileSync(path, "utf8");
}
