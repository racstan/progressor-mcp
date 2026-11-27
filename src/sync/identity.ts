// Which plan in the shared plans repo a project is (plan sync). The same project lives in different
// folders on different computers, so it is matched by its git remote (github.com/owner/repo, in any
// URL form), else by its folder name; the Developer's AI can also link a project to a key by hand.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { defaultRegistryFile, pathKey } from "../dashboard/registry.js";
import { slugify } from "../roadmap.js";

/** A key is a folder in the plans repo: lowercase parts of letters, digits, dots, dashes and underscores. */
const PART = /^[a-z0-9_][a-z0-9._-]*$/;

/** Whether a key is safe to use as a folder path inside the plans repo. */
export function validKey(key: string): boolean {
  const parts = key.split("/");
  return parts.length >= 1 && parts.length <= 8 && parts.every((p) => PART.test(p) && p !== "." && p !== ".." && !p.startsWith(".git"));
}

/** The key for a git remote URL, such as `github.com/owner/repo`; undefined for a local folder or a remote it can't read. */
export function remoteKey(remote: string): string | undefined {
  const url = remote.trim();
  if (!url) return undefined;
  let host: string;
  let path: string;
  const scheme = /^(?:https?|ssh|git):\/\/(?:[^@/]*@)?([^/:]+)(?::\d+)?\/(.*)$/i.exec(url);
  const scp = /^(?:[^@/\s]+@)?([^/:\s]+):(?!\/)(.*)$/.exec(url);
  if (scheme) [, host, path] = scheme as unknown as [string, string, string];
  else if (scp && scp[1]!.includes(".")) [, host, path] = scp as unknown as [string, string, string];
  else return undefined;
  host = host.toLowerCase().replace(/^www\./, "");
  const parts = path
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .split("/")
    .filter(Boolean)
    .map((p) => p.toLowerCase());
  if (parts.length < 2) return undefined;
  const key = [host, ...parts].join("/");
  return validKey(key) ? key : undefined;
}

/** The project's `origin` remote, as git reports it; undefined when there is none or git is missing. */
export function gitRemote(root: string): string | undefined {
  try {
    const out = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
    return out.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** `~/.progressor/sync-links.json`: projects linked to a key by hand, by folder. */
export function defaultLinksFile(registryFile = defaultRegistryFile()): string {
  return join(dirname(registryFile), "sync-links.json");
}

function readLinks(file: string): Record<string, string> {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { links?: unknown };
    const links: Record<string, string> = {};
    if (data.links && typeof data.links === "object") {
      for (const [k, v] of Object.entries(data.links as Record<string, unknown>)) if (typeof v === "string" && validKey(v)) links[k] = v;
    }
    return links;
  } catch {
    return {};
  }
}

function writeLinks(file: string, links: Record<string, string>): void {
  mkdirSync(dirname(file), { recursive: true });
  const text = `${JSON.stringify({ links }, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, text);
  }
}

/** Links a project folder to a key by hand, so it syncs with that plan whatever its remote is. */
export function linkProject(root: string, key: string, file = defaultLinksFile()): string {
  const k = key.trim().toLowerCase();
  if (!validKey(k)) {
    throw new Error(`"${key}" can't name a plan in the plans repo: use parts of letters, digits, dots and dashes, separated by "/", such as github.com/owner/repo.`);
  }
  const links = readLinks(file);
  links[pathKey(root)] = k;
  writeLinks(file, links);
  return k;
}

/** Removes a project's hand-made link. True when it had one. */
export function unlinkProject(root: string, file = defaultLinksFile()): boolean {
  const links = readLinks(file);
  const at = pathKey(root);
  if (!(at in links)) return false;
  delete links[at];
  writeLinks(file, links);
  return true;
}

/**
 * The key of a project's plan in the plans repo: its hand-made link, else its git remote's key,
 * else `folder/<folder name>`.
 */
export function syncKey(root: string, options: { links?: string; remote?: (root: string) => string | undefined } = {}): string {
  const linked = readLinks(options.links ?? defaultLinksFile())[pathKey(root)];
  if (linked) return linked;
  const remote = (options.remote ?? gitRemote)(root);
  const fromRemote = remote ? remoteKey(remote) : undefined;
  if (fromRemote) return fromRemote;
  const name = slugify(basename(resolve(root).replace(/[\\/]+$/, "")) || "project") || "project";
  return `folder/${name}`;
}
