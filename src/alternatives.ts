// Alternatives to choose from: how long the AI waits for the Developer's pick before it goes ahead
// with its own, and the one hint get_status gives about when to offer alternatives. Pure.

/** Minutes in a wait such as "0m", "10m", "1h" or "1d"; undefined when the text is not one. */
export function parseWait(text: string): number | undefined {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hours?|d|days?)\s*$/i.exec(text);
  if (!m) return undefined;
  const unit = m[2]!.toLowerCase()[0];
  return Math.round(Number(m[1]) * (unit === "d" ? 1440 : unit === "h" ? 60 : 1));
}

/** The hint for get_status, following the alternatives.offer setting; none when it is off. */
export function offerHint(offer: string): string | undefined {
  const how = "offer 2 to 4 alternatives with ask_developer (alternatives, recommended) and go ahead with your pick; nobody has to choose.";
  if (offer === "always") return `For any choice with more than one good way, ${how}`;
  if (offer === "big choices") return `For a big product or design choice, ${how}`;
  return undefined;
}
