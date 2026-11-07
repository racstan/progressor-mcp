// The settings for how Progressor works, kept on this computer for every project: one file,
// ~/.progressor/settings.json (next to the project list), with optional overrides for one project
// under `projects[<folder>]`. Every feature has its own section with defaults, so Progressor works
// fully when nobody ever opens Settings. Secrets (a notification token) live here and never in a
// project's .progressor/ folder.
//
// The file is read fresh each time it is needed. Keys this version does not know (written by a newer
// Progressor) are kept through reads and writes. Writes are whole-file, temp file then rename, under
// a hold keyed on the settings folder (lock.ts), so two Progressor processes take turns.
//
// How the page looks (theme, pop-ups, finished goals, editor) is not here: that stays in the browser.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as z from "zod";
import { defaultRegistryFile, pathKey } from "./dashboard/registry.js";
import { withLock } from "./lock.js";

const flag = z.boolean();
const count = z.number().int().min(1);

/** Each feature's settings and what each value may be. A new feature adds one section here. */
const SCHEMA = {
  history: z.object({ enabled: flag, keepDays: count, maxEntries: count, maxMB: z.number().positive() }),
  evidence: z.object({ record: flag, warnUncommitted: flag }),
  estimates: z.object({ learn: flag, window: count }),
  checkup: z.object({ autoRepair: flag, onStatus: flag }),
  release: z.object({ files: z.array(z.string().min(1)), changelog: z.string().min(1) }),
  dependencies: z.object({ warnOnClaim: flag }),
  routines: z.object({ enabled: flag, createFromDashboard: flag }),
  ntfy: z.object({
    enabled: flag,
    server: z.string().url(),
    topic: z.string(),
    token: z.string(),
    events: z.object({ question: flag, handTest: flag, goalFinished: flag, hotfix: flag, alternatives: flag }),
    includeTitles: flag,
  }),
  alternatives: z.object({ wait: z.string().regex(/^\d+(?:\.\d+)?\s*(?:m|min|h|d)$/), offer: z.enum(["off", "big choices", "always"]) }),
  handoffs: z.object({ afterRelease: flag, keep: count }),
};

export type SettingsSection = keyof typeof SCHEMA;
export type Settings = { [K in SettingsSection]: z.infer<(typeof SCHEMA)[K]> };

export const SETTINGS_DEFAULTS: Settings = {
  history: { enabled: true, keepDays: 30, maxEntries: 500, maxMB: 20 },
  evidence: { record: true, warnUncommitted: true },
  estimates: { learn: true, window: 20 },
  checkup: { autoRepair: true, onStatus: true },
  release: { files: ["package.json", "server.json"], changelog: "CHANGELOG.md" },
  dependencies: { warnOnClaim: true },
  routines: { enabled: true, createFromDashboard: true },
  ntfy: {
    enabled: false,
    server: "https://ntfy.sh",
    topic: "",
    token: "",
    events: { question: true, handTest: true, goalFinished: true, hotfix: true, alternatives: true },
    includeTitles: true,
  },
  alternatives: { wait: "0m", offer: "big choices" },
  handoffs: { afterRelease: true, keep: 50 },
};

export const SETTINGS_SECTIONS = Object.keys(SCHEMA) as SettingsSection[];

/** Settings that are never shown back, only whether they are set: "section.key". */
const SECRETS: [SettingsSection, string][] = [["ntfy", "token"]];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const copy = <T>(v: T): T => structuredClone(v);

/** `settings.json` next to the project list, or the file named by `PROGRESSOR_SETTINGS`. */
export function settingsFileFor(registryFile: string): string {
  return process.env.PROGRESSOR_SETTINGS || join(dirname(registryFile), "settings.json");
}

export const defaultSettingsFile = () => settingsFileFor(defaultRegistryFile());

/**
 * Lays `value` over `base` following the schema: a known value that fits replaces the one under it,
 * one that does not fit is ignored, and unknown keys are kept.
 */
function layer(schema: z.ZodType, base: unknown, value: unknown): unknown {
  if (schema instanceof z.ZodObject) {
    const out: Json = { ...(isObject(base) ? base : {}), ...(isObject(value) ? value : {}) };
    const from = isObject(value) ? value : {};
    for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>))
      out[key] = layer(field, isObject(base) ? base[key] : undefined, from[key]);
    return out;
  }
  return value !== undefined && schema.safeParse(value).success ? copy(value) : copy(base);
}

function readRaw(file: string): Json {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return isObject(data) ? data : {};
  } catch {
    return {};
  }
}

function writeRaw(file: string, data: Json): void {
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

const projectsOf = (data: Json): Json => (isObject(data.projects) ? data.projects : {});

function merged(data: Json, projectRoot?: string): Settings {
  const own = projectRoot ? projectsOf(data)[pathKey(projectRoot)] : undefined;
  const out: Json = {};
  for (const section of SETTINGS_SECTIONS) {
    const global = layer(SCHEMA[section], SETTINGS_DEFAULTS[section], data[section]);
    out[section] = isObject(own) ? layer(SCHEMA[section], global, own[section]) : global;
  }
  return out as Settings;
}

/** The settings in effect: the defaults, then the settings for every project, then this project's own. */
export function readSettings(file: string, projectRoot?: string): Settings {
  return merged(readRaw(file), projectRoot);
}

function sectionOf(name: string): SettingsSection {
  if (!(SETTINGS_SECTIONS as string[]).includes(name)) throw new Error(`There are no settings called "${name}". There are: ${SETTINGS_SECTIONS.join(", ")}.`);
  return name as SettingsSection;
}

/** Checks each known value in a change, and says in words which one cannot be used. */
function check(schema: z.ZodType, values: unknown, where: string): void {
  if (!isObject(values)) throw new Error(`The ${where} settings must be given as names and values.`);
  if (!(schema instanceof z.ZodObject)) return;
  for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const v = values[key];
    if (v === undefined) continue;
    if (field instanceof z.ZodObject) check(field, v, `${where} ${key}`);
    else if (!field.safeParse(v).success) throw new Error(`"${key}" in the ${where} settings can't be ${JSON.stringify(v)}.`);
  }
}

/** Lays a change over what is stored, keeping nested values the change does not name. */
function deepMerge(base: unknown, change: Json): Json {
  const out: Json = { ...(isObject(base) ? base : {}) };
  for (const [k, v] of Object.entries(change)) out[k] = isObject(v) ? deepMerge(out[k], v) : copy(v);
  return out;
}

const hold = <T>(file: string, body: () => T): T => withLock(dirname(file), body);

/**
 * Saves a change to one section, for every project or, with `projectRoot`, for that project only.
 * Gives the settings now in effect there.
 */
export function writeSettings(file: string, section: string, values: Json, projectRoot?: string): Settings {
  const name = sectionOf(section);
  check(SCHEMA[name], values, name);
  return hold(file, () => {
    const data = readRaw(file);
    let target = data;
    if (projectRoot) {
      const projects = projectsOf(data);
      const key = pathKey(projectRoot);
      if (!isObject(projects[key])) projects[key] = {};
      data.projects = projects;
      target = projects[key] as Json;
    }
    target[name] = deepMerge(target[name], values);
    // Phone notifications get a topic nobody can guess the first time they are turned on.
    if (name === "ntfy" && merged(data, projectRoot).ntfy.enabled && !merged(data, projectRoot).ntfy.topic)
      (target.ntfy as Json).topic = `progressor-${randomBytes(8).toString("hex")}`;
    writeRaw(file, data);
    return merged(data, projectRoot);
  });
}

/**
 * Puts settings back to their defaults: one section, or everything when no section is named. Without
 * `projectRoot` that is for every project (their own overrides too); with it, only that project's own.
 */
export function resetSettings(file: string, section?: string, projectRoot?: string): Settings {
  const name = section === undefined ? undefined : sectionOf(section);
  return hold(file, () => {
    const data = readRaw(file);
    const projects = projectsOf(data);
    const own = projectRoot ? projects[pathKey(projectRoot)] : undefined;
    if (projectRoot) {
      if (isObject(own)) {
        if (name) delete own[name];
        else delete projects[pathKey(projectRoot)];
      }
    } else if (name) {
      delete data[name];
      for (const p of Object.values(projects)) if (isObject(p)) delete p[name];
    } else {
      for (const key of Object.keys(data)) delete data[key];
    }
    if (isObject(data.projects)) {
      for (const [k, p] of Object.entries(projects)) if (isObject(p) && Object.keys(p).length === 0) delete projects[k];
      if (Object.keys(projects).length === 0) delete data.projects;
    }
    writeRaw(file, data);
    return merged(data, projectRoot);
  });
}

/** What one project has changed for itself only (secrets left out), as stored. */
export function readOwnSettings(file: string, projectRoot: string): Json {
  const own = projectsOf(readRaw(file))[pathKey(projectRoot)];
  if (!isObject(own)) return {};
  const shown = copy(own);
  for (const [section, key] of SECRETS) if (isObject(shown[section])) delete (shown[section] as Json)[key];
  return shown;
}

/** Settings to show on the dashboard: secrets blanked, with the list of those that are set. */
export function maskSecrets(settings: Settings): { settings: Settings; secretsSet: string[] } {
  const shown = copy(settings);
  const secretsSet: string[] = [];
  for (const [section, key] of SECRETS) {
    const group = shown[section] as Json;
    if (typeof group[key] === "string" && group[key]) secretsSet.push(`${section}.${key}`);
    group[key] = "";
  }
  return { settings: shown, secretsSet };
}
