// What opens by itself when the dashboard is opened: the tour on a first visit, and What's new the
// first time after the version changes. Both are optional extras, so when the browser can't keep
// anything, neither opens by itself.
//
// The tour: opens on the first visit; closed with Skip or × (or left open), it comes back once on the
// next visit; finishing it or choosing Don't show again stops it for good. When the tour opens, What's
// new waits (the page marks the version seen). Take the tour again and Help › What's new always work.

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const TOUR = "progressor.tour";
/** Kept by earlier builds of 1.3.0 once the tour was seen. */
const OLD_TOUR = "progressor.tour-seen";
const SEEN = "progressor.seenChanges";
const AUTO = "progressor.whats-new-auto";

/** Decides what opens by itself, and remembers that the tour was shown. */
export function onOpen(store: Store, latest: string | undefined): { tour: boolean; whatsNew: boolean } {
  try {
    const state = store.getItem(OLD_TOUR) !== null ? "done" : store.getItem(TOUR);
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
