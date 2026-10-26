// Changing another project's plan from here, and telling that project's own Session about it.
//
// An Agent working in project A may do work that belongs to project B (say, releasing B). The
// tools' `project` input points a change at B's plan; the items it adds or changes there are marked
// `updated from: A at <time>` (origin.ts). Only a project the dashboard knows (the registry, or a
// Workspace) or a folder that already has a .progressor/ can be changed this way: a plan is never
// started in a folder from outside.
//
// B's Session hears about such changes once: get_status and Claude Code's hooks list the ones made
// since it last looked, and remember when that was in `~/.progressor/seen.json`.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { type ProjectEntry, defaultRegistryFile, listProjects, pathKey, projectEntry } from "./dashboard/registry.js";
import { allProjects } from "./dashboard/workspace.js";
import { type Origin, originTime } from "./origin.js";
import { PROGRESSOR_DIR, type Project } from "./project.js";

/** A project to change from elsewhere: its entry, with the real path of its folder. */
export type Target = Pick<ProjectEntry, "id" | "name" | "root">;

const real = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
};

/** The real path of a folder that has a .progressor/ folder, else undefined. */
function planFolder(root: string): string | undefined {
  const r = real(root);
  if (!r) return undefined;
  try {
    return statSync(join(r, PROGRESSOR_DIR)).isDirectory() ? r : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The project `wanted` names: its ID or name on the dashboard's project list, or the full path of
 * its folder. Paths are resolved to their real place, and must hold a .progressor/ folder already.
 */
export function resolveProject(
  wanted: string,
  options: { registryFile?: string; projects?: () => ProjectEntry[] } = {},
): Target {
  const text = wanted.trim();
  if (!text) throw new Error("Say which project: its name or ID on the dashboard, or the full path of its folder.");
  if (isAbsolute(text)) {
    const root = planFolder(text);
    if (!root)
      throw new Error(
        `${text} has no Progressor plan (no .progressor/ folder). Only a project that already uses Progressor can be changed from here; ` +
          "to start one, open that folder in an AI app with Progressor.",
      );
    return { ...projectEntry(root), root };
  }
  const registryFile = options.registryFile ?? defaultRegistryFile();
  const lists = [() => listProjects(registryFile), options.projects ?? (() => allProjects(registryFile))];
  for (const list of lists) {
    const entries = list();
    const key = text.toLowerCase();
    const byId = entries.filter((p) => p.id.toLowerCase() === key);
    const matches = byId.length > 0 ? byId : entries.filter((p) => p.name.toLowerCase() === key);
    if (matches.length > 1)
      throw new Error(
        `Several projects are called ${text}: ${matches.map((p) => `${p.id} (${p.root})`).join(", ")}. Give the ID or the full path instead.`,
      );
    const [match] = matches;
    if (!match) continue;
    const root = planFolder(match.root);
    if (!root) throw new Error(`Project ${match.name} (${match.root}) has no Progressor plan any more.`);
    return { id: match.id, name: match.name, root };
  }
  throw new Error(
    `No project called ${text} on the dashboard's project list. Give its name or ID as the dashboard shows it, or the full path of its folder.`,
  );
}

/** Whether two folders are the same, comparing real paths. */
export function sameFolder(a: string, b: string): boolean {
  return pathKey(real(a) ?? a) === pathKey(real(b) ?? b);
}

// --- what the project's own Session has seen ----------------------------------------------------

/** `~/.progressor/seen.json`, beside the project registry: for each project, when its Session last looked. */
export const seenFile = (registryFile = defaultRegistryFile()) => join(dirname(registryFile), "seen.json");

function readSeen(file: string): Record<string, string> {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** When the project's Session last saw the changes made from elsewhere, in ms since 1970; 0 if never. */
export function lastSeen(root: string, file = seenFile()): number {
  const t = Date.parse(readSeen(file)[pathKey(real(root) ?? root)] ?? "");
  return Number.isNaN(t) ? 0 : t;
}

/** Remembers that the project's Session has seen the changes made from elsewhere up to `at`. */
export function markSeen(root: string, at: Date, file = seenFile()): void {
  try {
    const data = readSeen(file);
    data[pathKey(real(root) ?? root)] = at.toISOString();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tmp, file);
  } catch {
    // Only a reminder; at worst it is shown again.
  }
}

// --- the changes made from elsewhere ----------------------------------------------------------

/** One item changed from another project. */
export interface ElsewhereChange {
  /** "Goal release-0-7-1", "Task release-0-7-1/t2", ... */
  what: string;
  title: string;
  origin: Origin;
}

const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}...` : s);

/** The items changed from another project after `since` (ms since 1970), oldest first. */
export function changesSince(project: Project, since: number): ElsewhereChange[] {
  const after = (o: Origin | undefined): o is Origin => o !== undefined && (originTime(o) ?? 0) > since;
  const changes: ElsewhereChange[] = [];
  const goalsDir = join(project.root, PROGRESSOR_DIR, "goals");
  for (const goal of project.roadmap().goals) {
    if (after(goal.updatedFrom)) changes.push({ what: `Goal ${goal.id}`, title: goal.title, origin: goal.updatedFrom });
    // A Plan File not written since then holds no newer change.
    const file = join(goalsDir, `${goal.id}.md`);
    if (!existsSync(file) || statSync(file).mtimeMs < since) continue;
    let plan;
    try {
      plan = project.plan(goal.id);
    } catch {
      continue;
    }
    for (const t of plan.tasks) if (after(t.updatedFrom)) changes.push({ what: `Task ${goal.id}/${t.id}`, title: t.title, origin: t.updatedFrom });
    for (const d of plan.decisions) if (after(d.updatedFrom)) changes.push({ what: `Decision ${goal.id}/${d.id}`, title: d.text, origin: d.updatedFrom });
    for (const n of plan.notes) if (after(n.updatedFrom)) changes.push({ what: `Note ${goal.id}/${n.id}`, title: n.text, origin: n.updatedFrom });
  }
  return changes.sort((a, b) => (originTime(a.origin) ?? 0) - (originTime(b.origin) ?? 0));
}

const MAX_LISTED = 8;
/** How often a look that found nothing is remembered, so the hooks don't write on every message. */
const REMEMBER_EVERY_MS = 60 * 60_000;

/** The line telling a Session what was changed from elsewhere, or undefined when nothing was. */
export function elsewhereLine(changes: ElsewhereChange[]): string | undefined {
  if (changes.length === 0) return undefined;
  const listed = changes.slice(-MAX_LISTED).map((c) => `${c.what} "${clip(c.title)}" (from ${c.origin.project})`);
  const more = changes.length > MAX_LISTED ? `; and ${changes.length - MAX_LISTED} more` : "";
  return `Changed from elsewhere since you last looked (by an AI chat working in another project): ${listed.join("; ")}${more}.`;
}

/**
 * The changes made from elsewhere that the project's Session has not seen yet, as a line, and marks
 * them seen. Undefined when there are none.
 */
export function takeElsewhereLine(project: Project, file = seenFile()): string | undefined {
  try {
    const since = lastSeen(project.root, file);
    const started = Date.now();
    const changes = changesSince(project, since);
    const line = elsewhereLine(changes);
    // Seen up to the newest change shown, so one made meanwhile is still shown next time.
    if (line) markSeen(project.root, new Date(Math.max(...changes.map((c) => originTime(c.origin) ?? 0))), file);
    // With nothing to show, the time still moves on now and then, so the next look only reads the
    // Plan Files written since; a little early, for a change being written while this one read.
    else if (started - since > REMEMBER_EVERY_MS) markSeen(project.root, new Date(started - 5000), file);
    return line;
  } catch {
    return undefined;
  }
}
