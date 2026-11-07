// The "Goals that come back" section of Settings: whether routines add their goals at all, and whether
// the dashboard adds them on time even while no AI chat is open (settings.ts, "routines").
import type { SettingsContext, SettingsSection } from "./types.js";

function Routines({ ctx }: { ctx: SettingsContext }) {
  const r = ctx.computer?.settings.routines;
  if (!r) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={r.enabled} onChange={(ev) => void ctx.save("routines", { enabled: ev.target.checked })} />
        <span><b>Bring goals back on their schedule</b><small>When something should happen regularly, your AI sets it up to come back by itself. Off: no new goals come back until you turn this on again.</small></span>
      </label>
      <label className="option">
        <input type="checkbox" checked={r.createFromDashboard} disabled={!r.enabled} onChange={(ev) => void ctx.save("routines", { createFromDashboard: ev.target.checked })} />
        <span><b>Add them on time, even with no AI chat open</b><small>The dashboard adds a goal when it is due. Off: it is added the next time your AI looks at the plan.</small></span>
      </label>
    </>
  );
}

export const routinesSection: SettingsSection = {
  id: "routines",
  group: "plan",
  title: "Goals that come back",
  Component: Routines,
  reset: (ctx) => ctx.resetComputer("routines"),
};
