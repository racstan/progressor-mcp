import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_EDITOR, editorUrl } from "../dashboard/editor.js";
import type { GoalSchedule } from "../schedule.js";
import { type RoadmapView, showInFolder, useDashboard, useOverview, useSearch, useServers, usePageStaleness, useSettings, useStored, useStoredJson, renewPhoneTopic, resetComputerSettings, saveSettings } from "./data.js";
import { HotfixPage } from "./HotfixPage.js";
import { WhatsNew, changelog } from "./WhatsNew.js";
import { ContextPage } from "./ContextPage.js";
import { WishlistPage } from "./WishlistPage.js";
import { StatsPage } from "./StatsPage.js";
import { HistoryPage } from "./HistoryPage.js";
import { HandoffsPage } from "./HandoffsPage.js";
import { CalendarPage } from "./CalendarPage.js";
import { PAGE_HASH, PAGE_TITLE, type Page, type Route, breadcrumbs, newHash, pageHeading, routeFromHash, tabTitle } from "./route.js";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { describeSystem, ISSUES_URL, issueUrl } from "./feedback.js";
import { type Finished, type Seen, doneMark, groupGoals, groupOpen, hideAll, seenOnFirstVisit } from "./goalList.js";
import { GoalPage } from "./GoalPage.js";
import { Home } from "./HomePage.js";
import { type PutOff, needsWhy, sidebarSections } from "./home.js";
import { Icon, Ring } from "./Icon.js";
import { GoalMenu, MenuPanel } from "./Menus.js";
import { sortProjects } from "./projectList.js";
import { type SearchHit, SearchBox } from "./Search.js";
import { Conversation } from "./Talk.js";
import { latestReply, unreadReplies } from "./talkView.js";
import { type Snapshot, finishedNote, newlyFinished, snapshot } from "./notify.js";
import { Settings } from "./Settings.js";
import { FreeNotice } from "./FreeNotice.js";
import { canPopUp, editorName } from "./settings/Look.js";
import type { SettingsContext, Theme } from "./settings/index.js";
import { StepKey } from "./StepKey.js";
import { Tour } from "./Tour.js";
import { markTourSeen, tourSeen } from "./tourSteps.js";
import type { FileLink } from "./Steps.js";
import { goalState, resourceWords } from "./words.js";

type Goal = RoadmapView["goals"][number];

/** The Goal shown first: one waiting on the Developer, else one being worked on, else a paused one, else the next planned one. */
function defaultGoal(goals: Goal[]): string | undefined {
  const waiting = goals.find((g) => g.waitingOnYou && (g.status === "active" || g.status === "paused" || g.status === "testing"));
  if (waiting) return waiting.id;
  for (const status of ["active", "paused", "planned", "done"])
    for (const g of goals) if (g.status === status) return g.id;
  return goals[0]?.id;
}

/** The talk with the whole project, in the dashboard's API: the goal routes with this ID (project.ts). */
const PROJECT_TALK = "_project";

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
  // The page shown, from the address's hash (route.ts): a goal's, or one of the other pages.
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash));
  // An old address (#/stats) opens its page under the new one (#/dashboard).
  useEffect(() => {
    const moved = () => {
      const to = newHash(location.hash);
      if (to) history.replaceState(null, "", `${location.pathname}${location.search}${to}`);
    };
    moved();
    addEventListener("hashchange", moved);
    return () => removeEventListener("hashchange", moved);
  }, []);
  const { page, goal: picked } = route;
  const [theme, setTheme] = useStored<Theme>("progressor.theme", undefined);
  const [finished, setFinished] = useStored<Finished>("progressor.finished", undefined);
  const [showHidden, setShowHidden] = useStored<"1">("progressor.show-hidden", undefined);
  const [doneOpen, setDoneOpen] = useStored<"1">("progressor.done-open", undefined);
  /** The finished goal on screen when the Developer closed Finished, so it stays closed for that goal. */
  const [doneClosedFor, setDoneClosedFor] = useStored<string>("progressor.done-closed-for", undefined);
  const [putOff, setPutOff] = useStoredJson<PutOff>("progressor.put-off", {});
  const [editorChoice, setEditorChoice] = useStored<string>("progressor.editor", undefined);
  const [panel, setPanel] = useState<"help">();
  const [showChanges, setShowChanges] = useState(false);
  const [seenChanges, setSeenChanges] = useStored<string>("progressor.seenChanges", undefined);
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
  // The first-run tour: once per browser, never when the browser can't remember it (tourSteps.ts), and again from Help.
  const [touring, setTouring] = useState(false);
  const browserStore = () => {
    try {
      return localStorage;
    } catch {
      return { getItem: () => { throw new Error("no storage"); }, setItem: () => undefined };
    }
  };

  // Without a project in the address, the page is Home: every project, or one Workspace's.
  const onHome = !pickedProject;
  const [goalId, setGoalId] = useState<string | undefined>(picked);
  const { info, projects, workspaces, roadmap, goal: shownView, connection, error, refresh } = useDashboard(pickedProject, goalId);
  const stale = usePageStaleness(info, connection);
  const project = projects?.find((p) => p.id === pickedProject);
  const overview = useOverview(true);
  const [popUps, setPopUps] = useStored<"on">("progressor.pop-ups", undefined);
  const lastLook = useRef<Snapshot | undefined>(undefined);

  const goals = roadmap?.goals ?? [];
  // Hidden and seen Goals are this browser's view of one project.
  const projectId = pickedProject;
  const [hidden, setHidden] = useStoredJson<string[]>(projectId && `progressor.hidden.${projectId}`, []);
  const [seen, setSeen, visited] = useStoredJson<Seen>(projectId && `progressor.seen.${projectId}`, {});
  // When this browser last read the AI's replies to messages about the whole project (talkView.ts).
  const [readReplies, setReadReplies, readBefore] = useStoredJson<string>(projectId && `progressor.read-replies.${projectId}`, "");
  const roadmapIsProjects = !!roadmap && roadmap.root === project?.root;
  useEffect(() => {
    if (roadmapIsProjects && !visited) setSeen(seenOnFirstVisit(goals));
  }, [roadmapIsProjects, visited, goals, setSeen]);
  const grouped = groupGoals(goals, { finished: finished ?? "auto", seen: visited ? seen : seenOnFirstVisit(goals), hidden });
  // Without a pick, the Goal on screen stays on screen as the plan changes; the default is chosen once per project.
  const shownBefore = useRef<{ project: string | undefined; goal: string | undefined }>({ project: undefined, goal: undefined });
  const kept = shownBefore.current.project === projectId ? shownBefore.current.goal : undefined;
  const effectiveGoal = page !== "goal"
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
      setRoute(routeFromHash(location.hash));
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
  /** Shows a page of the project (or Home, for Settings), keeping the project in the address. */
  const show = (r: Route) => {
    const hash = r.page === "goal" ? (r.goal ? `#/goal/${encodeURIComponent(r.goal)}` : "") : PAGE_HASH[r.page];
    history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
    setRoute(r);
    closeAll();
  };
  const pickGoal = (id: string) => show({ page: "goal", goal: id });
  const openPage = (p: Exclude<Page, "goal">) => show({ page: p });
  const pickProject = (id: string, goalId?: string) => {
    setParams({ project: id, workspace: undefined }, "push");
    if (goalId) history.replaceState(null, "", `${location.search}#/goal/${encodeURIComponent(goalId)}`);
    setPickedProject(id);
    setRoute({ page: "goal", ...(goalId ? { goal: goalId } : {}) });
    closeAll();
    scrollMainToTop();
  };
  // A desktop pop-up for each goal that finished since the last look at every project (notify.ts).
  useEffect(() => {
    if (!overview) return;
    const finished = newlyFinished(lastLook.current, overview);
    lastLook.current = snapshot(overview);
    if (popUps !== "on" || canPopUp() !== "granted") return;
    for (const f of finished) {
      const { title, body, tag } = finishedNote(f);
      const pop = new Notification(title, { body, tag });
      pop.onclick = () => {
        window.focus();
        pickProject(f.project.id, f.goal.id);
        pop.close();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);
  const switchPopUps = async (on: boolean) => {
    if (!on) return setPopUps(undefined);
    if (canPopUp() === "unsupported") return toast("This browser can't show desktop pop-ups.");
    const answer = await Notification.requestPermission();
    if (answer !== "granted") return toast("Your browser didn't allow pop-ups. Allow notifications for this site in the browser's settings, then try again.");
    setPopUps("on");
    new Notification("Pop-ups are on", { body: "You'll get one like this when a goal is finished.", tag: "progressor-pop-ups-on" });
  };
  // The settings for how Progressor works, kept on this computer, as they are for the project shown.
  const [computer, setComputer] = useSettings(projectId);
  const settingsContext: SettingsContext = {
    theme, setTheme, popUps, switchPopUps, setPopUps, finished, setFinished,
    editor, info, setEditorChoice, putOff, setPutOff,
    servers, reloadServers: reloadServers, toast,
    computer, projectId,
    save: async (section, values, forProject) => setComputer(await saveSettings(section, values, forProject ? projectId : undefined)),
    resetComputer: async (section) => setComputer(await resetComputerSettings(section)),
    renewTopic: async () => setComputer(await renewPhoneTopic()),
  };
  const goHome = () => {
    setParams({ project: undefined, workspace: undefined }, "push");
    setPickedProject(undefined);
    setPickedWorkspace(undefined);
    setRoute({ page: "goal" });
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
      // Vibrant is the default: no choice stored means Vibrant
      if (theme === undefined || theme === "vibrant") document.documentElement.dataset.theme = "vibrant";
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
    document.title = tabTitle({ page: onHome && page !== "settings" ? "goal" : page, ...(project ? { project: project.name } : {}), ...(shownGoal ? { goal: shownGoal.goal.title } : {}), ...(where ? { home: where } : {}) });
  }, [shownGoal, project, onHome, page, workspaces, pickedWorkspace]);

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
  const stateOf = (g: Pick<Goal, "id" | "status" | "updatedAt" | "waitingOnYou" | "counts" | "fromElsewhere"> & { blocked?: boolean }) => {
    const s = sessionChips.find((x) => x.goal === g.id);
    return {
      status: g.status,
      updatedAt: g.updatedAt,
      running: s?.running,
      waitingOnYou: g.waitingOnYou,
      helpers: g.counts["with a helper"],
      fromElsewhere: g.fromElsewhere,
      blocked: g.blocked,
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
      <button key={g.id} className={`goal-row ${g.status} ${why ? "you" : ""} ${working ? "working" : ""}`} aria-current={page === "goal" && g.id === effectiveGoal}
        title={[g.title, why, "Right-click to hide it from this list."].filter(Boolean).join("\n")}
        onClick={() => pickGoal(g.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setGoalMenu({ id: g.id, at: { x: e.clientX, y: e.clientY } });
        }}>
        <Ring done={g.done} total={g.total} finished={g.status === "done"} />
        <span className="t">{g.hotfix && g.status !== "done" && <span className="hotfix-tag" title="A bug to fix before anything else">Hotfix</span>}{g.title}{fresh && <span className="fresh" role="img" aria-label="finished, not looked at yet" />}</span>
        <span className="n">{g.total ? `${g.done}/${g.total}` : ""}</span>
        {why && <span className="why">{why}</span>}
      </button>
    );
  };
  const menuGoal = goalMenu && goals.find((g) => g.id === goalMenu.id);
  const latest = changelog.releases[0];
  /** A release this browser has not opened What's new for yet. */
  const unseen = !!latest && seenChanges !== latest.title;
  const openChanges = () => {
    setPanel(undefined);
    setShowChanges(true);
    if (latest) setSeenChanges(latest.title);
  };
  const closeChanges = useCallback(() => setShowChanges(false), []);
  const closeTour = useCallback(() => setTouring(false), []);
  // Shown once the page has something on it, the first time this browser opens the dashboard.
  const loaded = projects !== undefined;
  useEffect(() => {
    if (!loaded) return;
    const store = browserStore();
    if (tourSeen(store)) return;
    markTourSeen(store);
    setTouring(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  const openPanel = (which: "help") => setPanel(panel === which ? undefined : which);
  // The Settings page lists the running servers; look again each time it opens.
  useEffect(() => {
    if (page === "settings") reloadServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const projectMessages = roadmapIsProjects ? (roadmap?.projectTalk?.messages ?? []) : [];
  const newestReply = latestReply(projectMessages);
  // Reading the page reads every reply; a browser opening the project for the first time starts with none unread.
  useEffect(() => {
    if (!roadmapIsProjects) return;
    if ((page === "talk" || !readBefore) && (newestReply ?? "1970-01-01T00:00:00.000Z") > readReplies) setReadReplies(newestReply ?? "1970-01-01T00:00:00.000Z");
  }, [roadmapIsProjects, page, readBefore, newestReply, readReplies, setReadReplies]);
  const unread = page === "talk" ? 0 : unreadReplies(projectMessages, readReplies || undefined);
  const clearFinished = (list: Goal[]) => {
    setHidden(hideAll(hidden, list.map((g) => g.id)));
    toast(`Cleared ${list.length} finished ${list.length === 1 ? "goal" : "goals"}. The plan keeps them; find them under Hidden.`);
  };
  const freshGoals = grouped.open.filter((g) => grouped.fresh.has(g.id));
  const doneShown = groupOpen({ pinned: !!doneOpen, closedFor: doneClosedFor, holdsShown: grouped.done.some((g) => g.id === effectiveGoal), shown: effectiveGoal });

  // The page's heading, named after its project: "Bindery Dashboard".
  const heading = page === "goal" ? "" : pageHeading(page, project?.name);
  const main = page === "settings" ? (
    <Settings ctx={settingsContext} />
  ) : error && !projects ? (
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
      putOff={putOff} onPutOff={onPutOff} onOpen={pickProject} onOpenStats={(id) => { pickProject(id); openPage("dashboard"); }} onShowAll={goHome} />
  ) : roadmap === null || (roadmap === undefined && !project) ? (
    <div className="placeholder">
      <h2>Nothing planned here yet</h2>
      Tell your AI what you want to build in this project. Its plan shows up here by itself.
      <div><button className="btn ghost" onClick={goHome}>Back to Home</button></div>
    </div>
  ) : !roadmap ? (
    <div className="placeholder">Loading…</div>
  ) : page === "dashboard" && projectId ? (
    <StatsPage heading={heading} projectId={projectId} roadmap={roadmap} onOpenGoal={pickGoal} />
  ) : page === "history" && projectId ? (
    <HistoryPage heading={heading} projectId={projectId} roadmap={roadmap} toast={toast} />
  ) : page === "handoffs" && projectId ? (
    <HandoffsPage heading={heading} projectId={projectId} roadmap={roadmap} toast={toast} />
  ) : page === "calendar" && projectId ? (
    <CalendarPage heading={heading} projectId={projectId} roadmap={roadmap} onOpenGoal={pickGoal} />
  ) : page === "hotfix" && projectId ? (
    <HotfixPage heading={heading} projectId={projectId} goals={roadmap.goals} onOpen={pickGoal} onAdded={(id) => { refresh(); pickGoal(id); toast("Hotfix added. Your AI takes it as soon as it finishes the step it is on."); }} />
  ) : page === "wishlist" && projectId ? (
    <WishlistPage heading={heading} projectId={projectId} wishes={roadmap.wishes} onChanged={refresh} />
  ) : page === "context" && projectId ? (
    <ContextPage heading={heading} projectId={projectId} rules={roadmap.standingInstructions} context={roadmap.context} onChanged={refresh} version={roadmap} />
  ) : page === "talk" && projectId ? (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
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

  // Home › project › page, at the top of every page; Home shows itself for a project's page opened without a project.
  const trail = breadcrumbs({
    page: onHome && page !== "settings" ? "goal" : page,
    ...(project ? { project: project.name } : {}),
    ...(onHome && pickedWorkspace ? { workspace: workspaces?.find((w) => w.id === pickedWorkspace)?.name ?? "Workspace" } : {}),
    ...(shownGoal ? { goal: shownGoal.goal.title } : {}),
  });

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
          <img className="mark" src="/logo.png" alt="" aria-hidden="true" />
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
          title={unseen ? "Help · What's new in this version" : "Help"} aria-label="Help" onClick={() => openPanel("help")}>
          <Icon name="help" size={18} />
          {unseen && <span className="new-dot" aria-hidden="true" />}
        </button>
        <button data-tour="settings" className={`iconbtn ${page === "settings" ? "on" : ""}`} aria-current={page === "settings" ? "page" : undefined}
          title="Settings" aria-label="Settings" onClick={() => openPage("settings")}>
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

      {panel === "help" && (
        <MenuPanel label="Help" onClose={() => setPanel(undefined)}>
          <section>
            <h3>What's new</h3>
            <button className="card" onClick={openChanges}>
              {unseen && <span className="release-tag new">New</span>} {latest ? `${latest.version}${latest.name ? ` · ${latest.name}` : ""}` : "What's new"}
              <small>What changed in each version of Progressor.</small>
            </button>
          </section>
          <section>
            <h3>New here?</h3>
            <button className="card" onClick={() => { setPanel(undefined); setTouring(true); }}>
              Take the tour again
              <small>A short walk past the main parts of the dashboard. Skip it at any time.</small>
            </button>
          </section>
          <section>
            <h3>What the marks on a step mean</h3>
            <StepKey statuses={[]} all />
          </section>
          <section>
            <h3>Facing a problem?</h3>
            <a className="card" href={issueUrl("bug", { version: info?.version, system: describeSystem(navigator.userAgent) })} target="_blank" rel="noopener noreferrer">
              Report a problem with Progressor
              <small>A problem with Progressor itself, not your project: opens a GitHub issue with your Progressor version and system filled in. For a bug in your own project, use Hotfixes.</small>
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
          <FreeNotice />
        </MenuPanel>
      )}

      {touring && <Tour onClose={closeTour} />}
      {showChanges && <WhatsNew version={info?.version} onClose={closeChanges} />}

      <div className={`shell ${drawer ? "side-open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar" aria-label={onHome ? "Projects" : "Your goals"}>
          <button className="side-link" data-tour="home" aria-current={onHome && page !== "settings"} onClick={goHome}>
            <Icon name="home" /> Home
          </button>
          {onHome ? (
            <>
              <button className="side-link" aria-current={page === "settings"} onClick={() => openPage("settings")} title="How the page looks, notifications, and how your AI plans. All optional">
                <Icon name="settings" /> Settings
              </button>
              <div className="side-group">
                <h3>Projects</h3>
                {sortProjects(projects ?? []).map((p) => (
                  <button key={p.id} className="side-link" onClick={() => pickProject(p.id)} title={p.root}>
                    <Icon name="file" /> {p.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="side-group project-links" data-tour="project">
                <h3 title={project?.root}>{project?.name ?? "This project"}</h3>
                <button className="side-link" data-tour="dashboard" aria-current={page === "dashboard"} onClick={() => openPage("dashboard")} title={`${project?.name ?? "This project"}: how long steps take, how often work drifts, and what was finished each day`}>
                  <Icon name="chart" /> Dashboard
                </button>
                <button className="side-link" aria-current={page === "hotfix"} onClick={() => openPage("hotfix")} title="Urgent bugs in this project, fixed before anything else: your AI finishes the step it is on, then fixes it, test first">
                  <Icon name="flag" /> Hotfixes
                </button>
                <button className="side-link" data-tour="talk" aria-current={page === "talk"} onClick={() => openPage("talk")} title="Write to your AI about the whole project, not one goal">
                  <Icon name="send" /> Message your AI
                  {unread > 0 && <span className="n" title="New replies from your AI you haven't read yet">{unread}</span>}
                </button>
                <button className="side-link" aria-current={page === "context"} onClick={() => openPage("context")} title="The rules and background your AI keeps for this project">
                  <Icon name="note" /> Project notes
                </button>
                <button className="side-link" aria-current={page === "wishlist"} onClick={() => openPage("wishlist")} title="What you want from this project as a whole; your AI may suggest goals from it">
                  <Icon name="star" /> Wishlist
                </button>
                <button className="side-link" aria-current={page === "calendar"} onClick={() => openPage("calendar")} title="What your AI did and what comes next, by month, week or day">
                  <Icon name="calendar" /> Calendar
                </button>
                <button className="side-link" aria-current={page === "history"} onClick={() => openPage("history")} title="Every change to the plan, by you or your AI, and going back to before any of them">
                  <Icon name="history" /> History
                </button>
                <button className="side-link" aria-current={page === "handoffs"} onClick={() => openPage("handoffs")} title="Write-ups of the work your AI did, for whoever picks it up next">
                  <Icon name="note" /> Handoffs
                </button>
              </div>
              <button className="side-link" aria-current={page === "settings"} onClick={() => openPage("settings")} title="How the page looks, notifications, and how your AI plans, for every project. All optional">
                <Icon name="settings" /> Settings
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
        <main className="main" id="main">
          <Breadcrumbs trail={trail} onHome={goHome} onProject={() => projectId && pickProject(projectId)} />
          {main}
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
      {toastNode}
    </>
  );
}

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
