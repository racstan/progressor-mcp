import { whenWords } from "./words.js";

/** How long the page may be out of touch before it says so: a moment's gap is normal while a chat restarts. */
export const LOST_AFTER_MS = 60_000;

export type Staleness = { kind: "updated" | "lost"; text: string };

/**
 * Whether the page may be showing something out of date, and the words for it: Progressor serves a
 * newer dashboard than the one this page was opened with, or the page has been out of touch for a minute.
 */
export function pageStaleness(s: { openedWith: string | undefined; serverBuild: string | undefined; lostSince: number | undefined; now: number }): Staleness | undefined {
  if (s.openedWith && s.serverBuild && s.openedWith !== s.serverBuild)
    return { kind: "updated", text: "Progressor was updated since this page was opened. Refresh to see the new version." };
  if (s.lostSince !== undefined && s.now - s.lostSince >= LOST_AFTER_MS) {
    const at = whenWords(new Date(s.lostSince).toISOString(), s.now).replace(/^today /, "");
    return {
      kind: "lost",
      text: `This page lost touch with Progressor at ${at}, so it may be out of date. It catches up by itself once Progressor runs again (open your AI chat), or press Refresh.`,
    };
  }
  return undefined;
}
