// The plan check-up: looks over a project's plan for things that go wrong over time, repairs the ones
// that are safe to repair, and reports the rest. The AI runs it (get_status does once per Session);
// the dashboard shows the last result. Repairs are one change in the plan's history, so they can be
// undone like any other.
//
// Repaired: a file with mixed line endings (it can't be read until it has one kind), temporary files a
// crash left behind, and goals held by a chat that has ended. Reported only: finished steps that list
// files but have no commits or tests, goals waiting on a goal that is gone, and pictures whose file is missing.
import { type Dirent, existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { PICTURES_DIR, PROGRESSOR_DIR, type Project } from "./project.js";
import { parseWaitRef } from "./dependencies.js";

export type FindingKind = "line endings" | "leftover file" | "stale claim" | "no evidence" | "missing goal" | "missing picture" | "damaged";

export interface Finding {
  kind: FindingKind;
  /** The file it is about, relative to .progressor/. */
  file: string;
  /** What was found, in plain words. */
  text: string;
  fixed: boolean;
}

export interface CheckupResult {
  at: string;
  findings: Finding[];
}

/** A temporary file younger than this may still be being written. */
const LEFTOVER_AGE_MS = 60_000;
/** The folders of the plan's markdown files (talk is read the same way). */
const MARKDOWN_DIRS = ["", "goals", "talk", "handoffs"];

function filesIn(dir: string, ext: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(ext));
  } catch {
    return [];
  }
}

/** Every file under .progressor/ ending in `.tmp`, relative to it; the history is left alone. */
function tmpFiles(base: string, sub = ""): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(join(base, sub), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) return rel === "history" ? [] : tmpFiles(base, rel);
    return e.name.endsWith(".tmp") ? [rel] : [];
  });
}

function endings(text: string): { crlf: number; lf: number } {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  return { crlf, lf: (text.match(/\n/g) ?? []).length - crlf };
}

/** The text with every line ending made the kind most of its lines have. */
function oneLineEnding(text: string): string {
  const { crlf, lf } = endings(text);
  return crlf > lf ? text.replace(/\r?\n/g, "\r\n") : text.replace(/\r\n/g, "\n");
}

export function checkUp(project: Project, { repair, now = Date.now() }: { repair: boolean; now?: number }): CheckupResult {
  const base = join(project.root, PROGRESSOR_DIR);
  const findings: Finding[] = [];
  // A file already reported (such as for its line endings) is not reported again as damaged.
  const damaged = (file: string, e: unknown) => {
    if (!findings.some((f) => f.file === file)) findings.push({ kind: "damaged", file, text: (e as Error).message, fixed: false });
  };
  const run = () => {
    // Line endings: one Windows line in a plain file (or the other way round) makes it unreadable.
    for (const sub of MARKDOWN_DIRS)
      for (const name of filesIn(join(base, sub), ".md")) {
        const rel = sub ? `${sub}/${name}` : name;
        const text = readFileSync(join(base, rel), "utf8");
        const { crlf, lf } = endings(text);
        if (crlf === 0 || lf === 0) continue;
        if (repair) project.rewritePlanFile(rel, oneLineEnding(text));
        findings.push({ kind: "line endings", file: rel, text: `${rel} mixed Windows and plain line endings`, fixed: repair });
      }

    for (const rel of tmpFiles(base)) {
      const path = join(base, rel);
      try {
        if (now - statSync(path).mtimeMs < LEFTOVER_AGE_MS) continue;
      } catch {
        continue;
      }
      if (repair) rmSync(path, { force: true });
      findings.push({ kind: "leftover file", file: rel, text: `${rel} was left behind by a save that didn't finish`, fixed: repair });
    }

    let roadmap;
    try {
      roadmap = project.roadmap();
    } catch (e) {
      damaged("roadmap.md", e);
      return;
    }

    if (repair)
      for (const id of project.clearEndedClaims())
        findings.push({ kind: "stale claim", file: "roadmap.md", text: `Goal ${id} was held by a chat that has ended; it is free again`, fixed: true });

    for (const goal of roadmap.goals) {
      for (const raw of goal.waitsOn ?? []) {
        const ref = parseWaitRef(raw);
        if (!ref.project && !roadmap.goal(ref.goal))
          findings.push({ kind: "missing goal", file: "roadmap.md", text: `Goal ${goal.id} waits on ${raw}, which is not on the Roadmap`, fixed: false });
      }
      let plan;
      try {
        plan = project.plan(goal.id);
      } catch (e) {
        damaged(`goals/${goal.id}.md`, e);
        continue;
      }
      // Only goals still being worked on: older finished work from before steps were linked to commits is left be.
      if (goal.status !== "dropped" && goal.status !== "done")
        for (const t of plan.tasks)
          if ((t.status === "done" || t.status === "released") && t.code.length > 0 && !t.commits?.length && !t.tests && !t.evidence)
            findings.push({
              kind: "no evidence",
              file: `goals/${goal.id}.md`,
              text: `${goal.id}/${t.id} ${t.title} is ${t.status} but has no commits or tests recorded`,
              fixed: false,
            });
      for (const pic of project.pictures(goal.id))
        if (!existsSync(join(base, PICTURES_DIR, goal.id, pic.file)))
          findings.push({ kind: "missing picture", file: `${PICTURES_DIR}/${goal.id}/index.json`, text: `Picture ${pic.id} of goal ${goal.id} has no file`, fixed: false });
    }
  };
  if (repair) project.transaction("check-up", run);
  else run();
  const result: CheckupResult = { at: new Date(now).toISOString(), findings };
  try {
    project.saveCheckup(`${JSON.stringify(result, null, 2)}\n`);
  } catch {
    // keeping the result is only a convenience
  }
  return result;
}

/** The last check-up's result, if one ran. */
export function lastCheckup(project: Project): CheckupResult | undefined {
  try {
    return JSON.parse(readFileSync(project.checkupFile, "utf8")) as CheckupResult;
  } catch {
    return undefined;
  }
}

/** One line for the AI: what the check-up fixed and what is left; undefined when it found nothing. */
export function checkupLine(r: CheckupResult): string | undefined {
  if (r.findings.length === 0) return undefined;
  const fixed = r.findings.filter((f) => f.fixed).length;
  const left = r.findings.length - fixed;
  const parts = [fixed > 0 ? `fixed ${fixed} ${fixed === 1 ? "thing" : "things"}` : "", left > 0 ? `${left} to look at (get_status check: true lists them)` : ""];
  return `Plan check-up: ${parts.filter(Boolean).join("; ")}.`;
}
