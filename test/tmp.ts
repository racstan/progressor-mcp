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
