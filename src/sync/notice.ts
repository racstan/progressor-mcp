// The one line get_status adds when plan sync has a problem, or kept the newer of two clashing
// changes: each problem and each new clash is told once (what was told is kept in sync-told.json).
// Being offline is not told: changes simply wait.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readSyncState } from "./run.js";

export const syncToldFileFor = (settingsFile: string) => join(dirname(settingsFile), "sync-told.json");

interface Told {
  problem?: string;
  /** The time of the newest clash already told. */
  clashesTo?: string;
}

function readTold(file: string): Told {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Told;
  } catch {
    return {};
  }
}

export function takeSyncLine(stateFile: string, toldFile: string, enabled: boolean): string | undefined {
  if (!enabled) return undefined;
  const state = readSyncState(stateFile);
  const told = readTold(toldFile);
  const lines: string[] = [];
  const next: Told = { ...told };

  const problem = state.offline ? undefined : state.problem;
  if (problem && problem !== told.problem) lines.push(`Plan sync: ${problem}`);
  next.problem = problem;

  const fresh = state.conflicts.filter((c) => !told.clashesTo || c.at > told.clashesTo);
  if (fresh.length > 0) {
    lines.push(
      `Plan sync: another computer changed the same thing as this one; the newer change was kept for ${fresh.length} change${fresh.length === 1 ? "" : "s"} ` +
        `(${[...new Set(fresh.map((c) => `${c.project} ${c.file}${c.id ? ` ${c.id}` : ""}`))].slice(0, 3).join(", ")}). The other versions are in Settings › Sync; tell the Developer if one mattered.`,
    );
    next.clashesTo = fresh.map((c) => c.at).sort().at(-1);
  }

  if (next.problem !== told.problem || next.clashesTo !== told.clashesTo) {
    try {
      mkdirSync(dirname(toldFile), { recursive: true });
      writeFileSync(toldFile, `${JSON.stringify(next)}\n`);
    } catch {
      // without the note the line is told again, which is harmless
    }
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}
