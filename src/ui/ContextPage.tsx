import { hardFirst } from "../roadmap.js";
import { contextBlocks } from "./context.js";
import { RichText } from "./RichText.js";
import { inlineCode } from "./text.js";

/** The project's rules and background, as its AI wrote them. Read-only. */
export function ContextPage({ rules, context }: { rules: { id?: string; text: string; hard?: boolean; helpersAtOnce?: number }[]; context: string }) {
  const code = (text: string) => inlineCode(text).map((s, i) => (s.code ? <code key={i}>{s.text}</code> : s.text));
  const blocks = contextBlocks(context);
  return (
    <div className="page">
      <h1 className="page-title">Project notes</h1>
      <p className="page-sub">Your AI keeps these up to date. To change something, tell it in the chat or write to it on a goal.</p>
      <section className="section">
      <h2>Rules your AI follows</h2>
      {rules.length === 0 ? (
        <p className="empty">No rules yet. When you tell the AI a lasting rule, it shows up here.</p>
      ) : (
        <ol className="rules">
          {hardFirst(rules.map((r) => ({ ...r, hard: r.hard === true }))).map((r, i) => (
            <li key={r.id ?? i} className={r.hard ? "must" : undefined}>
              <span>
                {r.hard && <b className="must-badge" title="A rule your AI must never break, as opposed to a preference">Must</b>}
                {code(r.text)}
                {r.helpersAtOnce && (
                  <b className="limit-badge" title="Your AI hands at most this many steps to helpers at a time, so checking and merging their work keeps up">
                    At most {r.helpersAtOnce} {r.helpersAtOnce === 1 ? "helper" : "helpers"} at once
                  </b>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      </section>
      <section className="section context-body">
      <h2>About this project</h2>
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
      </section>
    </div>
  );
}
