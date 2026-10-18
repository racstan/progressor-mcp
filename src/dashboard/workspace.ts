// A Workspace is any folder the dashboard is pointed at, together with every Project inside it: the
// folders with a Roadmap in their own .progressor/. Finding them only reads the disk; nothing is
// ever created.
import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { PROGRESSOR_DIR, ROADMAP_FILE } from "../project.js";
import { type ProjectEntry, defaultRegistryFile, listProjects, listWorkspaces, pathKey, projectEntry } from "./registry.js";

/** Folders that hold dependencies or build output, never a Project of their own. */
const SKIPPED = new Set([
  "node_modules", "bower_components", "vendor", "dist", "build", "out", "target", "coverage",
  "venv", "env", "__pycache__", "site-packages", "Pods", "DerivedData", "fixtures",
  // operating-system folders full of app data, never a Project
  "AppData", "Library", "Application Data",
]);

export interface FindOptions {
  /** How many folders below the Workspace to look. */
  maxDepth?: number;
  /** How many folders to read at most, so a huge folder (a whole drive) stays quick. */
  maxFolders?: number;
}

export const isProject = (dir: string) => existsSync(join(dir, PROGRESSOR_DIR, ROADMAP_FILE));

/** The Projects in a Workspace, the Workspace folder itself included, nearest first. */
export function findProjects(workspace: string, { maxDepth = 5, maxFolders = 20_000 }: FindOptions = {}): string[] {
  const found: string[] = [];
  let queue = [resolve(workspace)];
  let read = 0;
  for (let depth = 0; depth <= maxDepth && queue.length > 0; depth++) {
    const next: string[] = [];
    for (const dir of queue) {
      if (read++ >= maxFolders) return found;
      if (isProject(dir)) found.push(dir);
      if (depth === maxDepth) continue;
      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue; // unreadable or gone
      }
      // Links are not followed, so a link back up the tree cannot loop.
      for (const e of entries)
        if (e.isDirectory() && !e.name.startsWith(".") && !SKIPPED.has(e.name)) next.push(join(dir, e.name));
    }
    queue = next;
  }
  return found;
}

/** Whether a folder is the Workspace folder or inside it. */
const within = (dir: string, workspace: string) => {
  const d = pathKey(dir);
  const w = pathKey(workspace);
  return d === w || d.startsWith(w.endsWith(sep) ? w : w + sep);
};

/**
 * Every project the dashboard shows: the ones Progressor servers registered and the ones found in
 * the Workspaces, each once, by name. A project inside a Workspace is tagged with the innermost one.
 */
export function allProjects(
  registryFile = defaultRegistryFile(),
  scan: (workspace: string) => string[] = (w) => findProjects(w),
): ProjectEntry[] {
  const workspaces = listWorkspaces(registryFile).sort((a, b) => b.root.length - a.root.length);
  const byId = new Map<string, ProjectEntry>();
  for (const p of listProjects(registryFile)) byId.set(p.id, p);
  for (const w of workspaces) for (const root of scan(w.root)) {
    const entry = projectEntry(root);
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()]
    .map((p) => {
      const ws = workspaces.find((w) => within(p.root, w.root));
      return ws ? { ...p, workspace: ws.id } : { ...p };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root));
}
