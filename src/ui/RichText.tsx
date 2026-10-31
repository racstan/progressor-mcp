import { type Highlight, highlights } from "./text.js";

const TITLES: Partial<Record<Highlight["kind"], string>> = {
  label: "Something to click or type",
  path: "Where to go, menu by menu",
  file: "A file",
};

/** The AI's words with what is worth looking at (code, things to click, menu paths, file names) made to stand out. */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {highlights(text).map((h, i) =>
        h.kind === "plain" ? h.text : h.kind === "code" ? <code key={i}>{h.text}</code> : (
          <span key={i} className={`hl hl-${h.kind}`} title={TITLES[h.kind]}>{h.text}</span>
        ),
      )}
    </>
  );
}

/** A paragraph of Agent-written text (a summary or a Reason), with its highlights. */
export function RichText({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      <Highlighted text={text} />
    </p>
  );
}
