// Where the dashboard runs (routes/daemon.ts): with your AI sessions, as usual, or always, in a small
// background process that starts when you log in. Either way is optional; your AI can set it up too.
import { useEffect, useState } from "react";
import type { DaemonView } from "../../dashboard/routes/daemon.js";
import type { SettingsContext, SettingsSection } from "./types.js";

async function load(): Promise<DaemonView | null> {
  try {
    const res = await fetch("/api/daemon");
    return res.ok ? ((await res.json()) as DaemonView) : null;
  } catch {
    return null;
  }
}

async function choose(background: boolean): Promise<DaemonView & { done: string }> {
  const res = await fetch("/api/daemon", {
    method: "POST",
    headers: { "x-progressor": "daemon", "content-type": "application/json" },
    body: JSON.stringify({ background }),
  });
  const body = (await res.json().catch(() => ({}))) as DaemonView & { done: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body;
}

function WhereItRuns({ ctx }: { ctx: SettingsContext }) {
  // undefined while loading; null when the server is too old to know
  const [view, setView] = useState<DaemonView | null>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const look = () => void load().then((v) => live && setView(v));
    look();
    const timer = setInterval(look, 10_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (view === null)
    return <p className="empty">The Progressor serving this page is older and can't run in the background. It can once it's updated.</p>;
  const pick = async (background: boolean) => {
    if (busy || view?.background === background) return;
    setBusy(true);
    try {
      const next = await choose(background);
      setView(next);
      ctx.toast(next.done.split("\n")[0]!);
    } catch (e) {
      ctx.toast(`That didn't work: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <label className="option">
        <input type="radio" name="where-dashboard" checked={view?.background === false} disabled={!view || busy} onChange={() => void pick(false)} />
        <span><b>With your AI sessions</b><small>The dashboard runs while your AI's app is open, and stops when the last one closes. The usual choice.</small></span>
      </label>
      <label className="option">
        <input type="radio" name="where-dashboard" checked={view?.background === true} disabled={!view || busy} onChange={() => void pick(true)} />
        <span><b>Always, in the background</b><small>A small process (about 30 MB of memory) keeps the dashboard up from when you log in, with no AI app open. Your AI sessions share it.</small></span>
      </label>
      <p className="hint" aria-live="polite">{busy ? "Setting it up…" : view ? view.text : "Looking…"}</p>
    </>
  );
}

export const backgroundSection: SettingsSection = {
  id: "where-dashboard",
  group: "advanced",
  title: "Where the dashboard runs",
  Component: WhereItRuns,
  // Back to the default, with your AI sessions; nothing to do when it already is.
  reset: async () => {
    const view = await load();
    if (view?.background) await choose(false);
  },
};
