// Settings: the plan's history (history.ts), kept on this computer for every project.
import { useEffect, useState } from "react";
import type { SettingsContext, SettingsSection } from "./types.js";

type Limit = "keepDays" | "maxEntries" | "maxMB";
const LIMITS: { key: Limit; label: string; hint: string; min: number; step: number }[] = [
  { key: "keepDays", label: "Keep changes for", hint: "days", min: 1, step: 1 },
  { key: "maxEntries", label: "Keep at most", hint: "changes per project", min: 1, step: 1 },
  { key: "maxMB", label: "Use at most", hint: "MB per project", min: 1, step: 1 },
];

function LimitField({ ctx, limit, value, disabled }: { ctx: SettingsContext; limit: (typeof LIMITS)[number]; value: number; disabled: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const save = () => {
    const n = Number(text);
    if (!Number.isFinite(n) || n < limit.min || (limit.key !== "maxMB" && !Number.isInteger(n))) return setText(String(value));
    if (n !== value) void ctx.save("history", { [limit.key]: n }).catch((e: Error) => ctx.toast(e.message));
  };
  return (
    <label className="limit">
      <span>{limit.label}</span>
      <input type="number" min={limit.min} step={limit.step} value={text} disabled={disabled}
        onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} />
      <span className="quiet">{limit.hint}</span>
    </label>
  );
}

function History({ ctx }: { ctx: SettingsContext }) {
  const history = ctx.computer?.settings.history;
  if (ctx.computer === null) return <p className="hint">This dashboard is served by an older Progressor, which keeps no history.</p>;
  if (!history) return <p className="quiet">Loading…</p>;
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={history.enabled}
          onChange={(e) => void ctx.save("history", { enabled: e.target.checked }).catch((err: Error) => ctx.toast(err.message))} />
        <span>
          <b>Keep a history of changes</b>
          <small>Every change to the plan, by you or your AI, so you can go back to before any of them on the History page. Kept on this computer, never in git.</small>
        </span>
      </label>
      <div className="limits">
        {LIMITS.map((l) => (
          <LimitField key={l.key} ctx={ctx} limit={l} value={history[l.key]} disabled={!history.enabled} />
        ))}
      </div>
      <p className="hint">The oldest changes are let go first, once any of these is reached.</p>
    </>
  );
}

export const historySection: SettingsSection = {
  id: "history",
  title: "History",
  Component: History,
  reset: (ctx) => (ctx.computer === null ? undefined : ctx.resetComputer("history")),
};
