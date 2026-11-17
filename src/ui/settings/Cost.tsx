// The "What goals cost" section of Settings (settings.ts, "cost"): prices per million tokens, so goals
// and steps show money beside their tokens. Left at 0, they show tokens only.
import { useEffect, useState } from "react";
import type { SettingsContext, SettingsSection } from "./types.js";

function Price({ label, value, onSave }: { label: string; value: number; onSave: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const save = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= 0 && n <= 1000 && n !== value) onSave(Math.round(n * 100) / 100);
    else setText(String(value));
  };
  return (
    <label className="phone-field">
      <span>{label}</span>
      <input className="picker" type="number" min={0} max={1000} step={0.01} value={text}
        onChange={(ev) => setText(ev.target.value)} onBlur={save} onKeyDown={(ev) => ev.key === "Enter" && save()} />
      <small className="quiet">dollars per million tokens</small>
    </label>
  );
}

function Cost({ ctx }: { ctx: SettingsContext }) {
  const c = ctx.computer?.settings.cost;
  if (!c) return <p className="quiet">This setting needs a newer dashboard server. Restart Progressor to use it.</p>;
  const save = (values: Partial<typeof c>) => void ctx.save("cost", values).catch((e: Error) => ctx.toast(e.message));
  return (
    <>
      <Price label="Tokens your AI reads" value={c.inputPrice} onSave={(n) => save({ inputPrice: n })} />
      <Price label="Tokens your AI writes" value={c.outputPrice} onSave={(n) => save({ outputPrice: n })} />
      <p className="hint">
        Each goal and step shows how many tokens your AI used on it, counted by itself as it works. Put in your AI's prices to see what that cost in
        money too (for example 3 and 15 for Claude Sonnet). Reading what it read before is cheaper, so it counts at a tenth. Leave both at 0 to see
        tokens only.
      </p>
    </>
  );
}

export const costSection: SettingsSection = {
  id: "cost",
  group: "plan",
  title: "What goals cost",
  Component: Cost,
  reset: (ctx) => ctx.resetComputer("cost"),
};
