// The "Handoffs" section of Settings (settings.ts, "handoffs"): whether your AI writes a handoff after
// each release, and how many handoffs are kept (handoff.ts).
import { useEffect, useState } from "react";
import type { SettingsContext, SettingsSection } from "./types.js";

function Handoffs({ ctx }: { ctx: SettingsContext }) {
  const h = ctx.computer?.settings.handoffs;
  const [keep, setKeep] = useState(String(h?.keep ?? ""));
  useEffect(() => setKeep(String(h?.keep ?? "")), [h?.keep]);
  if (!h) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  const saveKeep = () => {
    const n = Math.round(Number(keep));
    if (Number.isFinite(n) && n >= 1 && n !== h.keep) void ctx.save("handoffs", { keep: Math.min(n, 1000) });
    else setKeep(String(h.keep));
  };
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={h.afterRelease} onChange={(ev) => void ctx.save("handoffs", { afterRelease: ev.target.checked })} />
        <span><b>Write a handoff after each release</b><small>When a release goal is finished, your AI writes a handoff of what went into it.</small></span>
      </label>
      <label className="phone-field">
        <span>Keep the newest</span>
        <input className="picker" type="number" min={1} max={1000} value={keep} onChange={(ev) => setKeep(ev.target.value)} onBlur={saveKeep} />
        <small className="quiet">handoffs; older ones are removed.</small>
      </label>
    </>
  );
}

export const handoffsSection: SettingsSection = {
  id: "handoffs",
  title: "Handoffs",
  Component: Handoffs,
  reset: (ctx) => ctx.resetComputer("handoffs"),
};
