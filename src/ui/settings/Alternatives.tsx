// The Alternatives section of Settings: how long your AI waits for your pick before it goes ahead
// with its own, and when it offers ways to go at all (settings.ts, "alternatives").
import { ALT_OFFERS, ALT_WAITS } from "../words.js";
import type { SettingsContext, SettingsSection } from "./types.js";

function Alternatives({ ctx }: { ctx: SettingsContext }) {
  const a = ctx.computer?.settings.alternatives;
  if (!a) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  const waits = ALT_WAITS.some(([v]) => v === a.wait) ? ALT_WAITS : [...ALT_WAITS, [a.wait, `After ${a.wait}`] as [string, string]];
  return (
    <>
      <section>
        <h3>When your AI offers ways to go</h3>
        <select className="picker" aria-label="When your AI offers ways to go" value={a.offer}
          onChange={(ev) => void ctx.save("alternatives", { offer: ev.target.value })}>
          {ALT_OFFERS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <p className="quiet">Your AI shows two to four options side by side, with its own pick marked Recommended. You never have to choose.</p>
      </section>
      <section>
        <h3>If you don't pick</h3>
        <select className="picker" aria-label="How long your AI waits for your pick" disabled={a.offer === "off"} value={a.wait}
          onChange={(ev) => void ctx.save("alternatives", { wait: ev.target.value })}>
          {waits.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <p className="quiet">After this, your AI goes ahead with its recommended option. You can still pick another later, and it changes course.</p>
      </section>
    </>
  );
}

export const alternativesSection: SettingsSection = {
  id: "alternatives",
  title: "Alternatives",
  Component: Alternatives,
  reset: (ctx) => ctx.resetComputer("alternatives"),
};
