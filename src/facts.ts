// The facts a release goal hands the AI, so it can write the changelog entry and bump the version
// itself: which finished goals the release bundles (what each was for, its steps and decisions), the
// commits since the last version's tag, the version now and the one to write, and the latest
// changelog entry as a sample of the style. Progressor only gathers facts; the AI writes the words.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "./project.js";
import type { Goal } from "./roadmap.js";

/** At most this many goals and commits are listed, to keep the reply short. */
const MAX_GOALS = 20;
const MAX_COMMITS = 30;
/** The changelog sample is cut to this many lines. */
const SAMPLE_LINES = 15;

export interface ReleaseOptions {
  /** The goals to bundle; by default every finished goal no earlier release goal bundles. */
  bundles?: string[];
  /** The version to release; by default the next one (patch for hotfixes only, minor otherwise). */
  version?: string;
  /** The files that carry the version, and the changelog (settings.ts, "release"). */
  files?: string[];
  changelog?: string;
}

export interface ReleaseFacts {
  bundles: string[];
  /** The version in package.json now, when there is one. */
  current: string | undefined;
  version: string | undefined;
  text: string;
}

/** `1.3.0` → `1.4.0` (minor) or `1.3.1` (patch); undefined for anything that is not x.y.z. */
export function bumpVersion(version: string, kind: "minor" | "patch"): string | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return undefined;
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return kind === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

/** The newest `## ` entry of a changelog, without trailing blank lines; undefined when there is none. */
export function latestChangelogEntry(text: string): string | undefined {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.startsWith("## "));
  if (start < 0) return undefined;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start, Math.min(end, start + SAMPLE_LINES)).join("\n").trimEnd();
}

function readVersion(root: string): string | undefined {
  try {
    const v = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }).version;
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The finished goals no release goal (other than `except`) bundles yet, in Roadmap order. */
export function unbundledGoals(goals: Goal[], except?: string): Goal[] {
  const taken = new Set(goals.filter((g) => g.release !== undefined && g.status !== "dropped" && g.id !== except).flatMap((g) => g.bundles ?? []));
  return goals.filter((g) => g.status === "done" && g.release === undefined && !taken.has(g.id));
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** What a release would bundle and the facts to write it from. */
export function releaseFacts(project: Project, options: ReleaseOptions & { goalId?: string }): ReleaseFacts {
  const goals = project.roadmap().goals;
  const chosen = options.bundles
    ? options.bundles.map((id) => goals.find((g) => g.id === id)).filter((g): g is Goal => !!g)
    : unbundledGoals(goals, options.goalId);
  const current = readVersion(project.root);
  const kind = chosen.length > 0 && chosen.every((g) => g.hotfix) ? "patch" : "minor";
  const version = options.version ?? (current ? bumpVersion(current, kind) : undefined);
  const out: string[] = [];
  out.push(`Release facts for ${version ?? "the next version"}${current ? ` (now ${current})` : ""}:`);
  if (chosen.length === 0) out.push("No finished goals to bundle: every finished goal is in an earlier release.");
  else out.push(`Finished goals it bundles (${chosen.length}):`);
  for (const g of chosen.slice(0, MAX_GOALS)) {
    out.push(`- ${g.id}: ${oneLine(g.title)}.${g.hotfix ? " (a bug fix)" : ""}${g.outcome ? ` Finished when: ${oneLine(g.outcome).replace(/([^.!?])$/, "$1.")}` : ""}`);
    try {
      const plan = project.plan(g.id);
      const steps = plan.tasks.filter((t) => t.status === "done").map((t) => oneLine(t.title));
      if (steps.length) out.push(`  Steps: ${steps.slice(0, 8).join("; ")}${steps.length > 8 ? `; and ${steps.length - 8} more` : ""}`);
      const decisions = plan.decisions.map((d) => oneLine(d.text));
      if (decisions.length) out.push(`  Decisions: ${decisions.slice(0, 4).join("; ")}`);
    } catch {
      // A goal without a readable plan file still has its title and outcome.
    }
  }
  if (chosen.length > MAX_GOALS) out.push(`- and ${chosen.length - MAX_GOALS} more`);
  if (current) {
    const tag = `v${current}`;
    const commits = project.commitsAfter(tag, MAX_COMMITS);
    if (commits) {
      out.push(`Commits since ${tag} (${commits.total}):`);
      for (const c of commits.lines) out.push(`- ${c}`);
      if (commits.total > commits.lines.length) out.push(`- and ${commits.total - commits.lines.length} older`);
    }
  }
  const changelog = options.changelog ?? "CHANGELOG.md";
  const changelogPath = join(project.root, changelog);
  const sample = existsSync(changelogPath) ? latestChangelogEntry(readFileSync(changelogPath, "utf8")) : undefined;
  if (sample) out.push(`The latest ${changelog} entry, for its style:`, ...sample.split("\n").map((l) => `  ${l}`));
  const files = (options.files ?? ["package.json", "server.json"]).filter((f) => existsSync(join(project.root, f)));
  if (chosen.length > 0)
    out.push(
      (sample
        ? `Write the ${changelog} entry for ${version ?? "the next version"} in that style, from these facts, at the top of the entries.`
        : `Start ${changelog} with an entry for ${version ?? "the next version"} ("## <version> · <a few words>", then one line per change), from these facts.`) +
        (files.length ? ` Then set the version to ${version ?? "the new one"} in ${files.join(", ")}.` : "") +
        " Ask before tagging or publishing.",
    );
  return { bundles: chosen.map((g) => g.id), current, version, text: out.join("\n") };
}
