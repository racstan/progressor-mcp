// The projects in Home's sidebar, in the groups and order the person chose (projectLayout.ts): drag a
// project onto another to put it there, or onto a group's name to move it to the end of that group;
// Alt+Up and Alt+Down move the one in focus. The layout is kept on this computer, for every browser.
import { type DragEvent, type KeyboardEvent, useState } from "react";
import { type ProjectLayout, addGroup, arrange, moveGroup, moveProject, removeGroup, renameGroup } from "../projectLayout.js";
import { type ProjectEntry, removeProjectFromDashboard } from "./data.js";
import { projectInitials } from "./home.js";
import { Icon } from "./Icon.js";
import { busyClass } from "./Loading.js";

type Facts = { needs: number; working: boolean };

interface Props {
  /** The projects in the usual order (projectList.ts). */
  projects: ProjectEntry[];
  facts: Map<string, Facts> | undefined;
  layout: ProjectLayout;
  saveLayout: (next: ProjectLayout) => Promise<void>;
  canRemove: boolean;
  onPick: (id: string) => void;
  onRemoved: (p: ProjectEntry) => void;
  toast: (text: string) => void;
}

const DRAG_TYPE = "text/x-progressor-project";

export function SideProjects({ projects, facts, layout, saveLayout, canRemove, onPick, onRemoved, toast }: Props) {
  const [dragging, setDragging] = useState<string>();
  const [over, setOver] = useState<string>();
  const [naming, setNaming] = useState<string | "new">();
  const [name, setName] = useState("");
  const sections = arrange(projects, layout);
  const save = (next: ProjectLayout, said?: string) =>
    void saveLayout(next).then(() => said && toast(said)).catch((e: Error) => toast(`That was not saved: ${e.message}`));

  const move = (id: string, group: string | undefined, before: string | undefined) => {
    if (id === before) return;
    save(moveProject(layout, projects, id, group, before));
  };
  const dropOn = (group: string | undefined, before: string | undefined) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(before ?? `group:${group ?? ""}`);
    },
    onDragLeave: () => setOver(undefined),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_TYPE) || dragging;
      setOver(undefined);
      setDragging(undefined);
      if (id) move(id, group, before);
    },
  });
  /** Alt+Up / Alt+Down: one place up or down in its own list. */
  const keyMove = (list: ProjectEntry[], i: number, group: string | undefined) => (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const id = list[i]!.id;
    if (e.key === "ArrowUp" && i > 0) move(id, group, list[i - 1]!.id);
    if (e.key === "ArrowDown" && i < list.length - 1) move(id, group, list[i + 2]?.id);
    // keep the focus on the project that moved
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-project-id="${CSS.escape(id)}"] .side-link`)?.focus());
  };

  const finishNaming = () => {
    const text = name.trim();
    const was = naming;
    setNaming(undefined);
    setName("");
    if (!text) return;
    try {
      if (was === "new") save(addGroup(layout, text).layout, `Added the group ${text}. Drag projects onto it.`);
      else if (was) save(renameGroup(layout, was, text));
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const nameBox = (label: string) => (
    <input className="side-group-name" autoFocus value={name} maxLength={60} aria-label={label} placeholder="Group name"
      onChange={(e) => setName(e.target.value)} onBlur={finishNaming}
      onKeyDown={(e) => {
        if (e.key === "Enter") finishNaming();
        if (e.key === "Escape") { setNaming(undefined); setName(""); }
      }} />
  );

  const rows = (list: ProjectEntry[], group: string | undefined) =>
    list.map((p, i) => (
      <SideProject key={p.id} project={p} facts={facts?.get(p.id)} canRemove={canRemove} onPick={() => onPick(p.id)} onRemoved={() => onRemoved(p)}
        dragging={dragging === p.id} over={over === p.id} onKeyDown={keyMove(list, i, group)}
        drag={{
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData(DRAG_TYPE, p.id);
            e.dataTransfer.effectAllowed = "move";
            setDragging(p.id);
          },
          onDragEnd: () => {
            setDragging(undefined);
            setOver(undefined);
          },
          ...dropOn(group, p.id),
        }} />
    ));

  const [loose, ...groups] = sections;
  return (
    <div className="side-group side-projects">
      <h3 className={`side-drop${over === "group:" ? " over" : ""}`} {...dropOn(undefined, undefined)}>
        <span>Projects</span>
        <button className="linkbtn side-add-group" title="Add a group to sort projects into" onClick={() => { setNaming("new"); setName(""); }}>+ Group</button>
      </h3>
      {naming === "new" && nameBox("New group's name")}
      {rows(loose!.projects, undefined)}
      {groups.map(({ group, projects: inGroup }, gi) => (
        <div key={group!.id} className="side-proj-group">
          {naming === group!.id ? (
            nameBox(`New name for ${group!.name}`)
          ) : (
            <h4 className={`side-drop${over === `group:${group!.id}` ? " over" : ""}`} {...dropOn(group!.id, undefined)}>
              <span className="side-group-title">{group!.name}</span>
              <span className="n quiet">{inGroup.length}</span>
              <span className="side-group-actions">
                <button className="iconbtn" title="Rename the group" aria-label={`Rename ${group!.name}`} onClick={() => { setNaming(group!.id); setName(group!.name); }}>Aa</button>
                <button className="iconbtn" title="Move the group up" aria-label={`Move ${group!.name} up`} disabled={gi === 0} onClick={() => save(moveGroup(layout, group!.id, -1))}>↑</button>
                <button className="iconbtn" title="Move the group down" aria-label={`Move ${group!.name} down`} disabled={gi === groups.length - 1} onClick={() => save(moveGroup(layout, group!.id, 1))}>↓</button>
                <button className="iconbtn" title="Remove the group (its projects stay, out of any group)" aria-label={`Remove the group ${group!.name}`}
                  onClick={() => save(removeGroup(layout, group!.id), `Removed the group ${group!.name}. Its projects are still here.`)}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            </h4>
          )}
          {inGroup.length === 0 && <p className="side-empty">Drag a project here</p>}
          {rows(inGroup, group!.id)}
        </div>
      ))}
    </div>
  );
}

/**
 * A project in Home's sidebar. Hovering it or moving to it with the keyboard shows a remove button;
 * removing takes it off the dashboard only (registry.ts): its folder and plan stay as they are.
 */
function SideProject({ project: p, facts, canRemove, onPick, onRemoved, drag, dragging, over, onKeyDown }: {
  project: ProjectEntry;
  facts: Facts | undefined;
  canRemove: boolean;
  onPick: () => void;
  onRemoved: () => void;
  drag: Record<string, unknown>;
  dragging: boolean;
  over: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await removeProjectFromDashboard(p.id);
      setAsking(false);
      onRemoved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`side-project ${asking ? "asking" : ""}${dragging ? " dragging" : ""}${over ? " drop-before" : ""}`} data-project-id={p.id} {...drag}>
      <div className="side-project-row">
        <button className={`side-link side-project-link${facts?.working ? " working" : ""}`} onClick={onPick} onKeyDown={onKeyDown}
          title={[p.root, facts?.working && "Your AI is working on it now", facts?.needs && `${facts.needs} ${facts.needs === 1 ? "thing needs" : "things need"} you`, "Drag to move it, or Alt+Up / Alt+Down"].filter(Boolean).join(" · ")}>
          <span className="side-tile" aria-hidden="true">{projectInitials(p.name)}</span>
          <span className="side-project-name">{p.name}</span>
          {facts?.working && <span className="side-working" aria-label="Your AI is working on it now" />}
          {facts && facts.needs > 0 && <span className="n" aria-label={`${facts.needs} need you`}>{facts.needs}</span>}
        </button>
        {canRemove && !asking && (
          <button className="iconbtn side-remove" aria-label={`Remove ${p.name} from the dashboard`} title="Remove from the dashboard (its plan stays)"
            onClick={() => setAsking(true)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {asking && (
        <div className="side-confirm" role="group" aria-label={`Remove ${p.name} from the dashboard?`}>
          <p>Remove <b>{p.name}</b> from the dashboard? Its folder and plan are not touched. It comes back if your AI uses Progressor there again.</p>
          <div className="form-actions">
            <button className={busyClass("btn small", busy)} disabled={busy} autoFocus onClick={() => void remove()}>Remove</button>
            <button className="btn ghost small" disabled={busy} onClick={() => setAsking(false)}>Keep it</button>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}
