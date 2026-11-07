// The History page: every change to the project's plan, newest first, with who made it, when and
// what it changed, and "Go back to before this" (history.ts). Going back is itself a change here.
import { useState } from "react";
import { type FileChange, type HistoryItem, type RoadmapView, goBackInHistory, historyChanges, useHistory } from "./data.js";
import { Icon } from "./Icon.js";
import {
  HISTORY_EMPTY,
  HISTORY_GO_BACK,
  HISTORY_INTRO,
  HISTORY_OFF,
  ago,
  exactDate,
  historyConfirm,
  historyDone,
  historyFile,
  historyLabel,
  historyWho,
} from "./words.js";


export function HistoryPage({ projectId, roadmap, toast }: { projectId: string; roadmap: RoadmapView; toast: (text: string) => void }) {
  const [view, reload] = useHistory(projectId, roadmap);
  const [busy, setBusy] = useState<string>();
  const goalTitle = (id: string) => roadmap.goals.find((g) => g.id === id)?.title;
  const goBack = async (item: HistoryItem, later: number) => {
    if (!confirm(historyConfirm(item.label, later))) return;
    setBusy(item.id);
    try {
      const { files } = await goBackInHistory(projectId, item.id);
      toast(historyDone(files.length));
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="page history">
      <h1 className="page-title">History</h1>
      <p className="page-sub">{HISTORY_INTRO}</p>
      {view?.enabled === false && <p className="history-off">{HISTORY_OFF}</p>}
      {view === undefined ? (
        <p className="quiet">Loading…</p>
      ) : view === null ? (
        <p className="quiet">The history could not be loaded. Try Refresh.</p>
      ) : view.entries.length === 0 ? (
        <p className="quiet">{HISTORY_EMPTY}</p>
      ) : (
        <ol className="timeline">
          {view.entries.map((item, i) => (
            <Entry key={item.id} item={item} newest={i === 0} later={i} projectId={projectId} goalTitle={goalTitle}
              busy={busy !== undefined} going={busy === item.id} onGoBack={() => void goBack(item, i)} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Entry(props: {
  item: HistoryItem;
  newest: boolean;
  later: number;
  projectId: string;
  goalTitle: (id: string) => string | undefined;
  busy: boolean;
  going: boolean;
  onGoBack: () => void;
}) {
  const { item, projectId, goalTitle } = props;
  const [changes, setChanges] = useState<FileChange[] | null>();
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen(!open);
    if (!open && changes === undefined)
      historyChanges(projectId, item.id)
        .then((c) => setChanges(c?.files ?? null))
        .catch(() => setChanges(null));
  };
  return (
    <li className={`entry ${item.actor === "Developer" ? "by-you" : "by-ai"} ${props.newest ? "newest" : ""} ${item.restores ? "went-back" : ""}`}>
      <div className="entry-head">
        <span className="entry-what">{historyLabel(item.label)}</span>
        <span className="entry-who">{historyWho(item.actor)}</span>
        <time className="entry-when" dateTime={item.at} title={exactDate(item.at)}>{ago(Date.parse(item.at))}</time>
      </div>
      <div className="entry-files">{item.files.map((f) => historyFile(f, goalTitle)).join(" · ")}</div>
      <div className="entry-actions">
        <button className="linkbtn" aria-expanded={open} onClick={toggle}>
          <Icon name={open ? "chevronDown" : "chevronRight"} size={14} /> What changed
        </button>
        <button className="btn ghost small" disabled={props.busy} onClick={props.onGoBack}
          title={props.later > 0 ? `Undoes this change and the ${props.later} after it` : "Undoes this change"}>
          <Icon name="history" size={14} /> {props.going ? "Going back…" : HISTORY_GO_BACK}
        </button>
      </div>
      {open && (
        <div className="entry-diff">
          {changes === undefined ? (
            <p className="quiet">Loading…</p>
          ) : changes === null ? (
            <p className="quiet">This change could not be shown.</p>
          ) : (
            changes.map((c) => <Diff key={c.file} change={c} name={historyFile(c.file, goalTitle)} />)
          )}
        </div>
      )}
    </li>
  );
}

function Diff({ change, name }: { change: FileChange; name: string }) {
  return (
    <figure className="diff">
      <figcaption>
        {name}
        {change.made ? " (new)" : change.removed ? " (removed)" : ""}
      </figcaption>
      <pre>
        {change.lines.map((l, i) => (
          <div key={i} className={`diff-line ${l.kind}`}>
            <span className="diff-mark" aria-label={l.kind === "add" ? "added" : l.kind === "del" ? "removed" : undefined}>
              {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
            </span>
            {l.text || " "}
          </div>
        ))}
      </pre>
    </figure>
  );
}
