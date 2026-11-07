// The "Plan check-up" section of Settings (settings.ts, "checkup"): whether your AI runs the check-up by
// itself at the start of each chat, and whether it repairs what is safe to repair.
import type { SettingsContext, SettingsSection } from "./types.js";

function Checkup({ ctx }: { ctx: SettingsContext }) {
  const c = ctx.computer?.settings.checkup;
  if (!c) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={c.onStatus} onChange={(ev) => void ctx.save("checkup", { onStatus: ev.target.checked })} />
        <span><b>Check the plan at the start of each AI chat</b><small>Your AI looks over the plan once per chat and is told in one line what was fixed or is left.</small></span>
      </label>
      <label className="option">
        <input type="checkbox" checked={c.autoRepair} onChange={(ev) => void ctx.save("checkup", { autoRepair: ev.target.checked })} />
        <span><b>Repair what is safe to repair</b><small>Mixed line endings, files left by a save that didn't finish, and goals held by a chat that has ended. Each repair can be undone from History.</small></span>
      </label>
    </>
  );
}

export const checkupSection: SettingsSection = {
  id: "checkup",
  group: "plan",
  title: "Plan check-up",
  Component: Checkup,
  reset: (ctx) => ctx.resetComputer("checkup"),
};
