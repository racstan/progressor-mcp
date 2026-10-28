import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made: string[] = [];

/** A fresh folder in the system temp folder, removed after the test that made it (see setup.ts). */
export function tempDir(prefix = "progressor-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

export function removeTempDirs(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

/** A plan file's text without its `added` and `updated` lines, for tests that are about something else (see dates.test.ts). */
export function withoutDates(text: string): string {
  return text.replace(/^ {2}- (?:added|updated): .*\r?\n/gm, "");
}
