import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_EDITOR, EDITORS, editorUrl } from "../dashboard/editor.js";
import type { GoalSchedule } from "../schedule.js";
import { type RoadmapView, showInFolder, useDashboard, useOverview, useSearch, useServers, usePageStaleness, useStored, useStoredJson } from "./data.js";
import { CONTEXT_HASH, STATS_HASH, TALK_HASH, WISHLIST_HASH, contextFromHash } from "./context.js";
import { ContextPage } from "./ContextPage.js";
import { WishlistPage } from "./WishlistPage.js";
import { StatsPage } from "./StatsPage.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { describeSystem, ISSUES_URL, issueUrl } from "./feedback.js";
import { type Finished, type Seen, doneMark, groupGoals, groupOpen, hideAll, seenOnFirstVisit } from "./goalList.js";
import { GoalPage } from "./GoalPage.js";
import { Home } from "./HomePage.js";
import { type PutOff, needsWhy, sidebarSections } from "./home.js";
import { Icon, Ring } from "./Icon.js";
import { Choice, GoalMenu, MenuPanel } from "./Menus.js";
import { sortProjects } from "./projectList.js";
import { type SearchHit, SearchBox } from "./Search.js";
import { Conversation } from "./Talk.js";
import { ServersPanel } from "./Servers.js";
import { StepKey } from "./StepKey.js";
import type { FileLink } from "./Steps.js";
import { goalState, resourceWords } from "./words.js";

type Goal = RoadmapView["goals"][number];
type Theme = "light" | "dark" | "system" | "vibrant";

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

/** The Goal shown first: one waiting on the Developer, else one being worked on, else a paused one, else the next planned one. */
function defaultGoal(goals: Goal[]): string | undefined {
  const waiting = goals.find((g) => g.waitingOnYou && (g.status === "active" || g.status === "paused"));
  if (waiting) return waiting.id;
  for (const status of ["active", "paused", "planned", "done"])
    for (const g of goals) if (g.status === status) return g.id;
  return goals[0]?.id;
}

/** The talk with the whole project, in the dashboard's API: the goal routes with this ID (project.ts). */
const PROJECT_TALK = "_project";

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

/** Changes some of the address's parameters (project, workspace), keeping the others and the Goal in the hash. */
function setParams(changes: Record<string, string | undefined>, how: "push" | "replace" = "replace") {
  const params = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) params.delete(k);
    else params.set(k, v);
  }
  const query = params.toString();
  const url = `${query ? `?${query}` : location.pathname}${how === "push" ? "" : location.hash}`;
  if (how === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

const isPhone = () => matchMedia("(max-width: 900px)").matches;

export function App() {
  const [pickedProject, setPickedProject] = useState<string | undefined>(projectFromUrl);
  const [pickedWorkspace, setPickedWorkspace] = useState<string | undefined>(workspaceFromUrl);
  const [picked, setPicked] = useState<string | undefined>(goalFromHash);
  const [onContext, setOnContext] = useState(() => contextFromHash(location.hash));
  const [onTalk, setOnTalk] = useState(() => location.hash === TALK_HASH);
  const [onStats, setOnStats] = useState(() => location.hash === STATS_HASH);
  const [onWishes, setOnWishes] = useState(() => location.hash === WISHLIST_HASH);
  const [theme, setTheme] = useStored<Theme>("progressor.theme", undefined);
  const [finished, setFinished] = useStored<Finished>("progressor.finished", undefined);
  const [showHidden, setShowHidden] = useStored<"1">("progressor.show-hidden", undefined);
  const [doneOpen, setDoneOpen] = useStored<"1">("progressor.done-open", undefined);
  /** The finished goal on screen when the Developer closed Finished, so it stays closed for that goal. */
  const [doneClosedFor, setDoneClosedFor] = useStored<string>("progressor.done-closed-for", undefined);
  const [putOff, setPutOff] = useStoredJson<PutOff>("progressor.put-off", {});
  const [editorChoice, setEditorChoice] = useStored<string>("progressor.editor", undefined);
  const [panel, setPanel] = useState<"help" | "settings">();
  const [drawer, setDrawer] = useState(false);
  // On a wide window the sidebar can be folded away; on a narrow one it is a drawer instead.
  const [collapsed, setCollapsed] = useStored<"1">("progressor.sidebar-collapsed", undefined);
  const toggleSidebar = () => (isPhone() ? setDrawer(!drawer) : setCollapsed(collapsed ? undefined : "1"));
  const [servers, reloadServers] = useServers();
  const [query, setQuery] = useState("");
  const hits = useSearch(query);
  const [goalMenu, setGoalMenu] = useState<{ id: string; at: { x: number; y: number } }>();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [toast, toastNode] = useToast();

  // Without a project in the address, the page is Home: every project, or one Workspace's.
  const onHome = !pickedProject;
  const [goalId, setGoalId] = useState<string | undefined>(picked);
  const { info, projects, workspaces, roadmap, goal: shownView, connection, error, refresh } = useDashboard(pickedProject, goalId);
  const stale = usePageStaleness(info, connection);
  const project = projects?.find((p) => p.id === pickedProject);
  const overview = useOverview(true);

  const goals = roadmap?.goals ?? [];
  // Hidden and seen Goals are this browser's view of one project.
  const projectId = pickedProject;
  const [hidden, setHidden] = useStoredJson<string[]>(projectId && `progressor.hidden.${projectId}`, []);
  const [seen, setSeen, visited] = useStoredJson<Seen>(projectId && `progressor.seen.${projectId}`, {});
  const roadmapIsProjects = !!roadmap && roadmap.root === project?.root;
  useEffect(() => {
    if (roadmapIsProjects && !visited) setSeen(seenOnFirstVisit(goals));
  }, [roadmapIsProjects, visited, goals, setSeen]);
  const grouped = groupGoals(goals, { finished: finished ?? "auto", seen: visited ? seen : seenOnFirstVisit(goals), hidden });
  // Without a pick, the Goal on screen stays on screen as the plan changes; the default is chosen once per project.
  const shownBefore = useRef<{ project: string | undefined; goal: string | undefined }>({ project: undefined, goal: undefined });
  const kept = shownBefore.current.project === projectId ? shownBefore.current.goal : undefined;
  const effectiveGoal = onContext || onTalk || onStats || onWishes
    ? undefined
    : picked && goals.some((g) => g.id === picked)
      ? picked
      : kept && goals.some((g) => g.id === kept)
        ? kept
        : defaultGoal([...grouped.open, ...grouped.done]) ?? goals[0]?.id;
  if (roadmapIsProjects && effectiveGoal) shownBefore.current = { project: projectId, goal: effectiveGoal };
  useEffect(() => setGoalId(effectiveGoal), [effectiveGoal]);
  const hideGoal = (id: string, hide: boolean) => {
    setHidden(hide ? [...hidden.filter((h) => h !== id), id] : hidden.filter((h) => h !== id));
    setGoalMenu(undefined);
    if (hide) toast("Hidden from this list; the plan is unchanged. Find it under Hidden.");
  };
  const markSeen = (g: Goal) => {
    if (seen[g.id] !== doneMark(g)) setSeen({ ...seen, [g.id]: doneMark(g) });
  };
  // This project's put-off things to try, by goal ID, for the sidebar.
  const putOffHere: PutOff = Object.fromEntries(
    Object.entries(putOff).flatMap(([k, v]) => (projectId && k.startsWith(`${projectId}/`) ? [[k.slice(projectId.length + 1), v]] : [])),
  );
  const onPutOff = (key: string, untried: number) => {
    setPutOff({ ...putOff, [key]: untried });
    toast("Put off. It comes back when your AI adds something new to try.");
  };

  const editor = editorChoice ?? info?.editor ?? DEFAULT_EDITOR;
  const shownGoal = shownView && shownView.goal.id === effectiveGoal ? shownView : undefined;
  // Looking at a finished Goal is what the green dot asks for; after that it moves to Finished.
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
      setOnTalk(location.hash === TALK_HASH);
      setOnStats(location.hash === STATS_HASH);
      setOnWishes(location.hash === WISHLIST_HASH);
    };
    addEventListener("hashchange", onNavigate);
    addEventListener("popstate", onNavigate);
    return () => {
      removeEventListener("hashchange", onNavigate);
      removeEventListener("popstate", onNavigate);
    };
  }, []);
  const closeAll = () => {
    setSwitcherOpen(false);
    setPanel(undefined);
    if (isPhone()) setDrawer(false);
  };
  const pickGoal = (id: string) => {
    history.replaceState(null, "", `${location.search}#/goal/${encodeURIComponent(id)}`);
    setPicked(id);
    setOnContext(false);
    setOnTalk(false);
    setOnStats(false);
    setOnWishes(false);
    closeAll();
  };
  const openContext = () => {
    history.replaceState(null, "", `${location.search}${CONTEXT_HASH}`);
    setOnContext(true);
    setOnTalk(false);
    setOnStats(false);
    setOnWishes(false);
    closeAll();
  };
  const openTalk = () => {
    history.replaceState(null, "", `${location.search}${TALK_HASH}`);
    setOnTalk(true);
    setOnContext(false);
    setOnStats(false);
    setOnWishes(false);
    closeAll();
  };
  const openStats = () => {
    history.replaceState(null, "", `${location.search}${STATS_HASH}`);
    setOnStats(true);
    setOnContext(false);
    setOnTalk(false);
    setOnWishes(false);
    closeAll();
  };
  const openWishes = () => {
    history.replaceState(null, "", `${location.search}${WISHLIST_HASH}`);
    setOnWishes(true);
    setOnContext(false);
    setOnTalk(false);
    setOnStats(false);
    closeAll();
  };
  const pickProject = (id: string, goalId?: string) => {
    setParams({ project: id, workspace: undefined }, "push");
    if (goalId) history.replaceState(null, "", `${location.search}#/goal/${encodeURIComponent(goalId)}`);
    setPickedProject(id);
    setPicked(goalId);
    setOnContext(false);
    setOnTalk(false);
    setOnStats(false);
    setOnWishes(false);
    closeAll();
    scrollMainToTop();
  };
  const goHome = () => {
    setParams({ project: undefined, workspace: undefined }, "push");
    setPickedProject(undefined);
    setPickedWorkspace(undefined);
    setPicked(undefined);
    setOnContext(false);
    setOnTalk(false);
    setOnStats(false);
    setOnWishes(false);
    closeAll();
  };

  const openHit = (hit: SearchHit) => {
    if (hit.kind === "project") return pickProject(hit.project.id);
    if (hit.kind === "goal") return pickProject(hit.project.id, hit.id);
    if (hit.kind === "task" && hit.goal) return pickProject(hit.project.id, hit.goal.id);
    pickProject(hit.project.id);
  };

  useLayoutEffect(() => {
    const apply = () => {
      if (theme === "vibrant") document.documentElement.dataset.theme = "vibrant";
      else if (isDark(theme)) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
    };
    apply();
    if (theme !== "system") return;
    const system = matchMedia("(prefers-color-scheme: dark)");
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const where = onHome ? (workspaces?.find((w) => w.id === pickedWorkspace)?.name ?? "Home") : undefined;
    document.title = [onContext ? "Project notes" : onTalk ? "Message your AI" : onStats ? "Statistics" : onWishes ? "Wishlist" : shownGoal?.goal.title, project?.name, where, "Progressor"].filter(Boolean).join(" · ");
  }, [shownGoal, project, onHome, onContext, onTalk, onStats, onWishes, workspaces, pickedWorkspace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        setPanel(undefined);
        setGoalMenu(undefined);
        setSwitcherOpen(false);
        setDrawer(false);
      }
      if (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSidebar();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

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

  // The chat working on a Goal, if one holds it: whether it is still open says if the AI stopped.
  const sessionChips = roadmap?.sessions ?? [];
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
  // "updated 2 min ago" moves on by itself.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  const scheduleOf = (id: string): GoalSchedule | undefined => roadmap?.schedule?.goals.find((x) => x.id === id);

  const goalRow = (g: Goal, why?: string) => {
    const fresh = grouped.fresh.has(g.id);
    const working = !why && goalState(stateOf(g)).state === "working";
    return (
      <button key={g.id} className={`goal-row ${g.status} ${why ? "you" : ""} ${working ? "working" : ""}`} aria-current={!onContext && g.id === effectiveGoal}
        title={[g.title, why, "Right-click to hide it from this list."].filter(Boolean).join("\n")}
        onClick={() => pickGoal(g.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setGoalMenu({ id: g.id, at: { x: e.clientX, y: e.clientY } });
        }}>
        <Ring done={g.done} total={g.total} finished={g.status === "done"} />
        <span className="t">{g.title}{fresh && <span className="fresh" role="img" aria-label="finished, not looked at yet" />}</span>
        <span className="n">{g.total ? `${g.done}/${g.total}` : ""}</span>
        {why && <span className="why">{why}</span>}
      </button>
    );
  };
  const menuGoal = goalMenu && goals.find((g) => g.id === goalMenu.id);
  const openPanel = (which: "help" | "settings") => {
    setPanel(panel === which ? undefined : which);
    if (which === "settings") reloadServers();
  };
  const unanswered = (roadmap?.projectTalk?.messages ?? []).filter((m) => m.state !== "replied").length;
  const clearFinished = (list: Goal[]) => {
    setHidden(hideAll(hidden, list.map((g) => g.id)));
    toast(`Cleared ${list.length} finished ${list.length === 1 ? "goal" : "goals"}. The plan keeps them; find them under Hidden.`);
  };
  const freshGoals = grouped.open.filter((g) => grouped.fresh.has(g.id));
  const doneShown = groupOpen({ pinned: !!doneOpen, closedFor: doneClosedFor, holdsShown: grouped.done.some((g) => g.id === effectiveGoal), shown: effectiveGoal });

  const main = error && !projects ? (
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
  ) : onHome ? (
    <Home overview={overview} workspaces={workspaces ?? []} only={pickedWorkspace} query={query} hits={hits}
      putOff={putOff} onPutOff={onPutOff} onOpen={pickProject} onOpenStats={(id) => { pickProject(id); openStats(); }} onShowAll={goHome} />
  ) : roadmap === null || (roadmap === undefined && !project) ? (
    <div className="placeholder">
      <h2>Nothing planned here yet</h2>
      Tell your AI what you want to build in this project. Its plan shows up here by itself.
      <div><button className="btn ghost" onClick={goHome}>Back to Home</button></div>
    </div>
  ) : !roadmap ? (
    <div className="placeholder">Loading…</div>
  ) : onStats && projectId ? (
    <StatsPage projectId={projectId} roadmap={roadmap} onOpenGoal={pickGoal} />
  ) : onWishes && projectId ? (
    <WishlistPage projectId={projectId} wishes={roadmap.wishes} onChanged={refresh} />
  ) : onContext && projectId ? (
    <ContextPage projectId={projectId} rules={roadmap.standingInstructions} context={roadmap.context} onChanged={refresh} />
  ) : onTalk && projectId ? (
    <div className="page">
      <h1 className="page-title">Message your AI</h1>
      <p className="page-sub">
        For anything about the whole project, such as "stop everything" or "start on the logo next". Any AI chat working in this project reads it at its
        next step, or as soon as you type in the chat, and answers here.
      </p>
      <div className="section">
        <Conversation projectId={projectId} goalId={PROJECT_TALK} onChanged={refresh}
          view={{ messages: roadmap.projectTalk?.messages ?? [], questions: [], graph: { nodes: [], edges: [] } }} />
      </div>
    </div>
  ) : goals.length === 0 ? (
    <div className="placeholder">
      <h2>No goals yet</h2>
      Tell your AI what you want to build. It plans the work as a goal with steps, and this page follows along by itself.
    </div>
  ) : !shownGoal || !projectId ? (
    <div className="placeholder">Loading…</div>
  ) : (
    <ErrorBoundary scope="goal" key={`${projectId}:${shownGoal.goal.id}`}>
      <GoalPage projectId={projectId} view={shownGoal} goals={goals} state={stateOf(shownGoal.goal)} schedule={scheduleOf(shownGoal.goal.id)}
        fileLink={fileLink} onCopy={copy} onChanged={refresh}
        onReveal={(path) =>
          void showInFolder(projectId, path).then(
            () => toast("Opened the folder in your file manager."),
            (e: Error) => toast(`Could not open the folder: ${e.message}`),
          )
        } />
    </ErrorBoundary>
  );

  return (
    <>
      <header className="topbar">
        <button className="iconbtn menu-btn-phone" aria-label={drawer ? "Close the menu" : "Open the menu"} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
          <Icon name={drawer ? "close" : "menu"} size={18} />
        </button>
        <button className="iconbtn side-toggle" aria-label={collapsed ? "Show the sidebar" : "Hide the sidebar"} aria-expanded={!collapsed}
          title={`${collapsed ? "Show" : "Hide"} the sidebar (shortcut: [ )`} onClick={toggleSidebar}>
          <Icon name="menu" size={18} />
        </button>
        <button className="brand" onClick={goHome} title="Home: what needs you across every project">
          <span className="mark" aria-hidden="true" />
          <span className="word">Progressor</span>
        </button>
        {project && (
          <span className="crumb">
            <span className="sep" aria-hidden="true">/</span>
            <button className="project-btn" aria-haspopup="listbox" aria-expanded={switcherOpen} title={`${project.name}, in ${project.root}`}
              onClick={() => setSwitcherOpen(!switcherOpen)}>
              <span className="name">{project.name}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          </span>
        )}
        <span className="sp" />
        <SearchBox query={query} hits={hits} onChange={setQuery} onOpen={openHit} />
        <span className={`live ${connection === "live" ? "" : "off"}`} role="status"
          title={connection === "live" ? "Live: this page updates by itself as your AI works." : "Lost touch with Progressor. It comes back by itself once your AI chat is open again."}
          aria-label={connection === "live" ? "Live" : "Reconnecting"} />
        <button className={`iconbtn menu-btn ${panel === "help" ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={panel === "help"}
          title="Help" aria-label="Help" onClick={() => openPanel("help")}>
          <Icon name="help" size={18} />
        </button>
        <button className={`iconbtn menu-btn ${panel === "settings" ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={panel === "settings"}
          title="Settings" aria-label="Settings" onClick={() => openPanel("settings")}>
          <Icon name="settings" size={18} />
        </button>
      </header>
      {stale && (
        <div className={`stale-bar ${stale.kind}`} role="status">
          <Icon name="refresh" size={16} />
          <span>{stale.text}</span>
          <button className="btn small" onClick={() => (stale.kind === "updated" ? location.reload() : refresh())}>Refresh</button>
        </div>
      )}

      {switcherOpen && (
        <ProjectList current={projectId} projects={projects ?? []} onPick={(id) => pickProject(id)} onHome={goHome} onClose={() => setSwitcherOpen(false)} />
      )}

      {panel === "settings" && (
        <MenuPanel label="Settings" onClose={() => setPanel(undefined)}>
          <section>
            <h3>Theme</h3>
            <Choice value={theme ?? "light"} onChange={(t) => setTheme(t === "light" ? undefined : t)}
              options={[
                { value: "light", label: "Light", hint: "Always light" },
                { value: "dark", label: "Dark", hint: "Always dark" },
                { value: "system", label: "System", hint: "Light or dark, following your computer's setting" },
                { value: "vibrant", label: "Vibrant", hint: "Colourful: an indigo accent, green for done and amber for what needs you" },
              ]} />
          </section>
          <section>
            <h3>Finished goals</h3>
            <label className="option">
              <input type="radio" name="finished" checked={finished !== "review"} onChange={() => setFinished(undefined)} />
              <span><b>Move to Finished straight away</b><small>Finished goals fold away as soon as they finish. The usual choice.</small></span>
            </label>
            <label className="option">
              <input type="radio" name="finished" checked={finished === "review"} onChange={() => setFinished("review")} />
              <span><b>Wait for me to look</b><small>A finished goal stays under Just finished until you open it.</small></span>
            </label>
          </section>
          <details className="advanced">
            <summary title="Options for people who look at the code">Advanced</summary>
            <section>
              <h3>Open files in</h3>
              <select className="picker" aria-label="Open files in" title="The code editor that opens when you click a file name on a step"
                value={editor} onChange={(e) => setEditorChoice(e.target.value === info?.editor ? undefined : e.target.value)}>
                {info?.editor && !EDITORS.includes(info.editor) && <option value={info.editor}>Custom (PROGRESSOR_EDITOR)</option>}
                {EDITORS.filter((e) => e !== "jetbrains").map((e) => (
                  <option key={e} value={e}>{editorName(e)}</option>
                ))}
              </select>
            </section>
            <section>
              <h3>Things to try you put off</h3>
              <button className="btn ghost small" disabled={Object.keys(putOff).length === 0}
                onClick={() => {
                  setPutOff({});
                  toast("Everything you put off is back under Needs you.");
                }}>
                Bring them all back
              </button>
            </section>
            <ServersPanel servers={servers} hub={info} reload={reloadServers} toast={toast} />
          </details>
          <section>
            <h3>Support Progressor</h3>
            <a className="card" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              Buy me a coffee
              <small>Progressor is free and open source. If it keeps you on track, a coffee keeps it going.</small>
            </a>
          </section>
          <p className="hint">Settings are saved in this browser.</p>
        </MenuPanel>
      )}

      {panel === "help" && (
        <MenuPanel label="Help" onClose={() => setPanel(undefined)}>
          <section>
            <h3>What the marks on a step mean</h3>
            <StepKey statuses={[]} all />
          </section>
          <section>
            <h3>Facing a problem?</h3>
            <a className="card" href={issueUrl("bug", { version: info?.version, system: describeSystem(navigator.userAgent) })} target="_blank" rel="noopener noreferrer">
              Report a problem
              <small>Opens a GitHub issue with your Progressor version and system already filled in.</small>
            </a>
            <a className="card" href={issueUrl("idea", { version: info?.version })} target="_blank" rel="noopener noreferrer">
              Suggest an idea or share feedback
              <small>What would make Progressor work better for you? Every suggestion is read.</small>
            </a>
            <p className="hint">
              Someone may have hit it already: <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">see the open issues</a>
              {info?.version && <> · Progressor {info.version}</>}
            </p>
          </section>
        </MenuPanel>
      )}

      <div className={`shell ${drawer ? "side-open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar" aria-label={onHome ? "Projects" : "Your goals"}>
          <button className="side-link" aria-current={onHome} onClick={goHome}>
            <Icon name="home" /> Home
          </button>
          {onHome ? (
            <div className="side-group">
              <h3>Projects</h3>
              {sortProjects(projects ?? []).map((p) => (
                <button key={p.id} className="side-link" onClick={() => pickProject(p.id)} title={p.root}>
                  <Icon name="file" /> {p.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="side-link" aria-current={onTalk} onClick={openTalk} title="Write to your AI about the whole project, not one goal">
                <Icon name="send" /> Message your AI
                {unanswered > 0 && <span className="n" title="Messages your AI has not answered yet">{unanswered}</span>}
              </button>
              <button className="side-link" aria-current={onContext} onClick={openContext} title="The rules and background your AI keeps for this project">
                <Icon name="note" /> Project notes
              </button>
              <button className="side-link" aria-current={onWishes} onClick={openWishes} title="What you want from this project as a whole; your AI may suggest goals from it">
                <Icon name="star" /> Wishlist
              </button>
              <button className="side-link" aria-current={onStats} onClick={openStats} title="How long steps take, how often work drifts, and what was finished each day">
                <Icon name="chart" /> Statistics
              </button>
              {roadmap && goals.length === 0 && <p className="empty">No goals yet. Tell your AI what you want to build.</p>}
              {sidebarSections(grouped.open.filter((g) => !grouped.fresh.has(g.id)), putOffHere).map((s) => (
                <div key={s.label} className={`side-group ${s.label === "Needs you" ? "needs" : ""}`}>
                  <h3>{s.label}</h3>
                  {s.goals.map((g) => goalRow(g, s.label === "Needs you" ? needsWhy(g, putOffHere[g.id]).why : undefined))}
                </div>
              ))}
              {freshGoals.length > 0 && (
                <div className="side-group">
                  <h3>Just finished <button className="linkbtn" title="Clears these from the list. The plan keeps them; find them under Hidden." onClick={() => clearFinished(freshGoals)}>Clear all</button></h3>
                  {freshGoals.map((g) => goalRow(g))}
                </div>
              )}
              {grouped.done.length > 0 && (
                <div className="side-group">
                  <div className="fold-row">
                    <button className="fold" aria-expanded={doneShown} onClick={() => {
                      setDoneOpen(doneShown ? undefined : "1");
                      setDoneClosedFor(doneShown ? effectiveGoal : undefined);
                    }}>
                      <Icon name={doneShown ? "chevronDown" : "chevronRight"} size={14} /> Finished <span className="n">{grouped.done.length}</span>
                    </button>
                    <button className="linkbtn" title="Clears every finished goal from this list. The plan keeps them; find them under Hidden."
                      onClick={() => clearFinished(grouped.done)}>
                      Clear all
                    </button>
                  </div>
                  {doneShown && grouped.done.map((g) => goalRow(g))}
                </div>
              )}
              {grouped.hidden.length > 0 && (
                <div className="side-group">
                  <button className="fold" aria-expanded={!!showHidden} title="Goals you hid from this list; the plan still has them" onClick={() => setShowHidden(showHidden ? undefined : "1")}>
                    <Icon name={showHidden ? "chevronDown" : "chevronRight"} size={14} /> Hidden <span className="n">{grouped.hidden.length}</span>
                  </button>
                  {showHidden && grouped.hidden.map((g) => goalRow(g))}
                </div>
              )}
              {(roadmap?.resources ?? []).length > 0 && (
                <div className="side-foot" title="Something only one AI chat or helper can use at a time. It is marked so the others wait.">
                  {roadmap!.resources!.map((l) => (
                    <span key={l.resource} className="line"><Icon name="lock" size={12} /> {resourceWords(l, new Date())}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
        <div className="scrim" onClick={() => setDrawer(false)} />
        <main className="main" id="main">{main}</main>
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
      {toastNode}
    </>
  );
}

/** The Developer's Buy Me a Coffee page, shown in Settings. */
const SUPPORT_URL = "https://buymeacoffee.com/rachitasthana";

const scrollMainToTop = () => document.getElementById("main")?.scrollTo({ top: 0 });

/** The project switcher under the project's name in the top bar. */
function ProjectList({ current, projects, onPick, onHome, onClose }: {
  current: string | undefined;
  projects: { id: string; name: string; root: string }[];
  onPick: (id: string) => void;
  onHome: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".project-list") && !t.closest(".project-btn")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  const at = document.querySelector(".project-btn")?.getBoundingClientRect();
  return (
    <div className="project-list" role="listbox" aria-label="Projects" style={{ left: Math.max(12, at?.left ?? 12) }}>
      <button className="project" role="option" aria-selected={false} onClick={onHome}>
        <span className="t">Home</span>
        <span className="path">Every project at a glance</span>
      </button>
      {sortProjects(projects).map((p) => (
        <button key={p.id} className="project" role="option" aria-selected={p.id === current} onClick={() => onPick(p.id)}>
          <span className="t">{p.name}</span>
          <span className="path">{p.root}</span>
        </button>
      ))}
    </div>
  );
}
