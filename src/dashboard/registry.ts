// The per-user list of projects that run Progressor, so the one dashboard at localhost:4747 can
// show all of them (ADR 0001). Each entry only says where a project is; the dashboard reads the
// project's own .progressor/ markdown, which stays the source of truth.
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
}

/** `~/.progressor/projects.json`, or the file named by `PROGRESSOR_REGISTRY`. */
export function defaultRegistryFile(): string {
  return process.env.PROGRESSOR_REGISTRY || join(homedir(), ".progressor", "projects.json");
}

/** Paths compare without case on Windows, where C:\App and c:\app are the same folder. */
const pathKey = (root: string) => (process.platform === "win32" ? resolve(root).toLowerCase() : resolve(root));

export function projectEntry(root: string): ProjectEntry {
  const full = resolve(root);
  const name = basename(full) || full;
  const hash = createHash("sha1").update(pathKey(full)).digest("hex").slice(0, 6);
  return { id: `${slugify(name) || "project"}-${hash}`, name, root: full };
}

function read(file: string): ProjectEntry[] {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { projects?: unknown };
    if (!Array.isArray(data.projects)) return [];
    return data.projects.filter(
      (p): p is ProjectEntry => typeof p?.id === "string" && typeof p?.name === "string" && typeof p?.root === "string",
    );
  } catch {
    return [];
  }
}

/** Adds a project to the registry, if it is not there yet. Returns its entry. */
export function registerProject(root: string, file = defaultRegistryFile()): ProjectEntry {
  const entry = projectEntry(root);
  const projects = read(file);
  if (!projects.some((p) => p.id === entry.id)) {
    projects.push(entry);
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ projects }, null, 2)}\n`);
    try {
      renameSync(tmp, file);
    } catch {
      writeFileSync(file, `${JSON.stringify({ projects }, null, 2)}\n`);
    }
  }
  return entry;
}

/** The registered projects that still have a progress record, by name. */
export function listProjects(file = defaultRegistryFile()): ProjectEntry[] {
  return read(file)
    .filter((p) => existsSync(join(p.root, PROGRESSOR_DIR)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root));
}
