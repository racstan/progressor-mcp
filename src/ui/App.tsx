import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_EDITOR, EDITORS, editorUrl, parseCodeRef } from "../dashboard/editor.js";
import { type DetourNode, type GoalGraph, type TaskNode, withoutDetours } from "../dashboard/graph.js";
import { type PromptSubject, copyAsPrompt } from "../dashboard/prompt.js";
import { type GoalView, type RoadmapView, useDashboard, useStored, useStoredJson } from "./data.js";
import { STATUS_LABEL } from "./geometry.js";
import { Checklist } from "./Checklist.js";
import { type Finished, type Seen, doneMark, groupGoals, seenOnFirstVisit } from "./goalList.js";
import { MetroMap } from "./MetroMap.js";
import { RichText } from "./RichText.js";
import { plainText } from "./text.js";
import { VIEWS, VIEW_LABELS, type View, pickView } from "./views.js";

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

const GOAL_STATUS: Record<string, string> = { planned: "Planned", active: "Active", paused: "Paused", done: "Done", dropped: "Dropped" };

/** The Goal shown first: the one being worked on, else a paused one, else the next planned one. */
function defaultGoal(goals: Goal[]): string | undefined {
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
  const [picked, setPicked] = useState<string | undefined>(goalFromHash);
  const [detours, setDetours] = useState(true);
  const [theme, setTheme] = useStored<Theme>("progressor.theme", undefined);
  const [collapsed, setCollapsed] = useStored<"1">("progressor.sidebar-collapsed", undefined);
  // The default view is a setting; the navbar's view buttons only change what this page shows.
  const [defaultView, setDefaultView] = useStored<View>("progressor.view", undefined);
  const [view, setView] = useState<View>(() => pickView(location.search, defaultView));
  const [finished, setFinished] = useStored<Finished>("progressor.finished", undefined);
  const [showHidden, setShowHidden] = useStored<"1">("progressor.show-hidden", undefined);
  const [doneOpen, setDoneOpen] = useStored<"1">("progressor.done-open", undefined);
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
  const [goalMenu, setGoalMenu] = useState<{ id: string; at: { x: number; y: number } }>();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // What the popover shows, by ID, so it follows live updates to that item.
  const [selected, setSelected] = useState<{ kind: "node" | "idea" | "standing instruction"; key: string; at: { x: number; y: number } }>();
  const [toast, toastNode] = useToast();

  const [projectId, setProjectId] = useState<string | undefined>(pickedProject);
  const [goalId, setGoalId] = useState<string | undefined>(picked);
  const { info, projects, roadmap, goal, connection, error } = useDashboard(projectId, goalId);
  const project = projects?.find((p) => p.id === projectId);
  // Without a project in the address, show the first one; an unknown one is reported, never swapped.
  const effectiveProject = pickedProject ?? projects?.[0]?.id;
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
  const effectiveGoal = picked && goals.some((g) => g.id === picked)
    ? picked
    : defaultGoal([...grouped.open, ...grouped.done]) ?? goals[0]?.id;
  useEffect(() => setGoalId(effectiveGoal), [effectiveGoal]);
  const hideGoal = (id: string, hide: boolean) => {
    setHidden(hide ? [...hidden.filter((h) => h !== id), id] : hidden.filter((h) => h !== id));
    setGoalMenu(undefined);
    if (hide) toast("Hidden from this list; the plan is unchanged. Find it under Hidden, below the Roadmap.");
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
      setPicked(goalFromHash());
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
    closeDrawerOnNarrow();
  };
  const pickProject = (id: string) => {
    setSelected(undefined);
    setSwitcherOpen(false);
    setMenuOpen(false);
    setParams({ project: id }, "push");
    setPickedProject(id);
    setPicked(undefined);
    closeDrawerOnNarrow();
  };

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
    document.title = [shownGoal?.goal.title, project?.name, "Progressor"].filter(Boolean).join(" · ");
  }, [shownGoal, project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        setSelected(undefined);
        setMenuOpen(false);
        setSettingsOpen(false);
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
    toast("Copied as prompt. Paste it into your Agent chat.");
  };

  const graph = useMemo<GoalGraph | undefined>(
    () => (shownGoal ? (detours ? shownGoal.graph : withoutDetours(shownGoal.graph)) : undefined),
    [shownGoal, detours],
  );

  const subject = useMemo<PromptSubject | undefined>(() => {
    if (!selected || !roadmap) return undefined;
    const file = roadmap.file;
    if (selected.kind === "node") {
      const node = shownGoal?.graph.nodes.find((n) => n.id === selected.key);
      return node && shownGoal ? { kind: "node", node, goal: shownGoal.goal, graph: shownGoal.graph } : undefined;
    }
    if (selected.kind === "idea") {
      const idea = roadmap.ideas.find((i) => keyOf(i) === selected.key);
      return idea && { kind: "idea", idea, file };
    }
    const instruction = roadmap.standingInstructions.find((i) => keyOf(i) === selected.key);
    return instruction && { kind: "standing instruction", instruction, file };
  }, [selected, roadmap, shownGoal]);

  const sessionChips = roadmap?.sessions ?? [];
  const sessionLabel = (g: Pick<Goal, "id" | "status">) => {
    const s = sessionChips.find((x) => x.goal === g.id);
    return s ? `Session ${s.session}${s.running ? "" : " (ended)"}` : (GOAL_STATUS[g.status] ?? g.status);
  };
  // The Done group opens by itself while it holds the Goal on screen.
  const doneShown = !!doneOpen || grouped.done.some((g) => g.id === effectiveGoal);
  const goalButton = (g: Goal) => {
    const pct = g.total ? Math.round((100 * g.done) / g.total) : 0;
    const fresh = grouped.fresh.has(g.id);
    return (
      <button key={g.id} className={`goal ${g.status} ${fresh ? "fresh" : ""}`} aria-current={g.id === effectiveGoal}
        title={fresh ? "Finished: open it to take a look" : "Right-click for more"}
        onClick={() => pickGoal(g.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setGoalMenu({ id: g.id, at: { x: e.clientX, y: e.clientY } });
        }}>
        <div className="t">
          {g.title}
          {fresh && <span className="fresh-dot" role="img" aria-label="finished, not looked at yet" />}
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="s">
          <span>{sessionLabel(g)}</span>
          <span>{g.total ? `${g.done}/${g.total} · ${pct}%` : "no Tasks"}</span>
        </div>
      </button>
    );
  };
  const menuGoal = goalMenu && goals.find((g) => g.id === goalMenu.id);
  const instructions = roadmap?.standingInstructions ?? [];
  const ideas = roadmap?.ideas.filter((i) => !i.promotedTo) ?? [];
  const select = (kind: "idea" | "standing instruction", key: string) => (e: React.MouseEvent) =>
    setSelected({ kind, key, at: { x: e.clientX, y: e.clientY } });

  return (
    <>
      <header className="nav">
        <div className="logo">
          <i aria-hidden="true" />
          Progressor
        </div>
        <span className="sp" />
        <span className="chip" title={connection === "live" ? "Updates as the markdown changes" : "Lost the connection to the Progressor server"}>
          <span className={`dot ${connection === "live" ? "" : "warn"}`} />
          {connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
        {roadmap && (
          <button className={`iconbtn menu-btn ${menuOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={menuOpen}
            title="Help: your Standing Instructions, the parked Ideas and how to support Progressor" aria-label="Help" onClick={() => {
              setMenuOpen(!menuOpen);
              setSettingsOpen(false);
            }}>
            ❓<span className="label"> Help</span>
          </button>
        )}
        <button className={`iconbtn menu-btn ${settingsOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={settingsOpen}
          title="Settings: default view, theme, editor and finished Goals" aria-label="Settings" onClick={() => {
            setSettingsOpen(!settingsOpen);
            setMenuOpen(false);
          }}>
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
        <button className="toggle" role="switch" aria-checked={detours} onClick={() => {
          setDetours(!detours);
          toast(`${detours ? "Hiding" : "Showing"} Detours in this view.`);
        }}>
          <span className="sw" />
          Detours
        </button>
        <button className="iconbtn" title="Switch between light and dark" aria-label="Switch between light and dark" onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      {settingsOpen && (
        <MenuPanel label="Settings" onClose={() => setSettingsOpen(false)}>
          <section>
            <h3>Default view</h3>
            <Choice value={defaultView ?? "horizontal"} onChange={(v) => setDefaultView(v === "horizontal" ? undefined : v)}
              options={VIEWS.map((v) => ({ value: v, label: `${VIEW_ICONS[v]} ${VIEW_SHORT[v]}` }))} />
            <p className="hint">What a Goal opens in. The buttons in the navbar change only the page you're on.</p>
          </section>
          <section>
            <h3>Theme</h3>
            <Choice value={theme ?? "light"} onChange={(t) => setTheme(t === "light" ? undefined : t)}
              options={[{ value: "light", label: "☀️ Light" }, { value: "dark", label: "🌙 Dark" }, { value: "system", label: "💻 System" }]} />
          </section>
          <section>
            <h3>Open files in</h3>
            <select className="picker wide" aria-label="Open files in" value={editor} onChange={(e) => setEditorChoice(e.target.value === info?.editor ? undefined : e.target.value)}>
              {info?.editor && !EDITORS.includes(info.editor) && <option value={info.editor}>Custom (PROGRESSOR_EDITOR)</option>}
              {EDITORS.filter((e) => e !== "jetbrains").map((e) => (
                <option key={e} value={e}>
                  {editorName(e)}
                </option>
              ))}
            </select>
          </section>
          <section>
            <h3>Finished Goals</h3>
            <label className="option">
              <input type="radio" name="finished" checked={finished !== "auto"} onChange={() => setFinished(undefined)} />
              <span><b>Wait for me to look</b><small>A finished Goal stays in the list with a green dot until you open it, then moves to Done.</small></span>
            </label>
            <label className="option">
              <input type="radio" name="finished" checked={finished === "auto"} onChange={() => setFinished("auto")} />
              <span><b>Move to Done straight away</b><small>Finished Goals go to the Done group below the Roadmap as soon as they finish.</small></span>
            </label>
          </section>
          <section>
            <h3>Hidden Goals</h3>
            <label className="option">
              <input type="checkbox" checked={!!showHidden} onChange={(e) => setShowHidden(e.target.checked ? "1" : undefined)} />
              <span><b>Show hidden Goals</b><small>Right-click a Goal in the sidebar to hide it. Hiding only changes this list, never the plan.</small></span>
            </label>
          </section>
          <p className="hint">Settings are saved in this browser.</p>
        </MenuPanel>
      )}

      {menuOpen && roadmap && (
        <MenuPanel label="Help" onClose={() => setMenuOpen(false)}>
          <section>
            <h3>Standing Instructions</h3>
            {instructions.length === 0 && <p className="empty">None yet. They are lasting rules you give the Agent, such as "ask me before recalibrating".</p>}
            {instructions.map((s, i) => (
              <button key={s.id ?? i} className="card" onClick={select("standing instruction", keyOf(s))}>
                📌 {s.text}
              </button>
            ))}
          </section>
          <section>
            <h3>Parked Ideas</h3>
            {ideas.length === 0 && <p className="empty">None parked.</p>}
            {ideas.map((idea, i) => (
              <button key={idea.id ?? i} className="card" onClick={select("idea", keyOf(idea))}>
                💡 {idea.title}
                {idea.notes[0] && <small>{idea.notes[0]}</small>}
              </button>
            ))}
          </section>
          {SUPPORT_URL && (
            <section>
              <h3>Support Progressor</h3>
              <a className="card support" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                ☕ Buy me a coffee
                <small>Progressor is free and open source. If it keeps you on track, a coffee keeps it going.</small>
              </a>
            </section>
          )}
        </MenuPanel>
      )}

      <div className={`layout ${collapsed ? "collapsed" : ""}`}>
        <aside className="side" aria-label="Project and Roadmap">
          <button className="col-btn" title="Collapse or expand the sidebar ( [ )" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} aria-expanded={!collapsed}
            onClick={() => setCollapsed(collapsed ? undefined : "1")}>
            {collapsed ? "»" : "«"}
          </button>
          <button className="vlabel" onClick={() => setCollapsed(undefined)}>Roadmap</button>
          <section className="switcher">
            <h3>Project</h3>
            <button className="project current" title={project?.root} aria-haspopup="listbox" aria-expanded={switcherOpen}
              disabled={(projects?.length ?? 0) < 2 && !!project} onClick={() => setSwitcherOpen(!switcherOpen)}>
              <span className="t">{project?.name ?? (projects ? "Choose a project" : "Loading…")}</span>
              {(projects?.length ?? 0) > 1 && <span className="chev" aria-hidden="true">{switcherOpen ? "▴" : "▾"}</span>}
            </button>
            {switcherOpen && (
              <div className="project-list" role="listbox" aria-label="Projects">
                {projects?.map((p) => (
                  <button key={p.id} className="project" role="option" aria-selected={p.id === projectId} onClick={() => pickProject(p.id)}>
                    <span className="t">{p.name}</span>
                    <span className="path">{p.root}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3>
              Roadmap
              {roadmap && <span className="count">{goals.length} {goals.length === 1 ? "Goal" : "Goals"}</span>}
            </h3>
            {roadmap && <p className="path roadmap-path" title="The project folder this Roadmap comes from">{roadmap.root}</p>}
            {roadmap && goals.length === 0 && <p className="empty">No Goals yet.</p>}
            {/* One Roadmap, many Goals: the Goals hang off a single rail so they read as parts of one plan. */}
            <div className="goals">{grouped.open.map(goalButton)}</div>
            {grouped.done.length > 0 && (
              <div className="group">
                <button className="group-head" aria-expanded={doneShown} onClick={() => setDoneOpen(doneOpen ? undefined : "1")}>
                  <span aria-hidden="true">{doneShown ? "▾" : "▸"}</span> Done <span className="count">{grouped.done.length}</span>
                </button>
                {doneShown && <div className="goals">{grouped.done.map(goalButton)}</div>}
              </div>
            )}
            {grouped.hidden.length > 0 && (
              <div className="group">
                <button className="group-head" aria-expanded={!!showHidden} onClick={() => setShowHidden(showHidden ? undefined : "1")}>
                  <span aria-hidden="true">{showHidden ? "▾" : "▸"}</span> Hidden <span className="count">{grouped.hidden.length}</span>
                </button>
                {showHidden && <div className="goals hidden-goals">{grouped.hidden.map(goalButton)}</div>}
              </div>
            )}
          </section>
        </aside>

        <main className="main">
          {error && !projects ? (
            <div className="placeholder"><h2>Can't reach Progressor</h2>{error}</div>
          ) : !projects ? (
            <div className="placeholder">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="placeholder">
              <h2>No projects yet</h2>
              A project appears here once an Agent using Progressor has added a Goal to it, which creates its <code>.progressor/</code> folder.
            </div>
          ) : roadmap === null || (roadmap === undefined && !project && projectId) ? (
            <div className="placeholder">
              <h2>No progress record for this project yet</h2>
              It appears once the Agent adds a Goal (<code>add_goal</code>). Pick another project from the sidebar meanwhile.
            </div>
          ) : !roadmap ? (
            <div className="placeholder">Loading…</div>
          ) : goals.length === 0 ? (
            <div className="placeholder">
              <h2>No Goals yet</h2>
              Ask your Agent to add one; it calls <code>add_goal</code>. This page updates by itself as the plan is written to <code>.progressor/</code>.
            </div>
          ) : !shownGoal || !graph ? (
            <div className="placeholder">Loading…</div>
          ) : (
            <>
              <Banner view={shownGoal} detours={detours} status={sessionLabel(shownGoal.goal)}
                planLink={fileLink(shownGoal.goal.planFile)}
                onCopy={() => copy(copyAsPrompt({ kind: "goal", goal: shownGoal.goal, graph: shownGoal.graph }))} />
              {graph.nodes.length === 0 ? (
                <div className="placeholder"><h2>No Tasks yet</h2>The Agent adds Tasks with <code>add_tasks</code>.</div>
              ) : view === "checklist" ? (
                <Checklist graph={graph} fileLink={fileLink} onOpen={(node, at) => setSelected({ kind: "node", key: node.id, at })} />
              ) : (
                <MetroMap
                  graph={graph}
                  orientation={view}
                  viewKey={`${projectId}:${shownGoal.goal.id}:${view}:${detours}`}
                  focusId={focus(shownGoal.graph, detours)}
                  onOpen={(node, at) => setSelected({ kind: "node", key: node.id, at })}
                />
              )}
              {view !== "checklist" && graph.nodes.length > 0 && <div className="legend" aria-hidden="true">
                <span>━ plan</span>
                <span style={{ color: "var(--detour)" }}>┈ Detour</span>
                <span style={{ color: "var(--faded)" }}>┅ dropped</span>
                <span>◆ Detour stop</span>
                <span>{view === "vertical" ? "drag a stop · scroll to move · Ctrl+scroll to zoom" : "drag a stop · scroll to zoom"}</span>
              </div>}
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
            }}>Move to Done</button>
          )}
          {hidden.includes(menuGoal.id) ? (
            <button role="menuitem" onClick={() => hideGoal(menuGoal.id, false)}>Show in the list again</button>
          ) : (
            <button role="menuitem" onClick={() => hideGoal(menuGoal.id, true)}>Hide from the list</button>
          )}
        </GoalMenu>
      )}
      {selected && subject && (
        <Popover subject={subject} at={selected.at} onClose={() => setSelected(undefined)} fileLink={fileLink} onCopy={copy} />
      )}
      {toastNode}
    </>
  );
}

/** The Developer's Buy Me a Coffee page, shown in the Help panel; the section is hidden while it is empty. */
const SUPPORT_URL = "https://buymeacoffee.com/rachitasthana";

/** A panel that drops from the navbar: Help (Standing Instructions, Ideas, support) or Settings. */
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
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="views choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
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

const keyOf = (item: { id: string | undefined; line: number }) => item.id ?? `line${item.line}`;
const tasksOf = (g: GoalGraph) => g.nodes.filter((n): n is TaskNode => n.kind === "task");
const openDetourOf = (g: GoalGraph) => g.nodes.find((n): n is DetourNode => n.kind === "detour" && n.status === "open");

function focus(g: GoalGraph, detours: boolean): string | undefined {
  const open = detours ? openDetourOf(g) : undefined;
  const tasks = tasksOf(g);
  return open?.id ?? tasks.find((t) => t.status === "in progress")?.id ?? tasks.find((t) => t.status === "pending")?.id ?? tasks[0]?.id;
}

type FileLink = (path: string, line?: number) => { href: string | undefined; onClick: () => void };

function Banner({ view, detours, status, planLink, onCopy }: {
  view: GoalView;
  detours: boolean;
  /** The Goal's status, or the Session working on it. */
  status: string;
  planLink: ReturnType<FileLink>;
  onCopy: () => void;
}) {
  const { goal, graph } = view;
  const tasks = tasksOf(graph);
  const current = tasks.find((t) => t.status === "in progress");
  const next = tasks.find((t) => t.status === "pending");
  const open = detours ? openDetourOf(graph) : undefined;
  const from = open?.branchedFrom ? tasks.find((t) => t.id === open.branchedFrom) : undefined;
  return (
    <div className={`banner ${open ? "detour" : ""}`}>
      <span className="big" aria-hidden="true">{open ? "🚧" : goal.status === "done" ? "🏁" : "🚇"}</span>
      <div className="text">
        {open ? (
          <>
            <div><b>On a Detour:</b> {open.title}</div>
            <div className="k">
              {from ? `Branched off "${from.title}". ` : ""}
              {open.reason ? `Reason: ${plainText(open.reason)}` : ""}
            </div>
          </>
        ) : (
          <>
            <div>
              <b>{goal.title}:</b>{" "}
              {current ? `now on "${current.title}"` : goal.status === "done" ? "Goal complete" : goal.status === "dropped" ? "Goal dropped" : "nothing in progress"}
            </div>
            <div className="k">
              {status} · {goal.done} of {goal.total} Tasks done
              {next ? ` · Next stop: ${next.title}` : ""}
            </div>
          </>
        )}
      </div>
      <div className="actions">
        <a className="btn ghost" {...planLink}>Open plan file</a>
        <button className="btn ghost" onClick={onCopy}>Copy Goal as prompt</button>
      </div>
    </div>
  );
}

interface Location {
  path: string;
  line?: number;
  label: string;
}

function describe(subject: PromptSubject): { title: string; meta: string; summary?: string; reason?: string; locations: Location[] } {
  switch (subject.kind) {
    case "node": {
      const { node: n, goal } = subject;
      const main = { path: goal.planFile, line: n.line, label: `📄 ${goal.planFile}:${n.line}` };
      if (n.kind === "detour")
        return { title: n.title, meta: `Detour ${n.id} · ${STATUS_LABEL[n.status]}`, reason: n.reason, locations: [main] };
      const code = n.code.map((c) => ({ ...parseCodeRef(c), label: `↳ ${c}` }));
      const extra = n.fromDetour ? " · added from a Detour" : n.addedBy ? ` · added by ${n.addedBy}` : "";
      return {
        title: n.title,
        meta: `Task ${n.id} · ${STATUS_LABEL[n.status]}${extra}`,
        summary: n.summary,
        reason: n.status === "dropped" ? n.reason : undefined,
        locations: [main, ...code],
      };
    }
    case "goal":
      return {
        title: subject.goal.title,
        meta: `Goal · ${GOAL_STATUS[subject.goal.status]}`,
        locations: [{ path: subject.goal.planFile, label: `📄 ${subject.goal.planFile}` }],
      };
    case "idea":
      return {
        title: subject.idea.title,
        meta: `Idea ${subject.idea.id ?? ""} · parked`,
        reason: subject.idea.notes.join(" "),
        locations: [{ path: subject.file, line: subject.idea.line, label: `📄 ${subject.file}:${subject.idea.line}` }],
      };
    case "standing instruction":
      return {
        title: subject.instruction.text,
        meta: `Standing Instruction ${subject.instruction.id ?? ""}`,
        locations: [{ path: subject.file, line: subject.instruction.line, label: `📄 ${subject.file}:${subject.instruction.line}` }],
      };
  }
}

function Popover({ subject, at, onClose, fileLink, onCopy }: {
  subject: PromptSubject;
  at: { x: number; y: number };
  onClose: () => void;
  fileLink: FileLink;
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
      {d.summary && <RichText className="summary" text={d.summary} />}
      {d.reason && <RichText className="reason" text={d.reason} />}
      <div className="locs">
        {d.locations.map((l) => (
          <a key={l.label} {...fileLink(l.path, l.line)}>
            {l.label}
          </a>
        ))}
      </div>
      <details>
        <summary>What gets copied</summary>
        <pre>{prompt}</pre>
      </details>
      <div className="row">
        <button className="btn" onClick={() => onCopy(prompt)}>Copy as prompt</button>
        {first && <a className="btn ghost" {...fileLink(first.path, first.line)}>Open in file</a>}
      </div>
    </div>
  );
}
