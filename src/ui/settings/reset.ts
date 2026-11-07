// Putting the dashboard's settings back to their defaults: each section's own reset, the look of the
// page kept in this browser, and the settings for how Progressor works kept on this computer.

/** The browser keys that hold how the page looks; "Reset all settings" clears them. */
export const BROWSER_SETTINGS = ["progressor.theme", "progressor.pop-ups", "progressor.finished", "progressor.editor", "progressor.put-off"];

/** Clears the look of the page from the browser; what the person hid or has seen stays. */
export function clearBrowserSettings(storage: { removeItem(key: string): void }): void {
  for (const key of BROWSER_SETTINGS) {
    try {
      storage.removeItem(key);
    } catch {
      // storage can be unavailable (private windows)
    }
  }
}

/**
 * Resets every section, then clears the browser's settings, then resets the settings on this
 * computer once. A section that fails does not stop the others; the error names it afterwards.
 */
export async function resetAll(
  sections: readonly { id: string; reset: () => void | Promise<void> }[],
  storage: { removeItem(key: string): void },
  resetComputer: () => Promise<void>,
): Promise<void> {
  const failed: string[] = [];
  for (const s of sections) {
    try {
      await s.reset();
    } catch {
      failed.push(s.id);
    }
  }
  clearBrowserSettings(storage);
  await resetComputer();
  if (failed.length > 0) throw new Error(`Could not reset: ${failed.join(", ")}.`);
}
