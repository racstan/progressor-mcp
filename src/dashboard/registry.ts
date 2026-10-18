// The per-user list of projects that run Progressor, and of the Workspaces the Developer pointed the
// dashboard at, so the one dashboard at localhost:4747 can show all of them (ADR 0001). Each entry
// only says where a folder is; the dashboard reads each project's own .progressor/ markdown, which
// stays the source of truth.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PROGRESSOR_DIR } from "../project.js";
import { slugify } from "../roadmap.js";

export interface ProjectEntry {
  /** Stable ID used in dashboard URLs: the folder name plus a short hash of the full path. */
  id: string;
  /** The folder name. */
  name: string;
  /** The project folder's full path. */
  root: string;
  /** The ID of the Workspace the project was found in, if any (the innermost one). */
  workspace?: string;
}

/** A folder the dashboard scans for projects. Same shape and IDs as a project's entry. */
export type WorkspaceEntry = Omit<ProjectEntry, "workspace">;

interface RegistryFile {
  projects: ProjectEntry[];
  workspaces: WorkspaceEntry[];
}

/** `~/.progressor/projects.json`, or the file named by `PROGRESSOR_REGISTRY`. */
export function defaultRegistryFile(): string {
  return process.env.PROGRESSOR_REGISTRY || join(homedir(), ".progressor", "projects.json");
}

/** Paths compare without case on Windows, where C:\App and c:\app are the same folder. */
export const pathKey = (root: string) => (process.platform === "win32" ? resolve(root).toLowerCase() : resolve(root));

export function projectEntry(root: string): WorkspaceEntry {
  const full = resolve(root);
  const name = basename(full) || full;
  const hash = createHash("sha1").update(pathKey(full)).digest("hex").slice(0, 6);
  return { id: `${slugify(name) || "project"}-${hash}`, name, root: full };
}

const isEntry = (p: any): p is WorkspaceEntry =>
  typeof p?.id === "string" && typeof p?.name === "string" && typeof p?.root === "string";

function read(file: string): RegistryFile {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { projects?: unknown; workspaces?: unknown };
    const list = (v: unknown) => (Array.isArray(v) ? v.filter(isEntry).map(({ id, name, root }) => ({ id, name, root })) : []);
    return { projects: list(data.projects), workspaces: list(data.workspaces) };
  } catch {
    return { projects: [], workspaces: [] };
  }
}

/** Writes one list; projects.json holds only the projects and workspaces.json only the Workspaces. */
function write(file: string, data: Partial<RegistryFile>): void {
  mkdirSync(dirname(file), { recursive: true });
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
  }
}

/** Adds an entry to one of the registry's lists, if it is not there yet. Returns its entry. */
function add(kind: keyof RegistryFile, root: string, file: string): WorkspaceEntry {
  const entry = projectEntry(root);
  const data = read(file);
  if (!data[kind].some((p) => p.id === entry.id)) {
    data[kind].push(entry);
    write(file, { [kind]: data[kind] });
  }
  return entry;
}

const byName = (a: WorkspaceEntry, b: WorkspaceEntry) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root);

/** Adds a project to the registry, if it is not there yet. Returns its entry. */
export function registerProject(root: string, file = defaultRegistryFile()): ProjectEntry {
  return add("projects", root, file);
}

/** The registered projects that still have a progress record, by name. */
export function listProjects(file = defaultRegistryFile()): ProjectEntry[] {
  return read(file).projects.filter((p) => existsSync(join(p.root, PROGRESSOR_DIR))).sort(byName);
}

/**
 * Workspaces live in their own file beside the projects' (`~/.progressor/workspaces.json`), so a
 * Progressor server from before Workspaces, which rewrites projects.json, cannot drop them.
 */
const workspacesFile = (registryFile: string) => join(dirname(registryFile), "workspaces.json");

/** Remembers a folder as a Workspace, so the dashboard keeps showing the projects in it. */
export function addWorkspace(root: string, file = defaultRegistryFile()): WorkspaceEntry {
  return add("workspaces", root, workspacesFile(file));
}

/** Stops showing a Workspace. Projects found in it stay registered if a Progressor server added them. */
export function forgetWorkspace(root: string, file = defaultRegistryFile()): boolean {
  const { id } = projectEntry(root);
  const data = read(workspacesFile(file));
  const kept = data.workspaces.filter((w) => w.id !== id);
  if (kept.length === data.workspaces.length) return false;
  write(workspacesFile(file), { workspaces: kept });
  return true;
}

/** The Workspaces whose folder still exists, by name. */
export function listWorkspaces(file = defaultRegistryFile()): WorkspaceEntry[] {
  return read(workspacesFile(file)).workspaces.filter((w) => existsSync(w.root)).sort(byName);
}
