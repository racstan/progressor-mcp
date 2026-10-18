import { inlineCode } from "./text.js";

/** A paragraph of Agent-written text (a summary or a Reason) with `backtick` spans shown as code. */
export function RichText({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {inlineCode(text).map((s, i) => (s.code ? <code key={i}>{s.text}</code> : s.text))}
    </p>
  );
}
