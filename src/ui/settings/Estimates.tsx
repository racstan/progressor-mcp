// The Estimates section of Settings: whether Progressor learns from how long finished steps took
// (settings.ts, "estimates"), and how many of the latest steps it looks at.
import type { SettingsContext, SettingsSection } from "./types.js";

const WINDOWS = [10, 20, 50];

function Estimates({ ctx }: { ctx: SettingsContext }) {
  const e = ctx.computer?.settings.estimates;
  if (!e) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  const windows = WINDOWS.includes(e.window) ? WINDOWS : [...WINDOWS, e.window].sort((a, b) => a - b);
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={e.learn} onChange={(ev) => void ctx.save("estimates", { learn: ev.target.checked })} />
        <span><b>Learn from how long steps really take</b><small>Once five finished steps have both an estimate and a time, goal times are adjusted by how far estimates have run off, and your AI is told when they are off by more than a fifth.</small></span>
      </label>
      <section>
        <h3>How many finished steps to look at</h3>
        <select className="picker" aria-label="How many finished steps to look at" disabled={!e.learn}
          title="Only the most recently finished steps count, so the adjustment follows how work goes now"
          value={e.window} onChange={(ev) => void ctx.save("estimates", { window: Number(ev.target.value) })}>
          {windows.map((n) => (
            <option key={n} value={n}>The last {n}</option>
          ))}
        </select>
      </section>
    </>
  );
}

export const estimatesSection: SettingsSection = {
  id: "estimates",
  group: "plan",
  title: "Estimates",
  Component: Estimates,
  reset: (ctx) => ctx.resetComputer("estimates"),
};
