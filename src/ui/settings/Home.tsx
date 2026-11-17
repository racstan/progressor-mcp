// The "Home page" section of Settings (kept in this browser): how tall the Needs you box is, which
// parts Home shows, and bringing back things put off. And "Pull requests and checks" (settings.ts,
// "ci", kept on this computer): whether goals and steps look up their pull requests and CI checks.
import { Choice } from "../Menus.js";
import { clearStored, useStored } from "../data.js";
import { HOME_HIDDEN_KEY, HOME_PARTS, NEEDS_BOX_DEFAULT, NEEDS_BOX_KEY, type NeedsBox, hiddenParts, isNeedsBox, showPart } from "../home.js";
import type { SettingsContext, SettingsSection } from "./types.js";

function HomePage({ ctx }: { ctx: SettingsContext }) {
  const [box, setBox] = useStored<NeedsBox>(NEEDS_BOX_KEY, undefined);
  const [kept, setKept] = useStored<string>(HOME_HIDDEN_KEY, undefined);
  const hidden = hiddenParts(kept);
  const putOff = Object.keys(ctx.putOff).length;
  return (
    <>
      <section>
        <h3>How tall Needs you is</h3>
        <p className="hint">Needs you keeps a fixed height and scrolls inside, so the rest of Home is always close by.</p>
        <Choice value={isNeedsBox(box) ? box : NEEDS_BOX_DEFAULT} onChange={(v) => setBox(v === NEEDS_BOX_DEFAULT ? undefined : v)}
          options={[
            { value: "short", label: "Short", hint: "About 5 rows" },
            { value: "medium", label: "Medium", hint: "About 8 rows. The usual choice" },
            { value: "tall", label: "Tall", hint: "About 12 rows" },
          ]} />
      </section>
      <section>
        <h3>What Home shows</h3>
        <p className="hint">Needs you always shows. Turn off the parts you don't look at.</p>
        {HOME_PARTS.map((p) => (
          <label key={p.id} className="option">
            <input type="checkbox" checked={!hidden.has(p.id)} onChange={(e) => setKept(showPart(kept, p.id, e.target.checked))} />
            <span><b>{p.label}</b><small>{p.hint}</small></span>
          </label>
        ))}
      </section>
      <section>
        <h3>Things to try you put off</h3>
        <p className="hint">{putOff === 0 ? "Nothing is put off." : `${putOff === 1 ? "1 goal is" : `${putOff} goals are`} out of Needs you because you pressed Not now.`}</p>
        <button className="btn ghost small" disabled={putOff === 0}
          onClick={() => {
            ctx.setPutOff({});
            ctx.toast("Everything you put off is back under Needs you.");
          }}>
          Bring them all back
        </button>
      </section>
    </>
  );
}

function Checks({ ctx }: { ctx: SettingsContext }) {
  const ci = ctx.computer?.settings.ci;
  if (!ci) return <p className="quiet">This setting needs a newer dashboard server. Restart Progressor to use it.</p>;
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={ci.enabled} onChange={(e) => void ctx.save("ci", { enabled: e.target.checked }).catch((err: Error) => ctx.toast(err.message))} />
        <span>
          <b>Show pull requests and checks</b>
          <small>
            Each goal and step shows its pull requests and whether their checks passed, and a goal whose checks failed shows in Needs you. Progressor
            asks GitHub (through the gh tool) or Gitea (with the token in GITEA_TOKEN) every few minutes, only to read. Turn it off and it asks nothing.
          </small>
        </span>
      </label>
    </>
  );
}

function Updates({ ctx }: { ctx: SettingsContext }) {
  const updates = ctx.computer?.settings.updates;
  if (!updates) return <p className="quiet">This setting needs a newer dashboard server. Restart Progressor to use it.</p>;
  return (
    <label className="option">
      <input type="checkbox" checked={updates.check} onChange={(e) => void ctx.save("updates", { check: e.target.checked }).catch((err: Error) => ctx.toast(err.message))} />
      <span>
        <b>Tell me when a newer Progressor is out</b>
        <small>
          Once a day, Progressor asks npm for the latest version number, and nothing else. When a newer one is out, a notice at the top of the dashboard
          says how to update, and your AI is told once. Close the notice to hide it until the next version. Turn this off and it asks nothing.
        </small>
      </span>
    </label>
  );
}

export const updatesSection: SettingsSection = {
  id: "updates",
  group: "notifications",
  title: "New versions",
  Component: Updates,
  reset: (ctx) => ctx.resetComputer("updates"),
};

export const homePageSection: SettingsSection = {
  id: "home-page",
  group: "look",
  title: "Home page",
  Component: HomePage,
  reset: (ctx) => {
    clearStored(NEEDS_BOX_KEY);
    clearStored(HOME_HIDDEN_KEY);
    ctx.setPutOff({});
  },
};

export const checksSection: SettingsSection = {
  id: "ci",
  group: "plan",
  title: "Pull requests and checks",
  Component: Checks,
  reset: (ctx) => ctx.resetComputer("ci"),
};
