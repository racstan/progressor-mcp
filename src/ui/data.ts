import { useCallback, useEffect, useRef, useState } from "react";
import type { GoalView, InfoView, RoadmapView } from "../dashboard/http.js";

export type { GoalView, InfoView, RoadmapView };
export type Connection = "connecting" | "live" | "reconnecting";

async function getJson<T>(path: string): Promise<T | undefined> {
  const res = await fetch(path, { cache: "no-store" });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * The progress record as the page sees it: the project, the Roadmap and the selected Goal's map.
 * Everything is fetched again whenever the server reports that a file under .progressor/ changed.
 */
export function useProgress(goalId: string | undefined) {
  const [info, setInfo] = useState<InfoView>();
  const [roadmap, setRoadmap] = useState<RoadmapView>();
  const [goal, setGoal] = useState<GoalView | null>();
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string>();
  const goalRef = useRef(goalId);
  goalRef.current = goalId;

  const load = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([getJson<InfoView>("/api/info"), getJson<RoadmapView>("/api/roadmap")]);
      setInfo(i);
      setRoadmap(r);
      const id = goalRef.current;
      setGoal(id ? ((await getJson<GoalView>(`/api/goals/${encodeURIComponent(id)}`)) ?? null) : null);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, goalId]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onopen = () => {
      setConnection("live");
      void load(); // catch up on anything missed while disconnected
    };
    events.onerror = () => setConnection("reconnecting");
    events.addEventListener("change", () => void load());
    return () => events.close();
  }, [load]);

  return { info, roadmap, goal, connection, error };
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
