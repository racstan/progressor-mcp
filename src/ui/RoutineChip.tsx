// The "Comes back every week" chip on a goal a routine made (routines.ts); nothing once the routine is stopped.
import { CONTEXT_HASH } from "./context.js";
import { useRoutines } from "./data.js";
import { ROUTINE_HINT, routineChip } from "./words.js";

export function RoutineChip({ projectId, routineId, version }: { projectId: string; routineId: string; version: unknown }) {
  const [routines] = useRoutines(projectId, version);
  const r = routines?.find((x) => x.id === routineId);
  if (!r) return null;
  return (
    <a className="waits-chip routine-chip" href={CONTEXT_HASH} title={`${ROUTINE_HINT}${r.paused ? " It is paused now." : ""}`}>
      {routineChip(r.words)}{r.paused ? " (paused)" : ""}
    </a>
  );
}
