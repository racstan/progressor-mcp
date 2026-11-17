// When the Developer last looked at a project's Dashboard, kept in this browser (a per-viewer
// convenience, like the sort order); the plan files are never touched.

export const lastLookKey = (projectId: string) => `progressor.last-look.${projectId}`;

type Store = Pick<Storage, "getItem" | "setItem">;

const browserStore = (): Store | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

/** The time of the last look (ms), or undefined for a first look or when storage is unavailable. */
export function readLastLook(projectId: string, store: Store | undefined = browserStore()): number | undefined {
  try {
    const n = Number(store?.getItem(lastLookKey(projectId)));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function writeLastLook(projectId: string, now = Date.now(), store: Store | undefined = browserStore()): void {
  try {
    store?.setItem(lastLookKey(projectId), String(now));
  } catch {
    // not remembered; the next look then compares with an older time, which only shows more as new
  }
}
