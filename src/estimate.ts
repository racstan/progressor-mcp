// Estimated and actual times, in whole minutes. Pure, so the dashboard page uses it too.
//
// The plan files write a time compactly ("45m", "2h", "1h 30m"); the Agent and the Developer read it
// spaced out ("45 m", "1 h 30 m"), and a rough expected finish is rounded ("about 6 h").

const PART = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?![a-z])/gy;

/**
 * Minutes in a time such as "45m", "2h", "1.5h", "1h 30m", "90 min" or "2 hours"; undefined when the
 * text is not one. Days are not taken: how long a working day is depends on who is working.
 */
export function parseDuration(text: string): number | undefined {
  const s = text.trim().toLowerCase();
  if (!s) return undefined;
  let minutes = 0;
  let at = 0;
  let parts = 0;
  while (at < s.length) {
    while (s[at] === " " || s[at] === ",") at++;
    if (at >= s.length) break;
    PART.lastIndex = at;
    const m = PART.exec(s);
    if (!m) return undefined;
    minutes += Number(m[1]) * (m[2]!.startsWith("h") ? 60 : 1);
    at = PART.lastIndex;
    parts++;
  }
  return parts > 0 ? Math.round(minutes) : undefined;
}

/** The plan files' form of a time: "45m", "2h", "1h 30m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** A time as people read it: "45 m", "2 h", "1 h 10 m". */
export function sayDuration(minutes: number): string {
  return formatDuration(minutes).replace(/(\d)([hm])/g, "$1 $2");
}

/**
 * A rough time for an expected finish, without the "about": to 5 minutes under an hour, to half an
 * hour under ten hours, else to the hour ("25 m", "2 h 30 m", "14 h").
 */
export function roughDuration(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m < 60) return sayDuration(Math.max(5, Math.ceil(m / 5) * 5));
  if (m < 600) return sayDuration(Math.round(m / 30) * 30);
  return sayDuration(Math.round(m / 60) * 60);
}

/** Minutes between an ISO time and now; 0 when the time cannot be read or is in the future. */
export function minutesSince(iso: string | undefined, now: Date): number {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(at) ? 0 : Math.max(0, (now.getTime() - at) / 60_000);
}

/**
 * Estimate against actual, for calibrating: "took 1 h 10 m, estimated 45 m", "20 m so far, estimated
 * 45 m", "took 30 m", "estimated 45 m". Undefined when there is neither.
 */
export function timeText(t: { estimate?: number; spent: number; running: boolean }): string | undefined {
  const spent = Math.round(t.spent);
  const actual = spent > 0 || t.running ? (t.running ? `${sayDuration(spent)} so far` : `took ${sayDuration(spent)}`) : undefined;
  const estimate = t.estimate !== undefined ? `estimated ${sayDuration(t.estimate)}` : undefined;
  if (!actual) return estimate;
  return estimate ? `${actual}, ${estimate}` : actual;
}
