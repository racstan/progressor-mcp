import { useState } from "react";
import { type GoalView, answerQuestion, sendMessage, takeBackMessage } from "./data.js";
import { RichText } from "./RichText.js";
import { messageStateWords, talkSummary } from "./words.js";

type MessageView = GoalView["messages"][number];
type QuestionView = GoalView["questions"][number];

interface Props {
  projectId: string;
  goalId: string;
  view: Pick<GoalView, "messages" | "questions" | "graph">;
  /** Loads the plan again now, so a change shows before the server's change notice arrives. */
  onChanged: () => void;
}

/** The title of a step, for "About the step: ...". */
const stepTitle = (view: Props["view"], id: string | undefined) =>
  id ? view.graph.nodes.find((n) => n.kind === "task" && n.id === id)?.title : undefined;

/** Runs one change to the plan, with a busy flag and the server's words when it refuses. */
function useSend(onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (change: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(undefined);
    try {
      await change();
      onChanged();
      return true;
    } catch (e) {
      setError(`That did not save: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/**
 * Where the person and their AI talk about a goal: the AI's open questions, each with a button per
 * choice, a box to write to the AI, and what was said before. Messages reach the AI at its next
 * Progressor call; the page says so, since nothing here can wake an AI chat that has stopped.
 */
export function Talk({ projectId, goalId, view, onChanged }: Props) {
  const open = view.questions.filter((q) => q.state === "open");
  const answered = view.questions.filter((q) => q.state === "answered");
  const earlier = view.messages.length + answered.length;
  return (
    <section className="talk" aria-label="Talk with your AI">
      {open.length > 0 && (
        <ul className="questions">
          {open.map((q) => (
            <Ask key={q.id} question={q} about={stepTitle(view, q.task)} projectId={projectId} goalId={goalId} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <Write projectId={projectId} goalId={goalId} onChanged={onChanged} />
      {earlier > 0 && (
        <details className="history" open>
          <summary>{talkSummary(view.messages, answered)}</summary>
          <ul>
            {[...view.messages.map((m) => ({ at: m.sentAt ?? "", m })), ...answered.map((q) => ({ at: q.answeredAt ?? "", q }))]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((item) =>
                "m" in item ? (
                  <Said key={item.m.id} message={item.m} projectId={projectId} goalId={goalId} onChanged={onChanged} />
                ) : (
                  <li key={item.q.id} className="answered">
                    <div className="who">Your AI asked</div>
                    <RichText className="text" text={item.q.text} />
                    <div className="reply"><span className="who">You answered:</span> {item.q.answer}</div>
                  </li>
                ),
              )}
          </ul>
        </details>
      )}
    </section>
  );
}

function Ask({ question: q, about, projectId, goalId, onChanged }: { question: QuestionView; about: string | undefined } & Omit<Props, "view">) {
  const { busy, error, run } = useSend(onChanged);
  const [own, setOwn] = useState<string>();
  const answer = (text: string) => void run(() => answerQuestion(projectId, goalId, q.id!, text));
  return (
    <li className="question">
      <div className="who">Your AI asks</div>
      <RichText className="text" text={q.text} />
      {about && <div className="about">About the step: {about}</div>}
      {own === undefined ? (
        <div className="buttons">
          {q.choices.map((c) => (
            <button key={c} type="button" className="choice" disabled={busy} onClick={() => answer(c)}>{c}</button>
          ))}
          <button type="button" disabled={busy} onClick={() => setOwn("")}>Something else…</button>
        </div>
      ) : (
        <form className="own" onSubmit={(e) => { e.preventDefault(); if (own.trim()) answer(own.trim()); }}>
          <input autoFocus value={own} maxLength={2000} onChange={(e) => setOwn(e.target.value)} placeholder="Your answer, in your own words" />
          <button type="submit" disabled={busy || !own.trim()} className="send">Answer</button>
          <button type="button" disabled={busy} onClick={() => setOwn(undefined)}>Cancel</button>
        </form>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}

function Write({ projectId, goalId, onChanged }: Omit<Props, "view">) {
  const { busy, error, run } = useSend(onChanged);
  const [text, setText] = useState("");
  return (
    <form className="write" onSubmit={(e) => {
      e.preventDefault();
      if (text.trim()) void run(() => sendMessage(projectId, goalId, text.trim())).then((ok) => ok && setText(""));
    }}>
      <input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write to your AI about this goal…" aria-label="Write to your AI about this goal" />
      <button type="submit" className="send" disabled={busy || !text.trim()}>Send</button>
      <div className="private" title="Saved in .progressor/talk/, which Progressor keeps out of git">🔒 Kept on this computer only, not saved in git.</div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}

function Said({ message: m, projectId, goalId, onChanged }: { message: MessageView } & Omit<Props, "view">) {
  const { busy, error, run } = useSend(onChanged);
  return (
    <li className={`said ${m.state}`}>
      <div className="who">You wrote <span className="state">· {messageStateWords(m.state)}</span></div>
      <div className="text">{m.text}</div>
      {m.reply && <div className="reply"><span className="who">Your AI:</span> <RichText className="inline" text={m.reply} /></div>}
      {m.state === "new" && (
        <button type="button" className="undo" disabled={busy} onClick={() => void run(() => takeBackMessage(projectId, goalId, m.id!))}>Take back</button>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </li>
  );
}
