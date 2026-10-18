import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_EDITOR, EDITORS, editorUrl, parseCodeRef } from "../dashboard/editor.js";
import { type DetourNode, type GoalGraph, type TaskNode, withoutDetours } from "../dashboard/graph.js";
import { type PromptSubject, copyAsPrompt } from "../dashboard/prompt.js";
import { type GoalView, type RoadmapView, useDashboard, useStored } from "./data.js";
import { STATUS_LABEL } from "./geometry.js";
import { MetroMap } from "./MetroMap.js";

type Goal = RoadmapView["goals"][number];
type Theme = "light" | "dark";

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

/** Light unless the Developer picked dark; the operating system's setting is not followed. */
const isDark = (theme: Theme | undefined) => theme === "dark";

const projectFromUrl = () => new URLSearchParams(location.search).get("project") ?? undefined;

export function App() {
  const [pickedProject, setPickedProject] = useState<string | undefined>(projectFromUrl);
  const [picked, setPicked] = useState<string | undefined>(goalFromHash);
  const [detours, setDetours] = useState(true);
  const [theme, setTheme] = useStored<Theme>("progressor.theme", undefined);
  const [collapsed, setCollapsed] = useStored<"1">("progressor.sidebar-collapsed", undefined);
  const [editorChoice, setEditorChoice] = useStored<string>("progressor.editor", undefined);
  const [menuOpen, setMenuOpen] = useState(false);
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
      history.replaceState(null, "", `?project=${encodeURIComponent(effectiveProject)}${location.hash}`);
  }, [effectiveProject]);

  const goals = roadmap?.goals ?? [];
  const effectiveGoal = picked && goals.some((g) => g.id === picked) ? picked : defaultGoal(goals);
  useEffect(() => setGoalId(effectiveGoal), [effectiveGoal]);

  const editor = editorChoice ?? info?.editor ?? DEFAULT_EDITOR;
  const shownGoal = goal && goal.goal.id === effectiveGoal ? goal : undefined;

  useEffect(() => {
    const onNavigate = () => {
      setPickedProject(projectFromUrl());
      setPicked(goalFromHash());
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
    history.pushState(null, "", `?project=${encodeURIComponent(id)}`);
    setPickedProject(id);
    setPicked(undefined);
    closeDrawerOnNarrow();
  };

  useLayoutEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
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
  const goalTitle = (id: string) => goals.find((g) => g.id === id)?.title ?? id;
  const instructions = roadmap?.standingInstructions ?? [];
  const ideas = roadmap?.ideas.filter((i) => !i.promotedTo) ?? [];
  const select = (kind: "idea" | "standing instruction", key: string) => (e: React.MouseEvent) =>
    setSelected({ kind, key, at: { x: e.clientX, y: e.clientY } });

  return (
    <>
      <header className="nav">
        <div className="logo">
          <i aria-hidden="true" />
          Progressor {project && <small className="hide-narrow">{project.name}</small>}
        </div>
        {roadmap &&
          (sessionChips.length === 0 ? (
            <span className="chip hide-narrow">No Session is working on a Goal</span>
          ) : (
            sessionChips.map((s) => (
              <button key={s.session} className="chip" onClick={() => pickGoal(s.goal)}
                title={s.running ? `Show ${goalTitle(s.goal)}` : "This Session's process has ended; the next Session to claim the Goal takes it over"}>
                <span className={`dot ${s.running ? "" : "warn"}`} />
                Session <b>{s.session}</b>{s.running ? "" : " (ended)"} · {goalTitle(s.goal)}
              </button>
            ))
          ))}
        <span className="sp" />
        <span className="chip" title={connection === "live" ? "Updates as the markdown changes" : "Lost the connection to the Progressor server"}>
          <span className={`dot ${connection === "live" ? "" : "warn"}`} />
          {connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
        {roadmap && (
          <button className={`iconbtn menu-btn ${menuOpen ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={menuOpen}
            title="Rules & Ideas: your Standing Instructions and the parked Ideas" aria-label="Rules & Ideas" onClick={() => setMenuOpen(!menuOpen)}>
            📌<span className="label"> Rules &amp; Ideas</span> <span className="count">{instructions.length + ideas.length}</span>
          </button>
        )}
        <button className="toggle" role="switch" aria-checked={detours} onClick={() => {
          setDetours(!detours);
          toast(`${detours ? "Hiding" : "Showing"} Detours in this view.`);
        }}>
          <span className="sw" />
          Detours
        </button>
        <label className="picker-label hide-narrow">
          <span className="label">Open in</span>
          <select className="picker" value={editor} onChange={(e) => setEditorChoice(e.target.value === info?.editor ? undefined : e.target.value)}>
            {info?.editor && !EDITORS.includes(info.editor) && <option value={info.editor}>Custom (PROGRESSOR_EDITOR)</option>}
            {EDITORS.filter((e) => e !== "jetbrains").map((e) => (
              <option key={e} value={e}>
                {editorName(e)}
              </option>
            ))}
          </select>
        </label>
        <button className="iconbtn" title="Switch between light and dark" aria-label="Switch between light and dark" onClick={() => setTheme(isDark(theme) ? "light" : "dark")}>
          {isDark(theme) ? "☀️" : "🌙"}
        </button>
      </header>

      {menuOpen && roadmap && (
        <MenuPanel onClose={() => setMenuOpen(false)}>
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
            <h3>Roadmap</h3>
            {roadmap && <p className="path roadmap-path" title="The project folder this Roadmap comes from">{roadmap.root}</p>}
            {roadmap && goals.length === 0 && <p className="empty">No Goals yet.</p>}
            {goals.map((g) => {
              const pct = g.total ? Math.round((100 * g.done) / g.total) : 0;
              return (
                <button key={g.id} className={`goal ${g.status}`} aria-current={g.id === effectiveGoal} onClick={() => pickGoal(g.id)}>
                  <div className="t">{g.title}</div>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <div className="s">
                    <span>{sessionLabel(g)}</span>
                    <span>{g.total ? `${g.done}/${g.total} · ${pct}%` : "no Tasks"}</span>
                  </div>
                </button>
              );
            })}
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
              ) : (
                <MetroMap
                  graph={graph}
                  viewKey={`${projectId}:${shownGoal.goal.id}:${detours}`}
                  focusId={focus(shownGoal.graph, detours)}
                  onOpen={(node, at) => setSelected({ kind: "node", key: node.id, at })}
                />
              )}
              <div className="legend" aria-hidden="true">
                <span>━ plan</span>
                <span style={{ color: "var(--detour)" }}>┈ Detour</span>
                <span style={{ color: "var(--faded)" }}>┅ dropped</span>
                <span>◆ Detour stop</span>
                <span>drag a stop · scroll to zoom</span>
              </div>
            </>
          )}
        </main>
      </div>

      {selected && subject && (
        <Popover subject={subject} at={selected.at} onClose={() => setSelected(undefined)} fileLink={fileLink} onCopy={copy} />
      )}
      {toastNode}
    </>
  );
}

/** The navbar's Rules & Ideas panel: read-only lists; each item opens the usual popover. */
function MenuPanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".menu-panel") && !t.closest(".menu-btn") && !t.closest(".pop")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div className="menu-panel" role="dialog" aria-label="Standing Instructions and parked Ideas">
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
              {open.reason ? `Reason: ${open.reason}` : ""}
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

function describe(subject: PromptSubject): { title: string; meta: string; reason?: string; locations: Location[] } {
  switch (subject.kind) {
    case "node": {
      const { node: n, goal } = subject;
      const main = { path: goal.planFile, line: n.line, label: `📄 ${goal.planFile}:${n.line}` };
      if (n.kind === "detour")
        return { title: n.title, meta: `Detour ${n.id} · ${STATUS_LABEL[n.status]}`, reason: n.reason, locations: [main] };
      const code = n.code.map((c) => ({ ...parseCodeRef(c), label: `↳ ${c}` }));
      const extra = n.fromDetour ? " · added from a Detour" : n.addedBy ? ` · added by ${n.addedBy}` : "";
      return { title: n.title, meta: `Task ${n.id} · ${STATUS_LABEL[n.status]}${extra}`, reason: n.status === "dropped" ? n.reason : undefined, locations: [main, ...code] };
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
      {d.reason && <p className="reason">{d.reason}</p>}
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
