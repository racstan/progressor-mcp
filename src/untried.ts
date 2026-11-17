// Things to try by hand that are still untried: how many, across how many goals, and how old the
// oldest is, in plain words. Pure, so it is tested; the AI's reminder (server.ts) and the dashboard's
// Needs you card (ui/home.ts) both read it.

const DAY = 86_400_000;

/** One untried thing to try, with the goal it is in and when it was added (an ISO time, if known). */
export interface Untried {
  goal: string;
  at?: string | undefined;
}

export interface UntriedSummary {
  count: number;
  goals: number;
  /** When the oldest one was added; left out when no date is known. */
  oldestAt?: string;
}

export function summarizeUntried(list: readonly Untried[]): UntriedSummary {
  let oldest: { t: number; at: string } | undefined;
  for (const u of list) {
    const t = u.at ? Date.parse(u.at) : NaN;
    if (!Number.isNaN(t) && (!oldest || t < oldest.t)) oldest = { t, at: u.at! };
  }
  return { count: list.length, goals: new Set(list.map((u) => u.goal)).size, ...(oldest ? { oldestAt: oldest.at } : {}) };
}

/** "today", "yesterday" or "4 days ago". */
export function ageWords(iso: string, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** "7 things to try across 3 goals", "1 thing to try", "2 things to try in 1 goal". */
export function thingsWords(s: Pick<UntriedSummary, "count" | "goals">): string {
  const things = `${s.count} ${s.count === 1 ? "thing" : "things"} to try`;
  return s.count === 1 ? things : s.goals === 1 ? `${things} in 1 goal` : `${things} across ${s.goals} goals`;
}

/** The one line the AI is told, once in a while; undefined when nothing is untried. */
export function reminderLine(s: UntriedSummary, now: Date): string | undefined {
  if (s.count === 0) return undefined;
  const oldest = s.oldestAt ? `, the oldest from ${ageWords(s.oldestAt, now)}` : "";
  return `The Developer has ${thingsWords(s)}${oldest}; mention them once when you next report, and point to the dashboard's Try them one by one.`;
}

/** What the dashboard's Needs you card says; undefined when nothing is untried. */
export function dashboardLine(s: UntriedSummary, now: Date): string | undefined {
  if (s.count === 0) return undefined;
  return s.oldestAt ? `${thingsWords(s)} · the oldest was added ${ageWords(s.oldestAt, now)}` : thingsWords(s);
}

/** Lets a line through at most once a day (by the clock given); asking with nothing does not use the day up. */
export function oncePerDay(clock: () => Date): (line: string | undefined) => string | undefined {
  let last: number | undefined;
  return (line) => {
    if (!line) return undefined;
    const t = clock().getTime();
    if (last !== undefined && t - last < DAY) return undefined;
    last = t;
    return line;
  };
}
