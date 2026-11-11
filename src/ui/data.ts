import { useCallback, useEffect, useRef, useState } from "react";
import type { AllStatsView, GoalView, InfoView, OverviewView, RoadmapView, SearchView, ServersView, StatsView } from "../dashboard/http.js";
import type { CalendarEvent } from "../calendar.js";
import type { ProjectEntry, WorkspaceEntry } from "../dashboard/registry.js";
import type { SettingsView } from "../dashboard/routes/settings.js";
import type { DiffLine, FileChange, HistoryItem } from "../history.js";
import { newestOnly, sharedEvents } from "./liveEvents.js";
import { type Staleness, pageStaleness } from "./stale.js";
import { PASS, onSampleSwitch, sampleAnswer, sampleOn } from "./sample.js";

export type { SettingsView };
export type { AllStatsView, GoalView, InfoView, OverviewView, ProjectEntry, RoadmapView, SearchView, ServersView, StatsView, WorkspaceEntry };
export type Connection = "connecting" | "live" | "reconnecting";

/** The page's one live connection to the server (liveEvents.ts). */
const live = sharedEvents("/api/events");
// A tab in the background lets go of its connection, so many open tabs cannot use up the browser's
// few connections to the dashboard; shown again, it reconnects and catches up.
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? live.pause() : live.resume()));
/** How often the plan is looked at again while the tab is shown, for what no change notice reports. */
const POLL_MS = 15_000;
/** How often the page asks which build is served, to notice a newer Progressor. */
const INFO_MS = 60_000;

async function getJson<T>(path: string): Promise<T | undefined> {
  // While the tour's sample shows, it answers the reads about projects itself (sample.ts).
  if (sampleOn()) {
    const answer = sampleAnswer(path);
    if (answer !== PASS) return answer as T | undefined;
  }
  const res = await fetch(path, { cache: "no-store" });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * What the page shows: the registered projects, and for the selected project its Roadmap and the
 * selected Goal's map. Everything is fetched again when the server reports a change: to the list
 * of projects, or to a file under the selected project's .progressor/.
 */
export function useDashboard(projectId: string | undefined, goalId: string | undefined) {
  const [info, setInfo] = useState<InfoView>();
  const [projects, setProjects] = useState<ProjectEntry[]>();
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>();
  const [roadmap, setRoadmap] = useState<RoadmapView | null>();
  const [goal, setGoal] = useState<GoalView | null>();
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string>();
  const selection = useRef({ projectId, goalId });
  selection.current = { projectId, goalId };
  // Loads overlap (a change notice, the timer, a click); an older answer arriving late is dropped.
  const projectsLoad = useRef(newestOnly()).current;
  const projectLoad = useRef(newestOnly()).current;

  const loadProjects = useCallback(async () => {
    const newest = projectsLoad();
    try {
      const [i, p, w] = await Promise.all([
        getJson<InfoView>("/api/info"),
        getJson<ProjectEntry[]>("/api/projects"),
        getJson<WorkspaceEntry[]>("/api/workspaces"),
      ]);
      if (!newest()) return;
      setInfo(i);
      setProjects(p ?? []);
      setWorkspaces(w ?? []);
      setError(undefined);
    } catch (e) {
      if (newest()) setError((e as Error).message);
    }
  }, [projectsLoad]);

  const loadProject = useCallback(async () => {
    const { projectId: id, goalId: goal } = selection.current;
    if (!id) return;
    const newest = projectLoad();
    try {
      const base = `/api/projects/${encodeURIComponent(id)}`;
      // Both are fetched before either is shown, so the roadmap and the goal never come from different moments.
      const [r, g] = await Promise.all([
        getJson<RoadmapView>(`${base}/roadmap`),
        goal ? getJson<GoalView>(`${base}/goals/${encodeURIComponent(goal)}`) : undefined,
      ]);
      // a newer load started meanwhile, or the person picked another project or goal
      if (!newest() || selection.current.projectId !== id || selection.current.goalId !== goal) return;
      setRoadmap(r ?? null);
      setGoal(r && g ? g : null);
      setError(undefined);
    } catch (e) {
      if (newest()) setError((e as Error).message);
    }
  }, [projectLoad]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // The tour's sample shown or put away: everything comes from somewhere else now.
  useEffect(
    () =>
      onSampleSwitch(() => {
        setRoadmap(undefined);
        setGoal(undefined);
        void loadProjects();
        void loadProject();
      }),
    [loadProjects, loadProject],
  );

  useEffect(() => {
    setRoadmap(undefined);
    setGoal(undefined);
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject, projectId, goalId]);

  useEffect(
    () =>
      live.on({
        open: () => {
          setConnection("live");
          // catch up on anything missed while disconnected
          void loadProjects();
          void loadProject();
        },
        error: () => setConnection("reconnecting"),
        projects: () => void loadProjects(),
        change: (e) => {
          let project: string | undefined;
          try {
            project = (JSON.parse(e.data) as { project?: string }).project;
          } catch {
            return; // a notice that cannot be read changes nothing
          }
          if (project === selection.current.projectId) void loadProject();
        },
      }),
    [loadProjects, loadProject],
  );

  // Locks on shared resources are kept outside .progressor/ (so no change event says they moved), and
  // their times run on: look again every so often while the tab is shown (shown again, it catches up
  // as it reconnects).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadProject();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadProject]);

  // A newer Progressor may serve the page with no change notice (a rebuild, or a newer hub taking over).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadProjects();
    }, INFO_MS);
    return () => clearInterval(timer);
  }, [loadProjects]);

  // The Refresh button: load everything again now, instead of waiting for the next change.
  const refresh = useCallback(() => {
    void loadProjects();
    void loadProject();
  }, [loadProjects, loadProject]);

  return { info, projects, workspaces, roadmap, goal, connection, error, refresh };
}

/** Every project's Goals for the overview page, fetched again whenever any project changes. */
export function useOverview(enabled: boolean): OverviewView | undefined {
  const [overview, setOverview] = useState<OverviewView>();
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      const sample = sampleOn();
      // an answer from before the sample was shown or put away is dropped
      return getJson<OverviewView>("/api/overview")
        .then((o) => alive && sample === sampleOn() && setOverview(o ?? []))
        .catch(() => undefined);
    };
    void load();
    const stop = live.on({ projects: () => void load(), change: () => void load() });
    const unSample = onSampleSwitch(() => void load());
    return () => {
      alive = false;
      stop();
      unSample();
    };
  }, [enabled]);
  return overview;
}

export const readJson = <T,>(key: string | undefined): T | undefined => {
  try {
    const text = key ? localStorage.getItem(key) : null;
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A JSON value kept in localStorage under a key that can change (one per project), such as the
 * Goals this browser hid. Also says whether anything was stored yet.
 */
export function useStoredJson<T>(key: string | undefined, fallback: T): [T, (v: T) => void, boolean] {
  const [state, setState] = useState(() => ({ key, value: readJson<T>(key) }));
  const value = state.key === key ? state.value : readJson<T>(key);
  if (state.key !== key) setState({ key, value });
  const set = useCallback(
    (v: T) => {
      setState({ key, value: v });
      try {
        if (key) localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // storage can be unavailable (private windows); the choice then lasts for this page only
      }
    },
    [key],
  );
  return [value ?? fallback, set, value !== undefined];
}

/** A value kept in localStorage, for per-browser conveniences (theme, sidebar, editor). */
export function useStored<T extends string>(key: string, initial: T | undefined): [T | undefined, (v: T | undefined) => void] {
  const [value, setValue] = useState<T | undefined>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T | undefined) => {
      setValue(v);
      try {
        if (v === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, v);
      } catch {
        // storage can be unavailable (private windows); the choice then lasts for this page only
      }
    },
    [key],
  );
  return [value, set];
}

/**
 * The running Progressor processes, polled every few seconds (and right away on `reload`).
 * "unsupported" when the process serving the dashboard is a Progressor from before the list existed.
 */
export function useServers(): [ServersView | "unsupported" | undefined, () => void] {
  const [servers, setServers] = useState<ServersView | "unsupported">();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getJson<ServersView>("/api/servers")
        .then((s) => alive && setServers(s ?? "unsupported"))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tick]);
  return [servers, useCallback(() => setTick((t) => t + 1), [])];
}

/** Asks a running server to stop. The header tells the dashboard the request comes from its own page. */
export async function stopServer(pid: number): Promise<void> {
  const res = await fetch(`/api/servers/${pid}/stop`, { method: "POST", headers: { "x-progressor": "stop" } });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `${res.status}`);
}

/** What the Developer can mark a thing to try by hand as; "clear" undoes the mark. */
export type HandMark = "works" | "doesn't work" | "won't test" | "clear";

/**
 * Marks a thing to try by hand. The header tells the server the request comes from the dashboard's
 * own page. Says what went wrong in words when the server refuses.
 */
export async function markHandTest(projectId: string, goalId: string, itemId: string, mark: HandMark, note?: string): Promise<void> {
  const path = `/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goalId)}/hand-tests/${encodeURIComponent(itemId)}`;
  const res = await fetch(path, {
    method: "POST",
    headers: { "x-progressor": "mark", "content-type": "application/json" },
    body: JSON.stringify({ mark, ...(note ? { note } : {}) }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** Opens the system's file manager at a file of the project (a plan file, or one a step changed). */
export async function showInFolder(projectId: string, path: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/reveal`, {
    method: "POST",
    headers: { "x-progressor": "reveal", "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** Sends one of the person's changes about talking with their AI; says what went wrong in words when refused. */
async function postTalk(projectId: string, goalId: string, path: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goalId)}/${path}`, {
    method: "POST",
    headers: { "x-progressor": "talk", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** A message to the AI working on a goal. */
export const sendMessage = (projectId: string, goalId: string, text: string) => postTalk(projectId, goalId, "messages", { text });

/** Takes back a message the AI has not read yet. */
export const takeBackMessage = (projectId: string, goalId: string, id: string) =>
  postTalk(projectId, goalId, `messages/${encodeURIComponent(id)}/delete`, {});

/** Answers one of the AI's questions: a choice, or the person's own words. */
export const answerQuestion = (projectId: string, goalId: string, id: string, answer: string) =>
  postTalk(projectId, goalId, `questions/${encodeURIComponent(id)}/answer`, { answer });
/** Asks the AI for other options than the alternatives it offered. */
export const requestMoreAlternatives = (projectId: string, goalId: string, id: string) =>
  postTalk(projectId, goalId, `questions/${encodeURIComponent(id)}/more`, {});

/** Sends one of the person's changes to the project notes; says what went wrong in words when refused. */
async function postNotes(projectId: string, path: string, body: unknown): Promise<void> {
  await postNotesAnswer(projectId, path, body);
}

/** Like postNotes, and gives what the server answered. */
async function postNotesAnswer(projectId: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/${path}`, {
    method: "POST",
    headers: { "x-progressor": "notes", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((answer as { error?: string }).error ?? `The server answered ${res.status}.`);
  return answer;
}

/** Adds a rule for the AI; a hard one must never be broken. */
export const addRule = (projectId: string, text: string, hard: boolean) => postNotes(projectId, "rules", { text, hard });

/** Rewords a rule or changes whether it must never be broken. */
export const changeRule = (projectId: string, id: string, text: string, hard: boolean) =>
  postNotes(projectId, `rules/${encodeURIComponent(id)}`, { text, hard });

/** Removes a rule. */
export const removeRule = (projectId: string, id: string) => postNotes(projectId, `rules/${encodeURIComponent(id)}/delete`, {});

/** Adds a hotfix: a bug report the AI fixes before any other work. */
export const addHotfix = async (projectId: string, report: string, title?: string) =>
  (await postNotesAnswer(projectId, "hotfixes", { text: report, ...(title?.trim() ? { title } : {}) })) as { id: string };

/** Replaces the About this project text (the Important context). */
export const saveContext = (projectId: string, text: string) => postNotes(projectId, "context", { text });

/** Adds a wish to the project's wishlist. */
export const addWish = async (projectId: string, text: string) => (await postNotesAnswer(projectId, "wishes", { text })) as { id: string };

/** Rewords a wish, or ticks it off (granted) or back. */
export const changeWish = async (projectId: string, id: string, change: { text?: string; granted?: boolean }): Promise<void> => {
  await postNotes(projectId, `wishes/${encodeURIComponent(id)}`, change);
};

/** Removes a wish, with the files attached to it. */
export const removeWish = async (projectId: string, id: string): Promise<void> => {
  await postNotes(projectId, `wishes/${encodeURIComponent(id)}/delete`, {});
};

/** Attaches a file (an image, a PDF, anything) to a wish; the server keeps it and tells the AI only where it is. */
export async function attachFile(projectId: string, wishId: string, file: File): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/wishes/${encodeURIComponent(wishId)}/attachments`, {
    method: "POST",
    headers: { "x-progressor": "notes", "x-file-name": encodeURIComponent(file.name), "content-type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`${file.name}: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? `the server answered ${res.status}.`}`);
}

/** Takes a file off a wish. */
export const removeAttachment = async (projectId: string, wishId: string, file: string): Promise<void> => {
  await postNotes(projectId, `wishes/${encodeURIComponent(wishId)}/attachments/${encodeURIComponent(file)}/delete`, {});
};

/** Where a wish's attached file is shown or downloaded from. */
export const attachmentUrl = (projectId: string, wishId: string, file: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/wishes/${encodeURIComponent(wishId)}/attachments/${encodeURIComponent(file)}`;

/**
 * Search results for what is typed, fetched once typing pauses (150ms); a request for something no
 * longer typed is cancelled. Undefined while searching.
 */
export function useSearch(query: string): SearchView | undefined {
  const [hits, setHits] = useState<{ query: string; hits: SearchView }>();
  const q = query.trim();
  useEffect(() => {
    if (!q) return;
    const stop = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: stop.signal })
        .then((res) => (res.ok ? (res.json() as Promise<SearchView>) : []))
        .then((h) => setHits({ query: q, hits: h ?? [] }))
        .catch(() => !stop.signal.aborted && setHits({ query: q, hits: [] }));
    }, 150);
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [q]);
  return hits?.query === q ? hits.hits : undefined;
}

/**
 * Whether the page may be out of date (stale.ts): the build it was opened with against the one served
 * now, and since when it has been out of touch while shown.
 */
export function usePageStaleness(info: InfoView | undefined, connection: Connection): Staleness | undefined {
  const opened = useRef<string | undefined>(undefined);
  if (!opened.current && info?.build) opened.current = info.build;
  const [lostSince, setLostSince] = useState<number>();
  useEffect(() => {
    if (connection === "reconnecting") setLostSince((t) => t ?? Date.now());
    else setLostSince(undefined);
  }, [connection]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return pageStaleness({ openedWith: opened.current, serverBuild: info?.build, lostSince, now });
}

/**
 * A project's statistics, fetched again whenever `version` changes (the page passes the roadmap it
 * shows, which is loaded again on every change); undefined while loading, null when it failed.
 */
export function useStats(projectId: string, version: unknown): StatsView | null | undefined {
  return useStatsAt<StatsView>(`/api/projects/${encodeURIComponent(projectId)}/stats`, version);
}

/** Every project's statistics added up, for Home; fetched again whenever `version` (the overview Home shows) changes. */
export function useAllStats(version: unknown): AllStatsView | null | undefined {
  return useStatsAt<AllStatsView>("/api/stats", version);
}

function useStatsAt<T>(path: string, version: unknown): T | null | undefined {
  const [stats, setStats] = useState<{ path: string; stats: T | null }>();
  useEffect(() => {
    let alive = true;
    getJson<T>(path)
      .then((s) => alive && setStats({ path, stats: s ?? null }))
      .catch(() => alive && setStats({ path, stats: null }));
    return () => {
      alive = false;
    };
  }, [path, version]);
  return stats?.path === path ? stats.stats : undefined;
}

/** Sends a change to the settings for how Progressor works; says what went wrong in words when refused. */
async function postSettings(path: string, body: unknown): Promise<SettingsView> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "x-progressor": "settings", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await res.json().catch(() => ({}))) as SettingsView & { error?: string };
  if (!res.ok) throw new Error(answer.error ?? `The server answered ${res.status}.`);
  return answer;
}

/** Changes one section of the settings, for every project or, with projectId, for that project only. */
export const saveSettings = (section: string, values: Record<string, unknown>, projectId?: string) =>
  postSettings("/api/settings", { section, values, project: projectId });

/** Gives phone notifications a new private topic, for every project. */
export async function renewPhoneTopic(): Promise<SettingsView> {
  const res = await fetch("/api/settings/ntfy/new-topic", { method: "POST", headers: { "x-progressor": "ntfy" } });
  const answer = (await res.json().catch(() => ({}))) as SettingsView & { error?: string };
  if (!res.ok) throw new Error(answer.error ?? `The server answered ${res.status}.`);
  return answer;
}

/** Puts one section, or every section when none is named, back to its defaults. */
export const resetComputerSettings = (section?: string, projectId?: string) => postSettings("/api/settings/reset", { section, project: projectId });

/**
 * The settings for how Progressor works (settings.ts), as they are for the project shown, fetched
 * again when any page changes them. Undefined until loaded, and null when the hub is older and has none.
 */
export function useSettings(projectId: string | undefined): [SettingsView | null | undefined, (view: SettingsView) => void] {
  const [view, setView] = useState<SettingsView | null>();
  useEffect(() => {
    let alive = true;
    const load = () =>
      getJson<SettingsView>(`/api/settings${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`)
        .then((v) => alive && setView(v ?? null))
        .catch(() => undefined);
    void load();
    const stop = live.on({ settings: () => void load() });
    return () => {
      alive = false;
      stop();
    };
  }, [projectId]);
  return [view, setView];
}

// --- rules and context for every project ---

/** The rules and context for every project (globalRules.ts), as GET /api/global answers. */
export interface GlobalView {
  rules: { id: string; text: string; hard: boolean }[];
  context: string;
}

/**
 * The rules and context for every project, fetched again when they change (the "global" event).
 * Undefined while loading; null when the hub is older and has none, or while the tour's sample shows.
 */
export function useGlobal(): [GlobalView | null | undefined, () => void] {
  const [view, setView] = useState<GlobalView | null>();
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (sampleOn()) return void setView(null);
      getJson<GlobalView>("/api/global")
        .then((v) => alive && setView(v ?? null))
        .catch(() => alive && setView(null));
    };
    load();
    const stop = live.on({ global: () => load() });
    const unswitch = onSampleSwitch(load);
    return () => {
      alive = false;
      stop();
      unswitch();
    };
  }, [asked]);
  return [view, () => setAsked((n) => n + 1)];
}

async function postGlobal(path: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/global/${path}`, {
    method: "POST",
    headers: { "x-progressor": "global", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

export const addGlobalRule = (text: string, hard: boolean) => postGlobal("rules", { text, hard });
export const changeGlobalRule = (id: string, text: string, hard: boolean) => postGlobal(`rules/${encodeURIComponent(id)}`, { text, hard });
export const removeGlobalRule = (id: string) => postGlobal(`rules/${encodeURIComponent(id)}/delete`, {});
export const saveGlobalContext = (text: string) => postGlobal("context", { text });

/** Takes a project off the dashboard; its folder and plan are not touched (registry.ts). */
export async function removeProjectFromDashboard(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/remove`, {
    method: "POST",
    headers: { "x-progressor": "remove-project", "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

// --- history ---

/** The plan's history as GET /api/projects/:id/history answers it: newest first. */
export interface HistoryView {
  enabled: boolean;
  entries: HistoryItem[];
}
export type { DiffLine, FileChange, HistoryItem };

/**
 * A project's history, fetched again whenever `version` changes (the page passes the roadmap it
 * shows, loaded again on every change) or a setting changes; undefined while loading, null when it failed.
 */
export function useHistory(projectId: string, version: unknown): [HistoryView | null | undefined, () => void] {
  const path = `/api/projects/${encodeURIComponent(projectId)}/history`;
  const [view, setView] = useState<{ path: string; view: HistoryView | null }>();
  const [asked, setAsked] = useState(0);
  useEffect(() => live.on({ settings: () => setAsked((n) => n + 1) }), []);
  useEffect(() => {
    let alive = true;
    getJson<HistoryView>(path)
      .then((v) => alive && setView({ path, view: v ?? null }))
      .catch(() => alive && setView({ path, view: null }));
    return () => {
      alive = false;
    };
  }, [path, version, asked]);
  return [view?.path === path ? view.view : undefined, () => setAsked((n) => n + 1)];
}

/** The last plan check-up (checkup.ts); null when none ran yet. */
export type CheckupView = { at: string; findings: { kind: string; file: string; text: string; fixed: boolean }[] };
export const getCheckup = async (projectId: string) =>
  (await getJson<{ last: CheckupView | null }>(`/api/projects/${encodeURIComponent(projectId)}/checkup`))?.last ?? null;
/** Runs the check-up now; says what went wrong in words when refused. */
export async function runCheckup(projectId: string): Promise<CheckupView> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/checkup`, {
    method: "POST",
    headers: { "x-progressor": "checkup", "content-type": "application/json" },
    body: "{}",
  });
  const answer = (await res.json().catch(() => ({}))) as { last?: CheckupView; error?: string };
  if (!res.ok || !answer.last) throw new Error(answer.error ?? `The server answered ${res.status}.`);
  return answer.last;
}

/** A routine that brings a goal back (routines.ts), with its pace in words. */
export type RoutineView = { id: string; title: string; every: string; words: string; next?: string; outcome?: string; steps: string[]; lastGoal?: string; paused: boolean };
/** A project's routines, fetched again whenever `version` changes; undefined while loading or when the server is too old. */
export function useRoutines(projectId: string, version: unknown): [RoutineView[] | undefined, () => void] {
  const [list, setList] = useState<RoutineView[]>();
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let live = true;
    getJson<{ routines: RoutineView[] }>(`/api/projects/${encodeURIComponent(projectId)}/routines`)
      .then((r) => live && setList(r?.routines))
      .catch(() => live && setList(undefined));
    return () => {
      live = false;
    };
  }, [projectId, version, asked]);
  return [list, () => setAsked((n) => n + 1)];
}
/** Pauses, resumes or stops a routine; says what went wrong in words when refused. */
export async function changeRoutine(projectId: string, id: string, action: "pause" | "resume" | "stop"): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/routines/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "x-progressor": "routines", "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** What one change did, file by file. */
export const historyChanges = (projectId: string, id: string) =>
  getJson<{ item: HistoryItem; files: FileChange[] }>(`/api/projects/${encodeURIComponent(projectId)}/history/${encodeURIComponent(id)}`);

/** Goes back to before a change; says what went wrong in words when refused. */
export async function goBackInHistory(projectId: string, id: string): Promise<{ files: string[] }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/history/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: { "x-progressor": "history", "content-type": "application/json" },
    body: "{}",
  });
  const answer = (await res.json().catch(() => ({}))) as { files?: string[]; error?: string };
  if (!res.ok) throw new Error(answer.error ?? `The server answered ${res.status}.`);
  return { files: answer.files ?? [] };
}

// --- handoffs ---
// Handoffs (handoff.ts): write-ups your AI saves for whoever picks the work up next.

/** One saved handoff as GET /api/projects/:id/handoffs lists it. */
export interface HandoffSummary {
  file: string;
  title: string;
  range?: string;
  commits?: number;
  written?: string;
}

/** A project's handoffs, newest first, fetched again whenever `version` changes. */
export function useHandoffs(projectId: string, version: unknown): HandoffSummary[] | null | undefined {
  const path = `/api/projects/${encodeURIComponent(projectId)}/handoffs`;
  const [view, setView] = useState<{ path: string; list: HandoffSummary[] | null }>();
  useEffect(() => {
    let alive = true;
    getJson<HandoffSummary[]>(path)
      .then((list) => alive && setView({ path, list: list ?? null }))
      .catch(() => alive && setView({ path, list: null }));
    return () => {
      alive = false;
    };
  }, [path, version]);
  return view?.path === path ? view.list : undefined;
}

/** One handoff's markdown. */
export const getHandoff = async (projectId: string, file: string) =>
  (await getJson<{ text: string }>(`/api/projects/${encodeURIComponent(projectId)}/handoffs/${encodeURIComponent(file)}`))?.text;

/** Asks your AI for a handoff of some dates or the last commits; says what went wrong in words when refused. */
export async function askForHandoff(projectId: string, range: { since?: string; until?: string; last?: number }): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/handoffs/request`, {
    method: "POST",
    headers: { "x-progressor": "handoffs", "content-type": "application/json" },
    body: JSON.stringify(range),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** The project's calendar (calendar.ts): every dated thing in its plan. Reloads when `version` changes. */
export function useCalendar(projectId: string, version: unknown): { now: string; events: CalendarEvent[] } | null | undefined {
  const path = `/api/projects/${encodeURIComponent(projectId)}/calendar`;
  const [view, setView] = useState<{ path: string; data: { now: string; events: CalendarEvent[] } | null }>();
  useEffect(() => {
    let alive = true;
    getJson<{ now: string; events: CalendarEvent[] }>(path)
      .then((data) => alive && setView({ path, data: data ?? null }))
      .catch(() => alive && setView({ path, data: null }));
    return () => {
      alive = false;
    };
  }, [path, version]);
  return view?.path === path ? view.data : undefined;
}
