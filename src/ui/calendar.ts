// Date helpers for the Calendar page (CalendarPage.tsx): the days a month, week or day view shows,
// which events fall on a day, and how events that overlap in time sit side by side. All in this
// computer's local time; weeks start on Monday.
import type { CalendarEvent, CalendarKind } from "../calendar.js";

export type CalendarView = "month" | "week" | "day" | "list";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of the day `d` is in. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** The Monday of `d`'s week. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** The 6 weeks (42 days) a month view shows: from the Monday on or before the 1st. */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** The days a view shows. The list view shows the month. */
export function viewDays(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  if (view === "month") return monthGrid(anchor);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => addDays(first, i));
}

/** The date one step back (-1) or forward (+1) in a view. */
export function step(view: CalendarView, anchor: Date, by: -1 | 1): Date {
  if (view === "day") return addDays(anchor, by);
  if (view === "week") return addDays(anchor, 7 * by);
  // Months from the 1st, so 31 January goes to February, not March.
  return new Date(anchor.getFullYear(), anchor.getMonth() + by, 1);
}

/** The heading over a view: "November 2026", "2 – 8 Nov 2026", "Saturday 7 November 2026". */
export function viewTitle(view: CalendarView, anchor: Date, locale?: string): string {
  if (view === "month" || view === "list") return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor);
  if (view === "day") return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor);
  const from = startOfWeek(anchor);
  const to = addDays(from, 6);
  const dm = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const dmy = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  return `${from.getFullYear() === to.getFullYear() ? dm.format(from) : dmy.format(from)} – ${dmy.format(to)}`;
}

/** Whether an event is shown on a day: it starts that day, or it runs into it. */
export function onDay(e: CalendarEvent, day: Date): boolean {
  const from = startOfDay(day).getTime();
  const to = from + DAY_MS;
  const start = Date.parse(e.start);
  const end = e.end ? Date.parse(e.end) : start;
  return start < to && (end > from || (start >= from && start < to));
}

/** A day's events by the hour they start in (or 0 for one that runs in from the day before), each hour in time order. */
export function byHour(events: CalendarEvent[], day: Date): CalendarEvent[][] {
  const from = startOfDay(day).getTime();
  const hours: CalendarEvent[][] = Array.from({ length: 24 }, () => []);
  for (const e of events) {
    if (!onDay(e, day)) continue;
    const start = Date.parse(e.start);
    hours[start < from ? 0 : new Date(start).getHours()]!.push(e);
  }
  for (const h of hours) h.sort((a, b) => a.start.localeCompare(b.start));
  return hours;
}

/** How many of an hour's events a week cell shows: all when they fit, else one less and "+N more". */
export const shownInCell = (n: number, fits = 2) => (n <= fits ? n : fits - 1);

/** What each kind is called in the key (`label`) and on one event (`one`). */
export const KINDS: { kind: CalendarKind; label: string; one: string }[] = [
  { kind: "step", label: "Steps finished", one: "Step finished" },
  { kind: "planned", label: "Planned steps", one: "Planned step" },
  { kind: "goal-done", label: "Goals finished", one: "Goal finished" },
  { kind: "release", label: "Releases", one: "Release" },
  { kind: "due", label: "Expected finish", one: "Expected finish" },
  { kind: "goal-added", label: "Goals added", one: "Goal added" },
  { kind: "hotfix", label: "Hotfixes", one: "Hotfix" },
  { kind: "hand-test", label: "Your hand tests", one: "Your hand test" },
  { kind: "routine", label: "Goals that come back", one: "Goal that comes back" },
  { kind: "handoff", label: "Handoffs", one: "Handoff" },
];

/** The time of day as the page shows it: "09:30". */
export const clock = (iso: string, locale?: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
