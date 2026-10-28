import { useMemo, useState } from "react";
import { type DetourNode, type GoalGraph, type TaskNode, withoutDropped } from "../dashboard/graph.js";
import { copyAsPrompt } from "../dashboard/prompt.js";
import type { GoalSchedule } from "../schedule.js";
import { type GoalView, type RoadmapView, useStored } from "./data.js";
import { GoalNotes } from "./GoalNotes.js";
import { HandTests, UntriedTests } from "./HandTests.js";
import { Pictures } from "./Pictures.js";
import { progressWords } from "./home.js";
import { Icon } from "./Icon.js";
import { Choice } from "./Menus.js";
import { MetroMap } from "./MetroMap.js";
import { Popover } from "./Popover.js";
import { RichText } from "./RichText.js";
import { StepKey } from "./StepKey.js";
import { type FileLink, Steps, StepIcon } from "./Steps.js";
import { Conversation, OpenQuestions } from "./Talk.js";
import { plainText } from "./text.js";
import { SIDE_TRIP_HINT, ago, datesLine, datesTitle, elsewhereTag, exactDate, finishWords, goalState, whenWords } from "./words.js";

type Goal = RoadmapView["goals"][number];
type Tab = "steps" | "map" | "talk" | "notes";

const tasksOf = (g: GoalGraph) => g.nodes.filter((n): n is TaskNode => n.kind === "task");
const openDetourOf = (g: GoalGraph) => g.nodes.find((n): n is DetourNode => n.kind === "detour" && n.status === "open");

/** The stop the map centres on: what needs the person, else what is happening, else what is next. */
function focus(g: GoalGraph): string | undefined {
  const tasks = tasksOf(g);
  const first = (status: string) => tasks.find((t) => t.status === status)?.id;
  return first("waiting on you") ?? openDetourOf(g)?.id ?? first("in progress") ?? first("with a helper") ?? first("checked") ?? first("pending") ?? tasks[0]?.id;
}

/**
 * One goal, top to bottom: where it stands and how far along it is, what needs the person (questions,
 * steps, things to try) in one place, then the steps, the map, the conversation and the notes as tabs.
 */
export function GoalPage({ projectId, view, goals, state, schedule, fileLink, onCopy, onReveal, onChanged }: {
  projectId: string;
  view: GoalView;
  goals: Goal[];
  state: Parameters<typeof goalState>[0];
  schedule: GoalSchedule | undefined;
  fileLink: FileLink;
  onCopy: (text: string) => void;
  /** Opens the file manager at a file of the project. */
  onReveal: (path: string) => void;
  onChanged: () => void;
}) {
  const { goal, graph } = view;
  const [storedTab, setTab] = useStored<Tab>("progressor.tab", undefined);
  const tab: Tab = storedTab ?? "steps";
  const [across, setAcross] = useStored<"down">("progressor.map", undefined);
  const [selected, setSelected] = useState<{ key: string; at: { x: number; y: number } }>();
  const tasks = tasksOf(graph);
  const live = tasks.filter((t) => t.status !== "dropped");
  const done = live.filter((t) => t.status === "done" || t.status === "released").length;
  const waiting = tasks.filter((t) => t.status === "waiting on you");
  const questions = view.questions.filter((q) => q.state === "open");
  const untried = view.handTests.filter((t) => t.result === "pending");
  const detour = openDetourOf(graph);
  const from = detour?.branchedFrom ? tasks.find((t) => t.id === detour.branchedFrom) : undefined;
  const now = goalState(state);
  const finished = goal.status === "done";
  const left = schedule && !finished ? finishWords(schedule) : undefined;
  const elsewhere = elsewhereTag(goal.fromElsewhere);
  const mapGraph = useMemo(() => withoutDropped(graph), [graph]);
  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected.key) : undefined;
  const props = { projectId, goalId: goal.id, view, onChanged };
  const said = view.messages.length + view.questions.filter((q) => q.state === "answered").length;
  const notes = view.decisions.length + view.notes.filter((n) => !n.resolved).length + view.handTests.length + view.pictures.length;

  return (
    <div className="page">
      <header className="goal-head">
        <div className="top">
          <span className={`state ${now.state}`} title={now.hint}>{now.state === "working" ? <span className="working-dot" /> : <span className="dot" />}{now.label}</span>
          {datesLine(goal) ? (
            <span className="state" title={datesTitle(goal)}>· {datesLine(goal)}</span>
          ) : (
            state.updatedAt !== undefined && <span className="state" title={`${exactDate(new Date(state.updatedAt).toISOString())} (${ago(state.updatedAt)})`}>· updated {whenWords(new Date(state.updatedAt).toISOString())}</span>
          )}
          {elsewhere && <span className="state" title={elsewhere.hint}>· {elsewhere.label}</span>}
          <span className="sp" />
          <button className="btn ghost small" title="Copies a description of this goal to paste into your AI chat"
            onClick={() => onCopy(copyAsPrompt({ kind: "goal", goal, graph }))}>
            <Icon name="copy" size={14} /> Copy for your AI
          </button>
          <button className="btn ghost small" title={`Opens the folder this goal's plan is saved in: ${goal.planFile}`} onClick={() => onReveal(goal.planFile)}>
            <Icon name="folder" size={14} /> Show in folder
          </button>
        </div>
        <h1 className="page-title">{goal.title}</h1>
        {goal.outcome && <p className="outcome" title="What finished looks like: your AI checks the work against this before it calls the goal finished">Finished when: {plainText(goal.outcome)}</p>}
        {goal.status === "dropped" && <p className="outcome">Cancelled{goal.reason ? `: ${plainText(goal.reason)}` : ""}</p>}
        {live.length > 0 && (
          <div className={`progress ${finished ? "finished" : ""} ${now.state === "working" ? "moving" : ""}`}>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={live.length} aria-valuenow={done}><i style={{ width: `${(100 * done) / live.length}%` }} /></div>
            <div className="words">{[progressWords({ done, total: live.length }), left].filter(Boolean).join(" · ")}</div>
          </div>
        )}
      </header>

      {detour && (
        <div className="callout" title={SIDE_TRIP_HINT.open}>
          <b>On a side trip:</b> {detour.title}
          <div className="k">
            {from ? `Stepped off "${from.title}"` : "Stepped off the plan"}
            {detour.reason ? ` because: ${plainText(detour.reason)}` : "."}
          </div>
        </div>
      )}

      {(questions.length > 0 || waiting.length > 0 || untried.length > 0) && goal.status !== "dropped" && (
        <section className="needs-panel" aria-label="Needs you">
          <h2>Needs you</h2>
          <ul className="hand-list">
            <OpenQuestions {...props} />
            {waiting.map((t) => (
              <li key={t.id} className="needs-item">
                <div className="kind">A step waits on you</div>
                <p className="text">{t.title}</p>
                {t.summary && <RichText className="about" text={t.summary} />}
                <div className="about">When it is done, tell your AI in the chat or in Conversation below.</div>
              </li>
            ))}
            <UntriedTests {...props} />
          </ul>
        </section>
      )}

      <div className="tabs" role="tablist">
        <TabButton id="steps" tab={tab} setTab={setTab}>Steps <span className="n">{done}/{live.length}</span></TabButton>
        <TabButton id="map" tab={tab} setTab={setTab}>Map</TabButton>
        <TabButton id="talk" tab={tab} setTab={setTab}>Conversation {said > 0 && <span className="n">{said}</span>}</TabButton>
        <TabButton id="notes" tab={tab} setTab={setTab}>Notes {notes > 0 && <span className="n">{notes}</span>}</TabButton>
      </div>
      <div className="tab-body" role="tabpanel">
        {tab === "steps" && <Steps view={view} fileLink={fileLink} onCopy={onCopy} onReveal={() => onReveal(goal.planFile)} />}
        {tab === "map" && (
          mapGraph.nodes.length === 0 ? <p className="quiet">No steps yet, so nothing to draw.</p> : (
            <>
              <div className="stage">
                <MetroMap graph={mapGraph} orientation={across ? "vertical" : "horizontal"} viewKey={`${projectId}:${goal.id}:${across ?? "across"}`}
                  focusId={focus(mapGraph)} files={false} onOpen={(node, at) => setSelected({ key: node.id, at })} />
                <div className="legend" aria-hidden="true">
                  <span><StepIcon status="done" /> done</span>
                  <span><StepIcon status="in progress" /> now</span>
                  <StepKey statuses={tasks.map((t) => t.status)} />
                </div>
              </div>
              <div className="steps-foot">
                <Choice value={across ?? "across"} onChange={(v) => setAcross(v === "down" ? "down" : undefined)}
                  options={[{ value: "across", label: "Left to right" }, { value: "down", label: "Top to bottom" }]} />
                <span className="hint">Click a stop for details · scroll to zoom</span>
              </div>
            </>
          )
        )}
        {tab === "talk" && (goal.status === "dropped" ? <p className="quiet">This goal was cancelled.</p> : <Conversation {...props} />)}
        {tab === "notes" && (
          notes === 0 && view.notes.length === 0 ? <p className="quiet">Nothing yet. Your AI keeps its decisions here, and anything it notices along the way.</p> : (
            <>
              {view.pictures.length > 0 && (
                <section className="notes-block">
                  <h3>Pictures <span className="quiet">· {view.pictures.length}</span></h3>
                  <Pictures pictures={view.pictures} />
                </section>
              )}
              <HandTests {...props} />
              <GoalNotes view={view} goals={goals} />
            </>
          )
        )}
      </div>
      {selected && selectedNode && (
        <Popover subject={{ kind: "node", node: selectedNode, goal, graph }} at={selected.at} onClose={() => setSelected(undefined)} fileLink={fileLink} files onCopy={onCopy} onReveal={onReveal} />
      )}
    </div>
  );
}

function TabButton({ id, tab, setTab, children }: { id: Tab; tab: Tab; setTab: (t: Tab | undefined) => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id === "steps" ? undefined : id)}>
      {children}
    </button>
  );
}
