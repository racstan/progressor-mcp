import { useCallback, useEffect, useRef, useState } from "react";
import type { GoalView, InfoView, RoadmapView } from "../dashboard/http.js";
import type { ProjectEntry } from "../dashboard/registry.js";

export type { GoalView, InfoView, ProjectEntry, RoadmapView };
export type Connection = "connecting" | "live" | "reconnecting";

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
  const [roadmap, setRoadmap] = useState<RoadmapView | null>();
  const [goal, setGoal] = useState<GoalView | null>();
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string>();
  const selection = useRef({ projectId, goalId });
  selection.current = { projectId, goalId };

  const loadProjects = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([getJson<InfoView>("/api/info"), getJson<ProjectEntry[]>("/api/projects")]);
      setInfo(i);
      setProjects(p ?? []);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadProject = useCallback(async () => {
    const { projectId: id, goalId: goal } = selection.current;
    if (!id) return;
    try {
      const base = `/api/projects/${encodeURIComponent(id)}`;
      const r = await getJson<RoadmapView>(`${base}/roadmap`);
      if (selection.current.projectId !== id) return; // the Developer switched project meanwhile
      setRoadmap(r ?? null);
      const g = r && goal ? await getJson<GoalView>(`${base}/goals/${encodeURIComponent(goal)}`) : undefined;
      if (selection.current.projectId === id) setGoal(g ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

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

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onopen = () => {
      setConnection("live");
      // catch up on anything missed while disconnected
      void loadProjects();
      void loadProject();
    };
    events.onerror = () => setConnection("reconnecting");
    events.addEventListener("projects", () => void loadProjects());
    events.addEventListener("change", (e) => {
      const { project } = JSON.parse((e as MessageEvent<string>).data) as { project: string };
      if (project === selection.current.projectId) void loadProject();
    });
    return () => events.close();
  }, [loadProjects, loadProject]);

  return { info, projects, roadmap, goal, connection, error };
}

const readJson = <T,>(key: string | undefined): T | undefined => {
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
