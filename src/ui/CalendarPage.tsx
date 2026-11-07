// The Calendar page: everything in the plan that has a date (calendar.ts), by month, week, day or as
// a list. It fills itself as your AI works: steps finished, goals added and finished, releases, your
// hand tests, handoffs, and ahead of today the steps planned next, when each goal should be done and
// when goals that come back are due. Clicking an event shows it; its goal opens from there.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarKind } from "../calendar.js";
import { type CalendarView, KINDS, byHour, clock, monthGrid, onDay, sameDay, shownInCell, startOfDay, step, viewDays, viewTitle } from "./calendar.js";
import { type RoadmapView, useCalendar } from "./data.js";
import { Icon } from "./Icon.js";

/** The address of the Calendar page, after the project. */
export const CALENDAR_HASH = "#/calendar";

const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2026, 10, 2 + i)));
const VIEWS: { view: CalendarView; label: string; key: string }[] = [
  { view: "month", label: "Month", key: "m" },
  { view: "week", label: "Week", key: "w" },
  { view: "day", label: "Day", key: "d" },
  { view: "list", label: "List", key: "l" },
];

function stored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse; the choice just isn't remembered.
  }
}

const dayLabel = (d: Date) => new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(d);
const when = (e: CalendarEvent) => {
  const d = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(e.start));
  return e.end ? `${d}, ${clock(e.start)} – ${clock(e.end)}` : `${d}, ${clock(e.start)}`;
};
const kindLabel = (k: CalendarKind) => KINDS.find((x) => x.kind === k)?.one ?? k;

function Chip({ e, onPick, picked, compact }: { e: CalendarEvent; onPick: (e: CalendarEvent) => void; picked: boolean; compact?: boolean }) {
  return (
    <button className={`cal-ev k-${e.kind}${picked ? " picked" : ""}`} onClick={(ev) => { ev.stopPropagation(); onPick(e); }}
      title={`${e.title}${e.goalTitle && e.goalTitle !== e.title ? ` · ${e.goalTitle}` : ""}`}>
      <i aria-hidden="true" />
      {!compact && <span className="cal-time">{clock(e.start)}</span>}
      <span className="cal-t">{e.title}</span>
    </button>
  );
}

function Month({ anchor, today, events, picked, onPick, onDay: openDay }: {
  anchor: Date; today: Date; events: CalendarEvent[]; picked?: string; onPick: (e: CalendarEvent) => void; onDay: (d: Date) => void;
}) {
  const days = monthGrid(anchor);
  const SHOW = 3;
  return (
    <div className="cal-month" role="grid" aria-label={viewTitle("month", anchor)}>
      {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
      {days.map((d) => {
        const here = events.filter((e) => onDay(e, d));
        const out = d.getMonth() !== anchor.getMonth();
        return (
          <div key={d.toISOString()} role="gridcell" className={`cal-cell${out ? " out" : ""}${sameDay(d, today) ? " today" : ""}${d < startOfDay(today) ? " past" : ""}`}
            onDoubleClick={() => openDay(d)}>
            <button className="cal-date" onClick={() => openDay(d)} aria-label={`${dayLabel(d)}: ${here.length} event${here.length === 1 ? "" : "s"}`}>{d.getDate()}</button>
            <div className="cal-cell-evs">
              {here.slice(0, SHOW).map((e) => <Chip key={e.id} e={e} onPick={onPick} picked={picked === e.id} />)}
              {here.length > SHOW && <button className="cal-more" onClick={() => openDay(d)}>+{here.length - SHOW} more</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Week and day: a row per hour. A week cell shows two events or one and "+N more"; a day row shows them all. */
function TimeGrid({ days, today, now, events, picked, onPick, onDay: openDay }: {
  days: Date[]; today: Date; now: Date; events: CalendarEvent[]; picked?: string; onPick: (e: CalendarEvent) => void; onDay: (d: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const one = days.length === 1;
  const hours = days.map((d) => byHour(events, d));
  // Open at the working day: an hour before now on today, else at the first hour with something in it, else 8:00.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = Math.min(...hours.map((h) => h.findIndex((x) => x.length > 0)).filter((i) => i >= 0));
    const hour = days.some((d) => sameDay(d, today)) ? Math.max(0, now.getHours() - 1) : Number.isFinite(first) ? first : 8;
    const row = el.querySelector<HTMLElement>(`[data-hour="${hour}"]`);
    el.scrollTop = row ? row.offsetTop - el.offsetTop : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, days[0]?.getTime()]);
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  return (
    <div className={`cal-time-grid${one ? " one" : ""}`}>
      {!one && (
        <div className="cal-head" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <button key={d.toISOString()} className={`cal-head-day${sameDay(d, today) ? " today" : ""}`} onClick={() => openDay(d)} title={`Open ${dayLabel(d)}`}>
              <small>{WEEKDAYS[(d.getDay() + 6) % 7]}</small><b>{d.getDate()}</b>
            </button>
          ))}
        </div>
      )}
      <div className="cal-scroll" ref={scroller}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="cal-hour-row" data-hour={h} style={{ gridTemplateColumns: cols }}>
            <span className="cal-hour-label">{`${String(h).padStart(2, "0")}:00`}</span>
            {days.map((d, i) => {
              const here = hours[i]![h]!;
              const isNow = sameDay(d, today) && now.getHours() === h;
              const shown = one ? here.length : shownInCell(here.length);
              return (
                <div key={d.toISOString()} className={`cal-slot${sameDay(d, today) ? " today" : ""}${isNow ? " now" : ""}`}>
                  {isNow && <div className="cal-now" style={{ top: `${(now.getMinutes() / 60) * 100}%` }} aria-label="Now" />}
                  {here.slice(0, shown).map((e) =>
                    one ? (
                      <button key={e.id} className={`cal-block k-${e.kind}${picked === e.id ? " picked" : ""}`} onClick={() => onPick(e)}>
                        <span className="cal-block-time">{e.end ? `${clock(e.start)} – ${clock(e.end)}` : clock(e.start)}</span>
                        <b>{e.title}</b>
                        <small>{[kindLabel(e.kind), e.goalTitle && e.goalTitle !== e.title ? e.goalTitle : undefined].filter(Boolean).join(" · ")}</small>
                      </button>
                    ) : (
                      <Chip key={e.id} e={e} onPick={onPick} picked={picked === e.id} />
                    ),
                  )}
                  {here.length > shown && <button className="cal-more" onClick={() => openDay(d)}>+{here.length - shown} more</button>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function List({ days, today, events, picked, onPick }: { days: Date[]; today: Date; events: CalendarEvent[]; picked?: string; onPick: (e: CalendarEvent) => void }) {
  const groups = days.map((d) => ({ d, evs: events.filter((e) => sameDay(new Date(e.start), d)) })).filter((g) => g.evs.length);
  if (!groups.length) return <p className="cal-empty">Nothing this month.</p>;
  return (
    <div className="cal-list">
      {groups.map(({ d, evs }) => (
        <section key={d.toISOString()} className={sameDay(d, today) ? "today" : undefined}>
          <h3>{dayLabel(d)}{sameDay(d, today) && <span className="cal-today-tag">Today</span>}</h3>
          <ul>
            {evs.map((e) => (
              <li key={e.id}>
                <button className={`cal-row k-${e.kind}${picked === e.id ? " picked" : ""}`} onClick={() => onPick(e)}>
                  <span className="cal-row-time">{e.end ? `${clock(e.start)} – ${clock(e.end)}` : clock(e.start)}</span>
                  <i aria-hidden="true" />
                  <span className="cal-row-main"><b>{e.title}</b><small>{[kindLabel(e.kind), e.goalTitle && e.goalTitle !== e.title ? e.goalTitle : undefined].filter(Boolean).join(" · ")}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function CalendarPage({ projectId, roadmap, onOpenGoal }: { projectId: string; roadmap: RoadmapView; onOpenGoal: (goalId: string) => void }) {
  const data = useCalendar(projectId, roadmap);
  const [view, setViewState] = useState<CalendarView>(() => stored("progressor.calendar-view", "month", ["month", "week", "day", "list"] as const));
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<CalendarKind>>(() => new Set(readHidden()));
  const [picked, setPicked] = useState<CalendarEvent>();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const today = startOfDay(now);
  const setView = (v: CalendarView) => {
    setViewState(v);
    store("progressor.calendar-view", v);
  };
  const toggle = (k: CalendarKind) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setHidden(next);
    store("progressor.calendar-hidden", [...next].join(","));
  };
  const all = data?.events ?? [];
  const events = useMemo(() => all.filter((e) => !hidden.has(e.kind)), [all, hidden]);
  const present = useMemo(() => new Set(all.map((e) => e.kind)), [all]);
  const openDay = (d: Date) => {
    setAnchor(startOfDay(d));
    setView("day");
  };
  // Keyboard, as in desktop calendars: t today, m/w/d/l the views, arrows back and forward.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) return setView(v.view);
      if (e.key === "t") return setAnchor(startOfDay(new Date()));
      if (e.key === "ArrowLeft" || e.key === "j") return setAnchor((a) => step(view, a, -1));
      if (e.key === "ArrowRight" || e.key === "k") return setAnchor((a) => step(view, a, 1));
      if (e.key === "Escape") setPicked(undefined);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const days = viewDays(view, anchor);
  const inView = events.filter((e) => days.some((d) => onDay(e, d))).length;
  const showingToday = days.some((d) => sameDay(d, today));
  return (
    <div className="page wide calendar-page">
      <div className="cal-top">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">What your AI did and what comes next, by date. It fills itself as your AI works; ahead of today it shows the steps planned next, when each goal should be done, and goals that come back.</p>
        </div>
      </div>
      <div className="cal-bar">
        <div className="cal-nav">
          <button className="btn ghost small" onClick={() => setAnchor(startOfDay(new Date()))} disabled={showingToday && view !== "list"} title="Go to today (T)">Today</button>
          <button className="iconbtn" onClick={() => setAnchor((a) => step(view, a, -1))} aria-label="Back" title="Back (←)"><Icon name="chevronLeft" size={18} /></button>
          <button className="iconbtn" onClick={() => setAnchor((a) => step(view, a, 1))} aria-label="Forward" title="Forward (→)"><Icon name="chevronRight" size={18} /></button>
          <h2 className="cal-title" aria-live="polite">{viewTitle(view, anchor)}</h2>
        </div>
        <div className="cal-views" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.view} role="tab" aria-selected={view === v.view} onClick={() => setView(v.view)} title={`${v.label} (${v.key.toUpperCase()})`}>{v.label}</button>
          ))}
        </div>
      </div>
      <div className="cal-key" aria-label="Show or hide each kind">
        {KINDS.filter((k) => present.has(k.kind)).map((k) => (
          <button key={k.kind} className={`cal-key-item k-${k.kind}`} aria-pressed={!hidden.has(k.kind)} onClick={() => toggle(k.kind)}>
            <i aria-hidden="true" />{k.label}
          </button>
        ))}
      </div>
      {data === undefined ? (
        <p className="quiet">Loading…</p>
      ) : data === null ? (
        <p className="quiet">The calendar could not be loaded. It tries again when the plan changes.</p>
      ) : (
        <div className="cal-body">
          {view === "month" ? (
            <Month anchor={anchor} today={today} events={events} picked={picked?.id} onPick={setPicked} onDay={openDay} />
          ) : view === "list" ? (
            <List days={days} today={today} events={events} picked={picked?.id} onPick={setPicked} />
          ) : (
            <TimeGrid days={days} today={today} now={now} events={events} picked={picked?.id} onPick={setPicked} onDay={openDay} />
          )}
          {!all.length ? (
            <p className="cal-empty">Nothing dated yet. As your AI finishes steps, they show up here by themselves.</p>
          ) : inView === 0 && view !== "list" ? (
            <p className="cal-note">Nothing in this {view}. {hidden.size ? "Some kinds are hidden above." : ""}</p>
          ) : null}
        </div>
      )}
      {picked && (
        <aside className={`cal-peek k-${picked.kind}`} aria-label="Event">
          <div className="cal-peek-head">
            <span className="cal-peek-kind"><i aria-hidden="true" />{kindLabel(picked.kind)}</span>
            <button className="iconbtn" aria-label="Close" onClick={() => setPicked(undefined)}><Icon name="close" size={16} /></button>
          </div>
          <h3>{picked.title}</h3>
          <p className="cal-peek-when">{when(picked)}</p>
          {picked.detail && <p>{picked.detail}</p>}
          {picked.goalTitle && picked.goalTitle !== picked.title && <p>Goal: <b>{picked.goalTitle}</b></p>}
          <div className="cal-peek-actions">
            {picked.goal && roadmap.goals.some((g) => g.id === picked.goal) && (
              <button className="btn small" onClick={() => onOpenGoal(picked.goal!)}>Open the goal</button>
            )}
            <button className="btn ghost small" onClick={() => { openDay(new Date(picked.start)); }}>Show the day</button>
          </div>
        </aside>
      )}
    </div>
  );
}

function readHidden(): CalendarKind[] {
  try {
    const v = localStorage.getItem("progressor.calendar-hidden");
    return v ? (v.split(",").filter((k) => KINDS.some((x) => x.kind === k)) as CalendarKind[]) : [];
  } catch {
    return [];
  }
}
