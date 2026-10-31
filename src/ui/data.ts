import { useCallback, useEffect, useRef, useState } from "react";
import type { AllStatsView, GoalView, InfoView, OverviewView, RoadmapView, SearchView, ServersView, StatsView } from "../dashboard/http.js";
import type { ProjectEntry, WorkspaceEntry } from "../dashboard/registry.js";
import { newestOnly, sharedEvents } from "./liveEvents.js";
import { type Staleness, pageStaleness } from "./stale.js";

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
    const load = () =>
      getJson<OverviewView>("/api/overview")
        .then((o) => alive && setOverview(o ?? []))
        .catch(() => undefined);
    void load();
    const stop = live.on({ projects: () => void load(), change: () => void load() });
    return () => {
      alive = false;
      stop();
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

/** Sends one of the person's changes to the project notes; says what went wrong in words when refused. */
async function postNotes(projectId: string, path: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/${path}`, {
    method: "POST",
    headers: { "x-progressor": "notes", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`);
}

/** Adds a rule for the AI; a hard one must never be broken. */
export const addRule = (projectId: string, text: string, hard: boolean) => postNotes(projectId, "rules", { text, hard });

/** Rewords a rule or changes whether it must never be broken. */
export const changeRule = (projectId: string, id: string, text: string, hard: boolean) =>
  postNotes(projectId, `rules/${encodeURIComponent(id)}`, { text, hard });

/** Removes a rule. */
export const removeRule = (projectId: string, id: string) => postNotes(projectId, `rules/${encodeURIComponent(id)}/delete`, {});

/** Replaces the About this project text (the Important context). */
export const saveContext = (projectId: string, text: string) => postNotes(projectId, "context", { text });

/** Adds a wish to the project's wishlist. */
export const addWish = (projectId: string, text: string) => postNotes(projectId, "wishes", { text });

/** Rewords a wish, or ticks it off (granted) or back. */
export const changeWish = (projectId: string, id: string, change: { text?: string; granted?: boolean }) =>
  postNotes(projectId, `wishes/${encodeURIComponent(id)}`, change);

/** Removes a wish. */
export const removeWish = (projectId: string, id: string) => postNotes(projectId, `wishes/${encodeURIComponent(id)}/delete`, {});

/** Search results for what is typed, fetched a moment after typing stops; undefined while searching. */
export function useSearch(query: string): SearchView | undefined {
  const [hits, setHits] = useState<{ query: string; hits: SearchView }>();
  const q = query.trim();
  useEffect(() => {
    if (!q) return;
    let alive = true;
    const timer = setTimeout(() => {
      getJson<SearchView>(`/api/search?q=${encodeURIComponent(q)}`)
        .then((h) => alive && setHits({ query: q, hits: h ?? [] }))
        .catch(() => alive && setHits({ query: q, hits: [] }));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
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
