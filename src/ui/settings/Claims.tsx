// The "Goals held by a closed chat" section of Settings (settings.ts, "claims"): how long a goal stays
// held by an AI chat that looks closed but can't be told apart from another program (project.ts).
import { useEffect, useState } from "react";
import type { SettingsContext, SettingsSection } from "./types.js";

function Claims({ ctx }: { ctx: SettingsContext }) {
  const c = ctx.computer?.settings.claims;
  const [hours, setHours] = useState(String(c?.idleHours ?? ""));
  useEffect(() => setHours(String(c?.idleHours ?? "")), [c?.idleHours]);
  if (!c) return <p className="quiet">This setting needs a newer dashboard server. Restart Progressor to use it.</p>;
  const save = () => {
    const n = Math.round(Number(hours));
    if (Number.isFinite(n) && n >= 1 && n !== c.idleHours) void ctx.save("claims", { idleHours: Math.min(n, 24 * 30) }).catch((e: Error) => ctx.toast(e.message));
    else setHours(String(c.idleHours));
  };
  return (
    <>
      <label className="phone-field">
        <span>Free a goal after</span>
        <input className="picker" type="number" min={1} max={720} value={hours}
          onChange={(ev) => setHours(ev.target.value)} onBlur={save} onKeyDown={(ev) => ev.key === "Enter" && save()} />
        <small className="quiet">hours with no change to it</small>
      </label>
      <p className="hint">
        An AI chat that is working on a goal holds it, so no other chat changes it. When that chat closes, the goal is freed at once. Now and then the
        computer can't tell a closed chat from another program; then the goal is freed after this long with no change. The usual is 24 hours.
      </p>
    </>
  );
}

export const claimsSection: SettingsSection = {
  id: "claims",
  group: "plan",
  title: "Goals held by a closed chat",
  Component: Claims,
  reset: (ctx) => ctx.resetComputer("claims"),
};
