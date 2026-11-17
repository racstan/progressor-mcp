// How much the page moves: Full (loading animations, pages gliding in, spinners), Gentle (no
// shimmering or gliding, slower dots) or Off. Kept in this browser; the page marks <html
// data-motion> and styles.css does the rest. A computer set to reduce motion always gets Off.

export type Motion = "full" | "gentle" | "off";
export const MOTION_KEY = "progressor.motion";
const CHOICES: Motion[] = ["full", "gentle", "off"];

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readMotion(store: Store): Motion {
  try {
    const v = store.getItem(MOTION_KEY);
    return CHOICES.includes(v as Motion) ? (v as Motion) : "full";
  } catch {
    return "full";
  }
}

export function writeMotion(store: Store, motion: Motion): void {
  try {
    if (motion === "full") store.removeItem(MOTION_KEY);
    else store.setItem(MOTION_KEY, motion);
  } catch {
    // the browser can't remember it: it applies until the page is reloaded
  }
}

/** Marks the page with the choice; called when the page starts and whenever it changes. */
export function applyMotion(motion: Motion): void {
  if (motion === "full") delete document.documentElement.dataset.motion;
  else document.documentElement.dataset.motion = motion;
}
