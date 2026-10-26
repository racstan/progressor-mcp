import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_EDITOR, EDITORS, editorUrl, parseCodeRef } from "../dashboard/editor.js";
import { type DetourNode, type GoalGraph, type TaskNode, withoutDetours, withoutDropped } from "../dashboard/graph.js";
import { type PromptSubject, copyAsPrompt } from "../dashboard/prompt.js";
import { type GoalView, type RoadmapView, useDashboard, useOverview, useSearch, useServers, useStored, useStoredJson } from "./data.js";
import { CONTEXT_HASH, contextBlocks, contextFromHash } from "./context.js";
import { Checklist } from "./Checklist.js";
import { type Finished, type Seen, doneMark, groupGoals, groupOpen, hideAll, seenOnFirstVisit } from "./goalList.js";
import { MetroMap } from "./MetroMap.js";
import { Overview } from "./Overview.js";
import { describeSystem, ISSUES_URL, issueUrl } from "./feedback.js";
import { RichText } from "./RichText.js";
import { type SearchHit, SearchBox } from "./Search.js";
import { hardFirst } from "../roadmap.js";
import { ServersPanel } from "./Servers.js";
import { inlineCode, plainText } from "./text.js";
import { VIEWS, VIEW_LABELS, type View, pickView } from "./views.js";
import { sortProjects } from "./projectList.js";
import { GoalNotes } from "./GoalNotes.js";
import { StepKey, StepMark } from "./StepKey.js";
import { GOAL_WORD, SIDE_TRIP_HINT, STEP_HINT, STEP_WORD, countsLine, elsewhereTag, goalState, statusClass, statusLine, underWay } from "./words.js";

type Goal = RoadmapView["goals"][number];
type Theme = "light" | "dark" | "system";

const EDITOR_NAMES: Record<string, string> = {
  vscode: "VS Code",
  "vscode-insiders": "VS Code Insiders",
  vscodium: "VSCodium",
  cursor: "Cursor",
  windsurf: "Windsurf",
  zed: "Zed",
  jetbrains: "IntelliJ IDEA",
  idea: "IntelliJ IDEA",
  webstorm: "WebStorm",
  pycharm: "PyCharm",
  phpstorm: "PhpStorm",
  goland: "GoLand",
  rider: "Rider",
  rubymine: "RubyMine",
  clion: "CLion",
  rustrover: "RustRover",
};
const editorName = (e: string) => EDITOR_NAMES[e] ?? (e.includes("{") ? "your editor" : e);

/** What the map and the list show besides the plan's own steps; each person picks in the Show menu. */
interface Show {
  sideTrips: boolean;
  cancelled: boolean;
  files: boolean;
}
const SHOW_DEFAULT: Show = { sideTrips: true, cancelled: false, files: false };
const SHOW_OPTIONS: { key: keyof Show; label: string; hint: string }[] = [
  { key: "sideTrips", label: "Side trips", hint: "Times the AI stepped off the plan to deal with something, and how each one ended." },
  { key: "cancelled", label: "Cancelled steps", hint: "Steps the AI decided not to do, crossed out, with the reason when you click one." },
  { key: "files", label: "File names", hint: "The files each step changes, and buttons to open them in your code editor." },
];

/** The Goal shown first: one waiting on the Developer, else one being worked on, else a paused one, else the next planned one. */
function defaultGoal(goals: Goal[]): string | undefined {
  const waiting = goals.find((g) => g.waitingOnYou && (g.status === "active" || g.status === "paused"));
  if (waiting) return waiting.id;
  for (const status of ["active", "paused", "planned", "done"])
    for (const g of goals) if (g.status === status) return g.id;
  return goals[0]?.id;
}

const goalFromHash = () => {
  const m = /^#\/goal\/(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]!) : undefined;
};

function useToast() {
  const [message, setMessage] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(undefined), 2400);
  }, []);
  const node = (
    <div className={`toast ${message ? "show" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
  return [show, node] as const;
}

/** Light unless the Developer picked dark, or picked "match system" and the operating system is dark. */
const isDark = (theme: Theme | undefined) =>
  theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

const projectFromUrl = () => new URLSearchParams(location.search).get("project") ?? undefined;
const workspaceFromUrl = () => new URLSearchParams(location.search).get("workspace") ?? undefined;

/** Changes some of the address's parameters (project, view), keeping the others and the Goal in the hash. */
function setParams(changes: Record<string, string | undefined>, how: "push" | "replace" = "replace") {
  const params = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) params.delete(k);
    else params.set(k, v);
  }
  const url = `?${params.toString()}${how === "push" ? "" : location.hash}`;
  if (how === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

const VIEW_ICONS: Record<View, string> = { horizontal: "⇢", vertical: "⇣", checklist: "☰" };
const VIEW_SHORT: Record<View, string> = { horizontal: "Across", vertical: "Down", checklist: "List" };

export function App() {
  const [pickedProject, setPickedProject] = useState<string | undefined>(projectFromUrl);
  const [pickedWorkspace, setPickedWorkspace] = useState<string | undefined>(workspaceFromUrl);
  const [picked, setPicked] = useState<string | undefined>(goalFromHash);
  const [onContext, setOnContext] = useState(() => contextFromHash(location.hash));
  const [storedShow, setShow] = useStoredJson<Partial<Show>>("progressor.show", {});
  const show: Show = { ...SHOW_DEFAULT, ...storedShow };
  const detours = show.sideTrips;
  const [theme, setTheme] = useStored<Theme>("progressor.theme", undefined);
  const [collapsed, setCollapsed] = useStored<"1">("progressor.sidebar-collapsed", undefined);
  // The default view is a setting; the navbar's view buttons only change what this page shows.
  const [defaultView, setDefaultView] = useStored<View>("progressor.view", undefined);
  const [view, setView] = useState<View>(() => pickView(location.search, defaultView));
  const [finished, setFinished] = useStored<Finished>("progressor.finished", undefined);
  const [showHidden, setShowHidden] = useStored<"1">("progressor.show-hidden", undefined);
  const [doneOpen, setDoneOpen] = useStored<"1">("progressor.done-open", undefined);
  // The goal on screen when the Finished group was closed while it held that goal.
  const [doneClosedFor, setDoneClosedFor] = useState<string>();
  const chooseView = (v: View) => {
    setView(v);
    setSelected(undefined);
    setParams({ view: v === "horizontal" ? undefined : v });
  };
  useEffect(() => {
    // a view remembered by this browser goes into the address too, so the link shows the same thing
    if (view !== "horizontal" && !new URLSearchParams(location.search).get("view")) setParams({ view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editorChoice, setEditorChoice] = useStored<string>("progressor.editor", undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [servers, reloadServers] = useServers();
  const [query, setQuery] = useState("");
  const hits = useSearch(query);
  // A Task opened from the search: its popover opens once its Goal's map has loaded.
  const [pendingTask, setPendingTask] = useState<{ goal: string; task: string }>();
  const [goalMenu, setGoalMenu] = useState<{ id: string; at: { x: number; y: number } }>();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // What the popover shows, by ID, so it follows live updates to that item.
  const [selected, setSelected] = useState<{ key: string; at: { x: number; y: number } }>();
  const [toast, toastNode] = useToast();

  const [projectId, setProjectId] = useState<string | undefined>(pickedProject);
  const [goalId, setGoalId] = useState<string | undefined>(picked);
  const { info, projects, workspaces, roadmap, goal, connection, error, refresh } = useDashboard(projectId, goalId);
  const project = projects?.find((p) => p.id === projectId);
  // Without a project in the address: the only project, or the overview of them all (or of the
  // Workspace in the address). An unknown project is reported, never swapped.
  const showOverview = !pickedProject && !!projects && (projects.length > 1 || !!pickedWorkspace);
  const overview = useOverview(showOverview);
  const effectiveProject = pickedProject ?? (projects?.length === 1 && !pickedWorkspace ? projects[0]!.id : undefined);
  useEffect(() => {
    setProjectId(effectiveProject);
    // keep the shown project in the address, so a reload or a bookmark comes back to it
    if (effectiveProject && !projectFromUrl())
      setParams({ project: effectiveProject });
  }, [effectiveProject]);

  const goals = roadmap?.goals ?? [];
  // Hidden and seen Goals are this browser's view of one project.
  const [hidden, setHidden] = useStoredJson<string[]>(projectId && `progressor.hidden.${projectId}`, []);
  const [seen, setSeen, visited] = useStoredJson<Seen>(projectId && `progressor.seen.${projectId}`, {});
  const roadmapIsProjects = !!roadmap && roadmap.root === project?.root;
  useEffect(() => {
    if (roadmapIsProjects && !visited) setSeen(seenOnFirstVisit(goals));
  }, [roadmapIsProjects, visited, goals, setSeen]);
  const grouped = groupGoals(goals, { finished: finished ?? "review", seen: visited ? seen : seenOnFirstVisit(goals), hidden });
  // Without a pick, the Goal on screen stays on screen as the plan changes (a Goal that finishes
  // while you watch it does not jump to the next one); the default is chosen once per project.
  const shownBefore = useRef<{ project: string | undefined; goal: string | undefined }>({ project: undefined, goal: undefined });
  const kept = shownBefore.current.project === projectId ? shownBefore.current.goal : undefined;
  const effectiveGoal = picked && goals.some((g) => g.id === picked)
    ? picked
    : kept && goals.some((g) => g.id === kept)
      ? kept
      : defaultGoal([...grouped.open, ...grouped.done]) ?? goals[0]?.id;
  if (roadmapIsProjects) shownBefore.current = { project: projectId, goal: effectiveGoal };
  useEffect(() => setGoalId(effectiveGoal), [effectiveGoal]);
  const hideGoal = (id: string, hide: boolean) => {
    setHidden(hide ? [...hidden.filter((h) => h !== id), id] : hidden.filter((h) => h !== id));
    setGoalMenu(undefined);
    if (hide) toast("Hidden from this list; the plan is unchanged. Find it under Hidden, below your goals.");
  };
  const markSeen = (g: Goal) => {
    if (seen[g.id] !== doneMark(g)) setSeen({ ...seen, [g.id]: doneMark(g) });
  };

  const editor = editorChoice ?? info?.editor ?? DEFAULT_EDITOR;
  const shownGoal = goal && goal.goal.id === effectiveGoal ? goal : undefined;
  // Looking at a finished Goal is what the green dot asks for; after that it moves to Done.
  const shownListed = goals.find((g) => g.id === shownGoal?.goal.id);
  useEffect(() => {
    if (shownListed?.status === "done" && visited) markSeen(shownListed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownListed?.id, shownListed?.status, shownListed?.done, shownListed?.total, visited]);

  useEffect(() => {
    const onNavigate = () => {
      setPickedProject(projectFromUrl());
      setPickedWorkspace(workspaceFromUrl());
      setPicked(goalFromHash());
      setOnContext(contextFromHash(location.hash));
      setView(pickView(location.search, undefined));
    };
    addEventListener("hashchange", onNavigate);
    addEventListener("popstate", onNavigate);
    return () => {
      removeEventListener("hashchange", onNavigate);
      removeEventListener("popstate", onNavigate);
    };
  }, []);
  const closeDrawerOnNarrow = () => {
    if (matchMedia("(max-width: 720px)").matches) setCollapsed("1"); // the sidebar is a drawer over the map there
  };
  const pickGoal = (id: string) => {
    setSelected(undefined);
    history.replaceState(null, "", `${location.search}#/goal/${encodeURIComponent(id)}`);
    setPicked(id);
    setOnContext(false);
    closeDrawerOnNarrow();
  };
  const openContext = () => {
    setSelected(undefined);
    history.replaceState(null, "", `${location.search}${CONTEXT_HASH}`);
    setOnContext(true);
    closeDrawerOnNarrow();
  };
  const pickProject = (id: string, goalId?: string) => {
    setSelected(undefined);
    setSwitcherOpen(false);
    setMenuOpen(false);
    setParams({ project: id, workspace: undefined }, "push");
    if (goalId) history.replaceState(null, "", `${location.search}#/goal/${encodeURIComponent(goalId)}`);
    setPickedProject(id);
    setPicked(goalId);
    setOnContext(false);
    closeDrawerOnNarrow();
  };
  const showAll = () => {
    setSelected(undefined);
    setSwitcherOpen(false);
    setParams({ project: undefined, workspace: undefined }, "push");
    setPickedProject(undefined);
    setPickedWorkspace(undefined);
    setPicked(undefined);
    setOnContext(false);
  };

  const openHit = (hit: SearchHit) => {
    if (hit.kind === "project") return pickProject(hit.project.id);
    if (hit.kind === "goal") return pickProject(hit.project.id, hit.id);
    if (hit.kind === "task" && hit.goal && hit.id) {
      pickProject(hit.project.id, hit.goal.id);
      return setPendingTask({ goal: hit.goal.id, task: hit.id });
    }
    pickProject(hit.project.id);
  };
  useEffect(() => {
    if (!pendingTask || shownGoal?.goal.id !== pendingTask.goal) return;
    if (shownGoal.graph.nodes.some((n) => n.id === pendingTask.task))
      setSelected({ key: pendingTask.task, at: { x: innerWidth / 2, y: 180 } });
    setPendingTask(undefined);
  }, [pendingTask, shownGoal]);

  const [dark, setDark] = useState(() => isDark(theme));
  useLayoutEffect(() => {
    const apply = () => {
      setDark(isDark(theme));
      if (isDark(theme)) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
    };
    apply();
    if (theme !== "system") return;
    const system = matchMedia("(prefers-color-scheme: dark)");
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const where = showOverview ? (workspaces?.find((w) => w.id === pickedWorkspace)?.name ?? "All projects") : undefined;
    document.title = [shownGoal?.goal.title, project?.name, where, "Progressor"].filter(Boolean).join(" · ");
  }, [shownGoal, project, showOverview, workspaces, pickedWorkspace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        setSelected(undefined);
        setMenuOpen(false);
        setSettingsOpen(false);
        setShowOpen(false);
        setGoalMenu(undefined);
        setSwitcherOpen(false);
      }
      if (e.key === "[" && !e.ctrlKey && !e.metaKey) setCollapsed(collapsed ? undefined : "1");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  // "Open in file" is a real link to the editor's URL, so hovering shows where it goes.
  const fileLink: FileLink = (path, line) => ({
    href: roadmap ? editorUrl({ editor, root: roadmap.root, path, line }) : undefined,
    onClick: () => toast(`Opening ${path}${line ? `:${line}` : ""} in ${editorName(editor)}…`),
  });
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Copied. Paste it into your AI chat.");
  };

  const graph = useMemo<GoalGraph | undefined>(() => {
    if (!shownGoal) return undefined;
    const g = detours ? shownGoal.graph : withoutDetours(shownGoal.graph);
    return show.cancelled ? g : withoutDropped(g);
  }, [shownGoal, detours, show.cancelled]);

  const subject = useMemo<PromptSubject | undefined>(() => {
    if (!selected) return undefined;
    const node = shownGoal?.graph.nodes.find((n) => n.id === selected.key);
    return node && shownGoal ? { kind: "node", node, goal: shownGoal.goal, graph: shownGoal.graph } : undefined;
  }, [selected, shownGoal]);

  // The chat working on a Goal, if one holds it: whether it is still open says if the AI stopped.
  const sessionChips = roadmap?.sessions ?? [];
  // Steps with a helper are work going on, however long the plan stays unchanged.
  const stateOf = (g: Pick<Goal, "id" | "status" | "updatedAt" | "waitingOnYou" | "counts" | "fromElsewhere">) => {
    const s = sessionChips.find((x) => x.goal === g.id);
    return {
      status: g.status,
      updatedAt: g.updatedAt,
      running: s?.running,
      waitingOnYou: g.waitingOnYou,
      helpers: g.counts["with a helper"],
      fromElsewhere: g.fromElsewhere,
    };
  };
  // "last update 2 min ago" moves on by itself.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  // The Done group opens by itself while it holds the Goal on screen.
  const doneShown = groupOpen({ pinned: !!doneOpen, closedFor: doneClosedFor, holdsShown: grouped.done.some((g) => g.id === effectiveGoal), shown: effectiveGoal });
  const toggleDone = () => {
    setDoneOpen(doneShown ? undefined : "1");
    setDoneClosedFor(doneShown ? effectiveGoal : undefined);
  };
  const goalButton = (g: Goal) => {
    const pct = g.total ? Math.round((100 * g.done) / g.total) : 0;
    const fresh = grouped.fresh.has(g.id);
    const state = goalState(stateOf(g));
    const elsewhere = elsewhereTag(g.fromElsewhere);
    const hover = [
      fresh ? "Finished: open it to take a look." : state.hint,
      countsLine(g.counts),
      g.outcome && `Finished when: ${plainText(g.outcome)}`,
      elsewhere && `${elsewhere.label}: ${elsewhere.hint}`,
      "Right-click to hide it from this list.",
    ];
    return (
      <button key={g.id} className={`goal ${g.status} ${fresh ? "fresh" : ""} ${state.state === "you" ? "you" : ""}`} aria-current={!onContext && g.id === effectiveGoal}
        title={hover.filter(Boolean).join("\n")}
        onClick={() => pickGoal(g.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setGoalMenu({ id: g.id, at: { x: e.clientX, y: e.clientY } });
        }}>
        <div className="t">
          {g.title}
          {fresh && <span className="fresh-dot" role="img" aria-label="finished, not looked at yet" />}
          {state.state === "you" && <span className="you-dot" role="img" aria-label="waiting on you" />}
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="s">
          <span className={`state ${state.state}`}>{state.label}</span>
          <span>{g.total ? `${g.done} of ${g.total} steps` : "no steps yet"}</span>
        </div>
      </button>
    );
  };
  const menuGoal = goalMenu && goals.find((g) => g.id === goalMenu.id);
  const openPanel = (which: "help" | "settings" | "show" | undefined) => {
    setMenuOpen(which === "help");
    setSettingsOpen(which === "settings");
    setShowOpen(which === "show");
    if (which === "settings") reloadServers();
  };

  return (
    <>
      <header className="nav">
        <div className="logo">
          <i aria-hidden="true" />
          <span className="name">Progressor</span>
        </div>
        <SearchBox query={query} hits={hits} onChange={setQuery} onOpen={openHit} />
        <span className="sp" />
        <button className="iconbtn refresh-btn" title="Refresh: load the latest plan and running servers now" aria-label="Refresh"
          onClick={() => {
            refresh();
            reloadServers();
            toast("Refreshed.");
          }}>
          ↻<span className="label"> Refresh</span>
        </button>
        <span className={`chip ${connection === "live" ? "dot-only" : ""}`} role="status"
          title={connection === "live" ? "Live: this page updates by itself as your AI works." : "Lost touch with Progressor. It comes back by itself once your AI chat is open again."}
          aria-label={connection === "live" ? "Live" : "Reconnecting"}>
          <span className={`dot ${connection === "live" ? "" : "warn"}`} />
          {connection === "connecting" ? "Connecting…" : connection === "reconnecting" ? "Reconnecting…" : null}
        </span>
        <button className={`iconbtn menu-btn ${menuOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={menuOpen}
          title="Help: report a problem or suggest an idea" aria-label="Help" onClick={() => openPanel(menuOpen ? undefined : "help")}>
          ❓<span className="label"> Help</span>
        </button>
        <button className={`iconbtn menu-btn ${settingsOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={settingsOpen}
          title="Settings: how this page looks, and advanced options" aria-label="Settings" onClick={() => openPanel(settingsOpen ? undefined : "settings")}>
          ⚙️<span className="label"> Settings</span>
        </button>
        <div className="views" role="radiogroup" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v} role="radio" aria-checked={view === v} title={VIEW_LABELS[v]} aria-label={VIEW_LABELS[v]} onClick={() => chooseView(v)}>
              <span aria-hidden="true">{VIEW_ICONS[v]}</span>
              <span className="label">{VIEW_SHORT[v]}</span>
            </button>
          ))}
        </div>
        <button className={`toggle menu-btn ${showOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={showOpen} aria-label="Show"
          title="Show: choose what the map and the list show besides the plan's steps" onClick={() => openPanel(showOpen ? undefined : "show")}>
          Show <span aria-hidden="true">▾</span>
        </button>
        <button className="iconbtn theme-btn" title="Switch between light and dark" aria-label="Switch between light and dark" onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      {showOpen && (
        <MenuPanel label="Show" onClose={() => setShowOpen(false)}>
          <section>
            <h3>Show on the map and the list</h3>
            {SHOW_OPTIONS.map((o) => (
              <label key={o.key} className="option" title={o.hint}>
                <input type="checkbox" checked={show[o.key]} onChange={(e) => setShow({ ...storedShow, [o.key]: e.target.checked })} />
                <span><b>{o.label}</b><small>{o.hint}</small></span>
              </label>
            ))}
          </section>
        </MenuPanel>
      )}

      {settingsOpen && (
        <MenuPanel label="Settings" onClose={() => setSettingsOpen(false)}>
          <section>
            <h3>Default view</h3>
            <Choice value={defaultView ?? "horizontal"} onChange={(v) => setDefaultView(v === "horizontal" ? undefined : v)}
              options={VIEWS.map((v) => ({ value: v, label: `${VIEW_ICONS[v]} ${VIEW_SHORT[v]}`, hint: VIEW_LABELS[v] }))} />
            <p className="hint">How a goal is shown when you open it. The buttons at the top change only the page you're on.</p>
          </section>
          <section>
            <h3>Theme</h3>
            <Choice value={theme ?? "light"} onChange={(t) => setTheme(t === "light" ? undefined : t)}
              options={[
                { value: "light", label: "☀️ Light", hint: "Always light" },
                { value: "dark", label: "🌙 Dark", hint: "Always dark" },
                { value: "system", label: "💻 System", hint: "Light or dark, following your computer's setting" },
              ]} />
          </section>
          <section>
            <h3>Finished goals</h3>
            <label className="option">
              <input type="radio" name="finished" checked={finished !== "auto"} onChange={() => setFinished(undefined)} />
              <span><b>Wait for me to look</b><small>A finished goal keeps a green dot until you open it, then moves to Finished.</small></span>
            </label>
            <label className="option">
              <input type="radio" name="finished" checked={finished === "auto"} onChange={() => setFinished("auto")} />
              <span><b>Move to Finished straight away</b><small>Finished goals go to the Finished group below your goals as soon as they finish.</small></span>
            </label>
          </section>
          <details className="advanced">
            <summary title="Options for people who look at the code">Advanced</summary>
            <section>
              <h3>Open files in</h3>
              <select className="picker wide" aria-label="Open files in" title="The code editor that opens when you click a file name (turn on File names in the Show menu)"
                value={editor} onChange={(e) => setEditorChoice(e.target.value === info?.editor ? undefined : e.target.value)}>
                {info?.editor && !EDITORS.includes(info.editor) && <option value={info.editor}>Custom (PROGRESSOR_EDITOR)</option>}
                {EDITORS.filter((e) => e !== "jetbrains").map((e) => (
                  <option key={e} value={e}>
                    {editorName(e)}
                  </option>
                ))}
              </select>
            </section>
            <section>
              <h3>Hidden goals</h3>
              <label className="option">
                <input type="checkbox" checked={!!showHidden} onChange={(e) => setShowHidden(e.target.checked ? "1" : undefined)} />
                <span><b>Show hidden goals</b><small>Right-click a goal in the sidebar to hide it. Hiding only changes this list, never the plan.</small></span>
              </label>
            </section>
            <ServersPanel servers={servers} hub={info} reload={reloadServers} toast={toast} />
          </details>
          {SUPPORT_URL && (
            <section>
              <h3>Support Progressor</h3>
              <a className="card" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                ☕ Buy me a coffee
                <small>Progressor is free and open source. If it keeps you on track, a coffee keeps it going.</small>
              </a>
            </section>
          )}
          <p className="hint">Settings are saved in this browser.</p>
        </MenuPanel>
      )}

      {menuOpen && (
        <MenuPanel label="Help" onClose={() => setMenuOpen(false)}>
          <section>
            <h3>What the marks on a step mean</h3>
            <StepKey statuses={[]} all />
          </section>
          <section>
            <h3>Facing a problem?</h3>
            <a className="card" href={issueUrl("bug", { version: info?.version, system: describeSystem(navigator.userAgent) })} target="_blank" rel="noopener noreferrer">
              🐞 Report a problem
              <small>Opens a GitHub issue with your Progressor version and system already filled in.</small>
            </a>
            <a className="card" href={issueUrl("idea", { version: info?.version })} target="_blank" rel="noopener noreferrer">
              💬 Suggest an idea or share feedback
              <small>What would make Progressor work better for you? Every suggestion is read.</small>
            </a>
            <p className="hint">
              Someone may have hit it already: <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">see the open issues</a>
              {info?.version && <> · Progressor {info.version}</>}
            </p>
          </section>
        </MenuPanel>
      )}

      <div className={`layout ${collapsed ? "collapsed" : ""}`}>
        <aside className="side" aria-label="Project and your goals">
          <button className="col-btn" title="Hide or show this sidebar (shortcut: [ )" aria-label={collapsed ? "Show the sidebar" : "Hide the sidebar"} aria-expanded={!collapsed}
            onClick={() => setCollapsed(collapsed ? undefined : "1")}>
            {collapsed ? "»" : "«"}
          </button>
          <button className="vlabel" onClick={() => setCollapsed(undefined)}>Your goals</button>
          <section className="switcher">
            <h3>Project</h3>
            <button className="project current" title={project ? `${project.name}, in ${project.root}${(projects?.length ?? 0) > 1 ? "\nClick to switch to another project" : ""}` : undefined} aria-haspopup="listbox" aria-expanded={switcherOpen}
              disabled={(projects?.length ?? 0) < 2 && !!project} onClick={() => setSwitcherOpen(!switcherOpen)}>
              <span className="t">{project?.name ?? (showOverview ? "🗂 All projects" : projects ? "Choose a project" : "Loading…")}</span>
              {(projects?.length ?? 0) > 1 && <span className="chev" aria-hidden="true">{switcherOpen ? "▴" : "▾"}</span>}
            </button>
            {switcherOpen && (
              <div className="project-list" role="listbox" aria-label="Projects">
                <button className="project" role="option" aria-selected={showOverview} onClick={showAll}>
                  <span className="t">🗂 All projects</span>
                  <span className="path">Every project at a glance</span>
                </button>
                {sortProjects(projects ?? []).map((p) => (
                  <button key={p.id} className="project" role="option" aria-selected={p.id === projectId} onClick={() => pickProject(p.id)}>
                    <span className="t">{p.name}</span>
                    <span className="path">{p.root}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          {!showOverview && <section>
            <button className="goal context-entry" aria-current={onContext} onClick={openContext}
              title="The rules and background your AI keeps for this project">
              <span className="t">📌 Important context</span>
            </button>
          </section>}
          {!showOverview && <section>
            <h3 title="Everything your AI plans to build in this project, in order">
              Your goals
              {roadmap && <span className="count">{goals.length}</span>}
            </h3>
            {roadmap && goals.length === 0 && <p className="empty">No goals yet. Tell your AI what you want to build.</p>}
            {/* One Roadmap, many Goals: the Goals hang off a single rail so they read as parts of one plan. */}
            <div className="goals">{grouped.open.map(goalButton)}</div>
            {grouped.done.length > 0 && (
              <div className="group">
                <button className="group-head" aria-expanded={doneShown} title="Goals your AI has finished" onClick={toggleDone}>
                  <span aria-hidden="true">{doneShown ? "▾" : "▸"}</span> Finished <span className="count">{grouped.done.length}</span>
                </button>
                {doneShown && (
                  <button className="hide-all" title="Hide every finished goal from this list. The plan keeps them; find them under Hidden."
                    onClick={() => {
                      setHidden(hideAll(hidden, grouped.done.map((g) => g.id)));
                      toast(`Hidden ${grouped.done.length} finished ${grouped.done.length === 1 ? "goal" : "goals"}. Find them under Hidden.`);
                    }}>
                    Hide all {grouped.done.length}
                  </button>
                )}
                {doneShown && <div className="goals">{grouped.done.map(goalButton)}</div>}
              </div>
            )}
            {grouped.hidden.length > 0 && (
              <div className="group">
                <button className="group-head" aria-expanded={!!showHidden} title="Goals you hid from this list; the plan still has them" onClick={() => setShowHidden(showHidden ? undefined : "1")}>
                  <span aria-hidden="true">{showHidden ? "▾" : "▸"}</span> Hidden <span className="count">{grouped.hidden.length}</span>
                </button>
                {showHidden && <div className="goals hidden-goals">{grouped.hidden.map(goalButton)}</div>}
              </div>
            )}
          </section>}
        </aside>

        <main className="main">
          {error && !projects ? (
            <div className="placeholder">
              <h2>Can't reach Progressor</h2>
              Progressor runs while your AI chat is open, so it has most likely closed. Open your AI chat again and this page comes back by itself.
              <small className="detail">{error}</small>
            </div>
          ) : !projects ? (
            <div className="placeholder">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="placeholder">
              <h2>Nothing here yet</h2>
              Tell your AI what you want to build. Your project shows up here as soon as it plans the first goal, and this page follows along by itself.
            </div>
          ) : showOverview ? (
            <Overview overview={overview} workspaces={workspaces ?? []} only={pickedWorkspace} query={query} hits={hits} finishedWaits={finished !== "auto"}
              onOpen={pickProject} onShowAll={showAll} />
          ) : roadmap === null || (roadmap === undefined && !project && projectId) ? (
            <div className="placeholder">
              <h2>Nothing planned here yet</h2>
              Tell your AI what you want to build in this project. Its plan shows up here by itself. You can pick another project from the sidebar meanwhile.
            </div>
          ) : !roadmap ? (
            <div className="placeholder">Loading…</div>
          ) : onContext ? (
            <ContextPage rules={roadmap.standingInstructions} context={roadmap.context} />
          ) : goals.length === 0 ? (
            <div className="placeholder">
              <h2>No goals yet</h2>
              Tell your AI what you want to build. It plans the work as a goal with steps, and this page follows along by itself.
            </div>
          ) : !shownGoal || !graph ? (
            <div className="placeholder">Loading…</div>
          ) : (
            <>
              <Banner view={shownGoal} detours={detours} state={stateOf(shownGoal.goal)}
                onOpenStep={(node, at) => setSelected({ key: node.id, at })}
                planLink={show.files ? fileLink(shownGoal.goal.planFile) : undefined}
                onCopy={() => copy(copyAsPrompt({ kind: "goal", goal: shownGoal.goal, graph: shownGoal.graph }))} />
              {graph.nodes.length === 0 ? (
                <div className="placeholder"><h2>No steps yet</h2>Your AI adds the steps as it plans. This page updates by itself.</div>
              ) : view === "checklist" ? (
                <Checklist graph={graph} fileLink={fileLink} files={show.files} onOpen={(node, at) => setSelected({ key: node.id, at })}
                  footer={<GoalNotes view={shownGoal} goals={goals} />} />
              ) : (
                <>
                  <div className="stage">
                    <MetroMap
                      graph={graph}
                      orientation={view}
                      viewKey={`${projectId}:${shownGoal.goal.id}:${view}:${detours}:${show.cancelled}`}
                      focusId={focus(graph, detours)}
                      files={show.files}
                      onOpen={(node, at) => setSelected({ key: node.id, at })}
                    />
                    <div className="legend" aria-hidden="true">
                      <span>━ the plan</span>
                      {detours && <span style={{ color: "var(--detour)" }}>◆┈ side trip</span>}
                      {show.cancelled && <span style={{ color: "var(--faded)" }}>┅ cancelled</span>}
                      <StepKey statuses={tasksOf(graph).map((t) => t.status)} />
                      <span>click a stop for details · {view === "vertical" ? "scroll to move · Ctrl+scroll to zoom" : "scroll to zoom"}</span>
                    </div>
                  </div>
                  <GoalNotes view={shownGoal} goals={goals} dock />
                </>
              )}
            </>
          )}
        </main>
      </div>

      {goalMenu && menuGoal && (
        <GoalMenu at={goalMenu.at} onClose={() => setGoalMenu(undefined)}>
          <button role="menuitem" onClick={() => {
            pickGoal(menuGoal.id);
            setGoalMenu(undefined);
          }}>Open</button>
          {grouped.fresh.has(menuGoal.id) && (
            <button role="menuitem" onClick={() => {
              markSeen(menuGoal);
              setGoalMenu(undefined);
            }}>Move to Finished</button>
          )}
          {hidden.includes(menuGoal.id) ? (
            <button role="menuitem" onClick={() => hideGoal(menuGoal.id, false)}>Show in the list again</button>
          ) : (
            <button role="menuitem" onClick={() => hideGoal(menuGoal.id, true)}>Hide from the list</button>
          )}
        </GoalMenu>
      )}
      {selected && subject && (
        <Popover subject={subject} at={selected.at} onClose={() => setSelected(undefined)} fileLink={fileLink} files={show.files} onCopy={copy} />
      )}
      {toastNode}
    </>
  );
}

/** The Developer's Buy Me a Coffee page, shown in the Settings panel; the section is hidden while it is empty. */
const SUPPORT_URL = "https://buymeacoffee.com/rachitasthana";

/** A panel that drops from the navbar: Help (feedback), Settings (with Advanced and support) or Show. */
function MenuPanel({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".menu-panel") && !t.closest(".menu-btn") && !t.closest(".pop")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div className="menu-panel" role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

/** A row of mutually exclusive buttons, for a setting with a few short choices. */
function Choice<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="views choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The project's rules and background, as its AI wrote them. Read-only. */
function ContextPage({ rules, context }: { rules: { id?: string; text: string; hard?: boolean }[]; context: string }) {
  const code = (text: string) => inlineCode(text).map((s, i) => (s.code ? <code key={i}>{s.text}</code> : s.text));
  const blocks = contextBlocks(context);
  return (
    <div className="context-page">
      <h2>Important context</h2>
      <p className="note">The AI keeps this page up to date. To change something, tell it in the chat.</p>
      <h3>Rules</h3>
      {rules.length === 0 ? (
        <p className="empty">No rules yet. When you tell the AI a lasting rule, it shows up here.</p>
      ) : (
        <ol className="rules">
          {hardFirst(rules.map((r) => ({ ...r, hard: r.hard === true }))).map((r, i) => (
            <li key={r.id ?? i} className={r.hard ? "must" : undefined}>
              <span className="rid">{r.id ?? `s${i + 1}`}</span>
              <span>
                {r.hard && <b className="must-badge" title="A rule your AI must never break, as opposed to a preference">Must</b>}
                {code(r.text)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <h3>Context</h3>
      {blocks.length === 0 ? (
        <p className="empty">Nothing here yet. The AI keeps the project's background here: what it is, key facts and choices that hold for the whole project.</p>
      ) : (
        blocks.map((b, i) =>
          b.kind === "paragraph" ? (
            <RichText key={i} className="para" text={b.text} />
          ) : (
            b.ordered ? (
              <ol key={i} className="ctx-list">{b.items.map((t, j) => <li key={j}>{code(t)}</li>)}</ol>
            ) : (
              <ul key={i} className="ctx-list">{b.items.map((t, j) => <li key={j}>{code(t)}</li>)}</ul>
            )
          ),
        )
      )}
    </div>
  );
}

/** The right-click menu of a Goal in the sidebar. */
function GoalMenu({ at, children, onClose }: { at: { x: number; y: number }; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  useLayoutEffect(() => {
    const el = ref.current!;
    setPos({ left: Math.min(at.x, innerWidth - el.offsetWidth - 8), top: Math.min(at.y, innerHeight - el.offsetHeight - 8) });
    el.querySelector("button")?.focus();
  }, [at]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".goal-menu")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} className="goal-menu" role="menu" style={pos}>
      {children}
    </div>
  );
}

const tasksOf = (g: GoalGraph) => g.nodes.filter((n): n is TaskNode => n.kind === "task");
const openDetourOf = (g: GoalGraph) => g.nodes.find((n): n is DetourNode => n.kind === "detour" && n.status === "open");

function focus(g: GoalGraph, detours: boolean): string | undefined {
  const open = detours ? openDetourOf(g) : undefined;
  const tasks = tasksOf(g);
  const first = (status: string) => tasks.find((t) => t.status === status)?.id;
  return (
    first("waiting on you") ?? open?.id ?? first("in progress") ?? first("with a helper") ?? first("checked") ?? first("pending") ?? tasks[0]?.id
  );
}

type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

function Banner({ view, detours, state, planLink, onCopy, onOpenStep }: {
  view: GoalView;
  /** Opens a step's details, from the list of steps waiting on the Developer. */
  onOpenStep: (node: TaskNode, at: { x: number; y: number }) => void;
  detours: boolean;
  /** Whether a chat is working on the Goal, for the status line. */
  state: Parameters<typeof goalState>[0];
  /** The Plan File's link, when file names are shown. */
  planLink: ReturnType<FileLink> | undefined;
  onCopy: () => void;
}) {
  const { goal, graph } = view;
  const tasks = tasksOf(graph);
  const waiting = tasks.filter((t) => t.status === "waiting on you");
  const next = tasks.find((t) => t.status === "pending");
  const open = detours ? openDetourOf(graph) : undefined;
  const from = open?.branchedFrom ? tasks.find((t) => t.id === open.branchedFrom) : undefined;
  const { state: now, hint } = goalState(state);
  const line = statusLine(state, tasks.map((t) => t.status));
  const elsewhere = elsewhereTag(goal.fromElsewhere);
  return (
    <div className={`banner ${open ? "detour" : ""} ${now}`}>
      <span className="big" aria-hidden="true">{now === "you" ? "🙋" : open ? "🚧" : goal.status === "done" ? "🏁" : "🚇"}</span>
      <div className="text">
        {open ? (
          <>
            <div><b>On a side trip:</b> {open.title}</div>
            <div className="k" title={SIDE_TRIP_HINT.open}>
              {from ? `Stepped off "${from.title}"` : "Stepped off the plan"}
              {open.reason ? ` because: ${plainText(open.reason)}` : "."}
            </div>
          </>
        ) : (
          <>
            <div>
              <b>{goal.title}:</b>{" "}
              {underWay(tasks) ?? (goal.status === "done" ? "finished" : goal.status === "dropped" ? `cancelled${goal.reason ? `: ${plainText(goal.reason)}` : ""}` : "nothing under way")}
              {elsewhere && <> <span className="tag elsewhere" title={elsewhere.hint}>{elsewhere.label}</span></>}
            </div>
            {goal.outcome && <div className="k outcome" title="What finished looks like: the AI checks the work against this before it calls the goal finished">🎯 Finished when: {plainText(goal.outcome)}</div>}
          </>
        )}
        <div className="k status-line" title={hint}>
          <span className={`state-dot ${now}`} aria-hidden="true" />
          {line}
          {next && !open ? ` · next: ${next.title}` : ""}
        </div>
        {waiting.length > 0 && (
          <div className="you-steps" title={STEP_HINT["waiting on you"]}>
            <span>Waiting on you:</span>
            {waiting.map((t) => (
              <button key={t.id} className="you-step" onClick={(e) => onOpenStep(t, { x: e.clientX, y: e.clientY })}>
                <StepMark status="waiting on you" /> {t.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="actions">
        {planLink && <a className="btn ghost" title="Open the file the plan of this goal is kept in" {...planLink}>Open plan file</a>}
        <button className="btn ghost" title="Copies a description of this goal that you can paste into your AI chat" onClick={onCopy}>Copy for your AI</button>
      </div>
    </div>
  );
}

interface Location {
  path: string;
  line?: number;
  label: string;
}

function describe(subject: PromptSubject): { title: string; meta: string; state?: string; summary?: string; reason?: string; locations: Location[] } {
  switch (subject.kind) {
    case "node": {
      const { node: n, goal, graph } = subject;
      const main = { path: goal.planFile, line: n.line, label: `📄 ${goal.planFile}:${n.line}` };
      if (n.kind === "detour")
        return { title: n.title, meta: `Side trip · ${STEP_WORD[n.status]}`, summary: SIDE_TRIP_HINT[n.status], reason: n.reason && `Why: ${n.reason}`, locations: [main] };
      const code = n.code.map((c) => ({ ...parseCodeRef(c), label: `↳ ${c}` }));
      const live = tasksOf(graph).filter((t) => t.status !== "dropped").sort((a, b) => a.line - b.line);
      const number = live.findIndex((t) => t.id === n.id);
      const which = number >= 0 ? `Step ${number + 1} of ${live.length}` : "Step";
      const elsewhere = elsewhereTag(n.updatedFrom);
      return {
        title: n.title,
        meta: `${which} · ${STEP_WORD[n.status]}${n.fromDetour ? " · added after a side trip" : ""}${elsewhere ? ` · ${elsewhere.label.toLowerCase()}` : ""}`,
        state: n.status,
        summary: n.summary,
        reason: n.status === "dropped" && n.reason ? `Why it was cancelled: ${plainText(n.reason)}` : undefined,
        locations: [main, ...code],
      };
    }
    case "goal":
      return {
        title: subject.goal.title,
        meta: `Goal · ${GOAL_WORD[subject.goal.status]}`,
        summary: subject.goal.outcome && `Finished when: ${subject.goal.outcome}`,
        locations: [{ path: subject.goal.planFile, label: `📄 ${subject.goal.planFile}` }],
      };
    default:
      return { title: "", meta: "", locations: [] };
  }
}

function Popover({ subject, at, onClose, fileLink, files, onCopy }: {
  subject: PromptSubject;
  at: { x: number; y: number };
  onClose: () => void;
  fileLink: FileLink;
  /** Whether to show the files and the buttons that open them. */
  files: boolean;
  onCopy: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x + 12, top: at.y + 12 });
  const d = describe(subject);
  const prompt = copyAsPrompt(subject);

  useLayoutEffect(() => {
    const el = ref.current!;
    setPos({
      left: Math.max(10, Math.min(at.x + 12, innerWidth - el.offsetWidth - 10)),
      top: Math.max(10, Math.min(at.y + 12, innerHeight - el.offsetHeight - 10)),
    });
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".pop") && !t.closest("[data-node]") && !t.closest(".card")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);

  const [first] = d.locations;
  return (
    <div ref={ref} className="pop" role="dialog" aria-label={d.title} tabIndex={-1} style={pos}>
      <button className="x" aria-label="Close" onClick={onClose}>✕</button>
      <h4>{d.title}</h4>
      <div className="meta">{d.meta}</div>
      {d.state && STEP_HINT[d.state] && (
        <div className={`pop-state ${statusClass(d.state)}`}><StepMark status={d.state} /> <span>{STEP_HINT[d.state]}</span></div>
      )}
      {d.summary && <RichText className="summary" text={d.summary} />}
      {d.reason && <RichText className="reason" text={d.reason} />}
      {files && <div className="locs">
        {d.locations.map((l) => (
          <a key={l.label} {...fileLink(l.path, l.line)}>
            {l.label}
          </a>
        ))}
      </div>}
      <details>
        <summary>What gets copied</summary>
        <pre>{prompt}</pre>
      </details>
      <div className="row">
        <button className="btn" title="Copies a description of this that you can paste into your AI chat, to ask about it or change it" onClick={() => onCopy(prompt)}>Copy for your AI</button>
        {files && first && <a className="btn ghost" title="Open it in your code editor" {...fileLink(first.path, first.line)}>Open in file</a>}
      </div>
    </div>
  );
}
