import { datesLine, datesTitle } from "./words.js";

type Item = Parameters<typeof datesLine>[0];

/** "Added 2 h ago by your AI · updated 10 min ago", with the exact dates on hover; nothing when the plan has no dates. */
export function Dates({ item, className = "meta" }: { item: Item | undefined; className?: string }) {
  const line = item ? datesLine(item) : "";
  return line ? <div className={className} title={datesTitle(item!)}>{line}</div> : null;
}
