// Finds helper work that was left behind: a Task is done, dropped or released but the helper's branch
// still holds work that is not merged, or a Task has been checked for a long time and not released.
//
// It only ever reads. The branch check runs two read-only `git` commands in the project folder, each
// with a short timeout, however many Tasks there are; if git is missing, slow, or the folder is not a
// repository, the check says nothing instead of failing.

import { execFileSync } from "node:child_process";
import { minutesSince, sayDuration } from "./estimate.js";
import { FINISHED, type Task } from "./planFile.js";

/** A Task checked for longer than this and still not released is reported (a day, in minutes). */
export const CHECKED_TOO_LONG = 24 * 60;
const GIT_TIMEOUT_MS = 2000;

/** The local branches of a repository, and which of them are already part of HEAD; undefined when git cannot say. */
export interface Branches {
  exists: Set<string>;
  merged: Set<string>;
}

function lines(root: string, args: string[]): Set<string> {
  const out = execFileSync("git", ["for-each-ref", "--format=%(refname:lstrip=2)", ...args, "refs/heads"], {
    cwd: root,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  }).toString();
  return new Set(out.split("\n").filter(Boolean));
}

export function gitBranches(root: string): Branches | undefined {
  try {
    return { exists: lines(root, []), merged: lines(root, ["--merged=HEAD"]) };
  } catch {
    return undefined;
  }
}

export interface Candidate {
  goal: string;
  task: Task;
}

/**
 * The warnings for the Tasks given. `branches` is only asked for when some finished Task has a
 * helper branch recorded, so a project with no helper info never runs git.
 */
export function orphanWarnings(candidates: Candidate[], branches: () => Branches | undefined, now: Date): string[] {
  const warnings: string[] = [];
  const finished = candidates.filter((c) => c.task.helper?.branch && FINISHED.includes(c.task.status));
  const known = finished.length > 0 ? branches() : undefined;
  for (const { goal, task: t } of candidates) {
    const where = `Task ${t.id} ${t.title} in goal ${goal}`;
    const branch = t.helper?.branch;
    if (known && branch && FINISHED.includes(t.status) && known.exists.has(branch) && !known.merged.has(branch))
      warnings.push(
        `Warning: ${where} is ${t.status}, but its helper branch ${branch} still has work that is not merged${t.helper?.folder ? ` (folder ${t.helper.folder})` : ""}. Merge it, or delete the branch if it is not needed.`,
      );
    if (t.status === "checked" && t.checkedSince) {
      const minutes = minutesSince(t.checkedSince, now);
      if (minutes >= CHECKED_TOO_LONG)
        warnings.push(`Warning: ${where} has been checked for ${sayDuration(Math.floor(minutes / 60) * 60)} and is still not released. Merge it, or say what is holding it up.`);
    }
  }
  return warnings;
}
