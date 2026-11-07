// What opens by itself when the dashboard is opened: the tour on a first visit, and What's new the
// first time after the version changes. Both are optional extras, so when the browser can't keep
// anything, neither opens by itself.
//
// The tour: opens on the first visit; closed with Skip or × (or left open), it comes back once on the
// next visit; finishing it or choosing Don't show again stops it for good. When the tour opens, What's
// new waits (the page marks the version seen). Take the tour again and Help › What's new always work.
//
// Someone updating from an earlier Progressor already knows the page, so a browser that had any of
// Progressor's keys before this version first looked gets no tour, just What's new. The switch "Show
// the tour when the page opens" in Settings opens it on every load until it is turned off, finished
// or put away with Don't show again.

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const TOUR = "progressor.tour";
/** Kept by earlier builds of 1.3.0 once the tour was seen. */
const OLD_TOUR = "progressor.tour-seen";
const SEEN = "progressor.seenChanges";
const AUTO = "progressor.whats-new-auto";

/** The tour's state: unset (never decided), shown, again (came back once), done, or always (Settings). */
const tourState = (store: Store) => (store.getItem(OLD_TOUR) !== null ? "done" : store.getItem(TOUR));

/** Whether the browser was used by an earlier Progressor: it had any of Progressor's keys when the page loaded. */
const updating = (earlier: string[]) => earlier.some((k) => k.startsWith("progressor."));

/**
 * Decides what opens by itself, and remembers that the tour was shown. `earlier` is the browser's
 * storage keys as they were when the page loaded, before this page wrote any.
 */
export function onOpen(store: Store, latest: string | undefined, earlier: string[] = []): { tour: boolean; whatsNew: boolean } {
  try {
    let state = tourState(store);
    if (state === null && updating(earlier)) {
      store.setItem(TOUR, "done");
      state = "done";
    }
    if (state === "always") return { tour: true, whatsNew: false };
    if (state === null || state === "shown") {
      store.setItem(TOUR, state === null ? "shown" : "again");
      return { tour: true, whatsNew: false };
    }
    const whatsNew = !!latest && store.getItem(AUTO) !== "off" && store.getItem(SEEN) !== latest;
    return { tour: false, whatsNew };
  } catch {
    return { tour: false, whatsNew: false };
  }
}

/** How the tour was closed: finishing it or Don't show again stop it for good; Skip and × leave it to come back once. */
export function tourClosed(store: Store, how: "finish" | "never" | "skip" | "close"): void {
  if (how !== "finish" && how !== "never") return;
  try {
    store.setItem(TOUR, "done");
  } catch {
    // not kept; it opens at most once more
  }
}

/** Whether the tour opens by itself the next time the page opens ("Show the tour when the page opens"). */
export function tourOnOpen(store: Store): boolean {
  try {
    const state = tourState(store);
    return state === null || state === "shown" || state === "always";
  } catch {
    return false;
  }
}

/** On: the tour opens on every load until turned off, finished or Don't show again. Off: it's done. */
export function setTourOnOpen(store: Store, on: boolean): void {
  try {
    store.removeItem(OLD_TOUR);
    store.setItem(TOUR, on ? "always" : "done");
  } catch {
    // not kept
  }
}

/** Whether What's new opens by itself on new versions; on unless Don't show again was chosen. */
export function whatsNewAuto(store: Store): boolean {
  try {
    return store.getItem(AUTO) !== "off";
  } catch {
    return true;
  }
}

export function setWhatsNewAuto(store: Store, on: boolean): void {
  try {
    if (on) store.removeItem(AUTO);
    else store.setItem(AUTO, "off");
  } catch {
    // not kept
  }
}
