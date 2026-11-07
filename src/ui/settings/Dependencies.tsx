// The "Goals that wait" section of Settings: whether your AI is told, when it starts a goal, that the
// goal waits on another one that isn't finished (settings.ts, "dependencies").
import type { SettingsContext, SettingsSection } from "./types.js";

function Dependencies({ ctx }: { ctx: SettingsContext }) {
  const d = ctx.computer?.settings.dependencies;
  if (!d) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  return (
    <label className="option">
      <input type="checkbox" checked={d.warnOnClaim} onChange={(ev) => void ctx.save("dependencies", { warnOnClaim: ev.target.checked })} />
      <span><b>Remind your AI when a goal waits on another</b><small>When your AI starts a goal that waits on another goal that isn't finished, it is reminded. It never stops the work.</small></span>
    </label>
  );
}

export const dependenciesSection: SettingsSection = {
  id: "dependencies",
  title: "Goals that wait",
  Component: Dependencies,
  reset: (ctx) => ctx.resetComputer("dependencies"),
};
