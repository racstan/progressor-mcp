// Changes made from elsewhere: an Agent working in one project may change another project's plan
// (the `project` input of the tools). Every item it adds or changes there gets an `updated from`
// line naming the project it worked in and when, so the plan's own Session and the Developer can
// tell those changes apart from their own.

/** The detail line that marks an item changed from another project. */
export const ORIGIN_KEY = "updated from";

/** Where and when an item was last changed from another project. */
export interface Origin {
  /** The name of the project the change came from (its folder name). */
  project: string;
  /** When, as an ISO time; undefined when the line has no time (written by hand). */
  at: string | undefined;
}

const AT = /^(.*?)\s+at\s+(\S+)$/;

/** Reads an `updated from` value: `rachitkdeaichat at 2026-10-26T12:00:00.000Z`. */
export function parseOrigin(value: string | undefined): Origin | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const m = AT.exec(text);
  return m && !Number.isNaN(Date.parse(m[2]!)) ? { project: m[1]!, at: m[2] } : { project: text, at: undefined };
}

export function formatOrigin(origin: Origin): string {
  const project = origin.project.replace(/\s+/g, " ").trim();
  return origin.at ? `${project} at ${origin.at}` : project;
}

/** The time of an Origin in ms since 1970, or undefined when it has none. */
export function originTime(origin: Origin | undefined): number | undefined {
  const t = origin?.at ? Date.parse(origin.at) : NaN;
  return Number.isNaN(t) ? undefined : t;
}

/** The latest of several Origins, by time. */
export function latestOrigin(origins: readonly (Origin | undefined)[]): Origin | undefined {
  let best: Origin | undefined;
  for (const o of origins) if (o && (best === undefined || (originTime(o) ?? 0) > (originTime(best) ?? 0))) best = o;
  return best;
}
