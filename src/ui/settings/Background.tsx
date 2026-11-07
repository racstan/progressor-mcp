// Where the dashboard runs (routes/daemon.ts): with your AI sessions, as usual, or always, in a small
// background process that starts when you log in. Either way is optional; your AI can set it up too.
import { useEffect, useRef, useState } from "react";
import { DONE_TEXT, WAIT_TEXT, switchWhere } from "./switching.js";
import type { DaemonView } from "../../dashboard/routes/daemon.js";
import type { SettingsContext, SettingsSection } from "./types.js";

/** How it runs now; null when the server is too old to know, undefined when it didn't answer (it may be changing). */
async function load(): Promise<DaemonView | null | undefined> {
  try {
    const res = await fetch("/api/daemon", { cache: "no-store" });
    return res.ok ? ((await res.json()) as DaemonView) : res.status === 404 ? null : undefined;
  } catch {
    return undefined;
  }
}

/** Asks the server to switch: a TypeError when the connection is lost on the way, an Error in words when refused. */
async function choose(background: boolean): Promise<DaemonView> {
  const res = await fetch("/api/daemon", {
    method: "POST",
    headers: { "x-progressor": "daemon", "content-type": "application/json" },
    body: JSON.stringify({ background }),
  });
  const body = (await res.json().catch(() => ({}))) as DaemonView & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
  return body;
}

async function view(): Promise<DaemonView> {
  const res = await fetch("/api/daemon", { cache: "no-store" });
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  return (await res.json()) as DaemonView;
}

/** What the section says while and after switching. */
type Progress = { state: "waiting"; text: string } | { state: "done" | "failed"; text: string };

function WhereItRuns({ ctx: _ctx }: { ctx: SettingsContext }) {
  // undefined while loading; null when the server is too old to know
  const [shown, setShown] = useState<DaemonView | null>();
  const [progress, setProgress] = useState<Progress>();
  const busy = progress?.state === "waiting";
  useEffect(() => {
    let live = true;
    const look = () => void load().then((v) => live && !busyRef.current && v !== undefined && setShown(v));
    look();
    const timer = setInterval(look, 10_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const busyRef = useRef(false);
  busyRef.current = busy;
  if (shown === null)
    return <p className="empty">The Progressor serving this page is older and can't run in the background. It can once it's updated.</p>;
  const pick = async (background: boolean) => {
    if (busy || shown?.background === background) return;
    const which = background ? "on" : "off";
    setProgress({ state: "waiting", text: WAIT_TEXT[which] });
    const result = await switchWhere(background, {
      post: choose,
      get: view,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      onReconnecting: () => setProgress({ state: "waiting", text: `${WAIT_TEXT[which]} Reconnecting…` }),
    });
    if (result.ok) {
      if (result.view) setShown(result.view);
      else setShown({ background: false, status: null, text: "The background dashboard is not running." });
      setProgress({ state: "done", text: background ? DONE_TEXT.on : result.view ? DONE_TEXT.off : DONE_TEXT.offAlone });
    } else setProgress({ state: "failed", text: `That didn't work: ${result.error}` });
  };
  return (
    <>
      <fieldset className="where-choice" disabled={!shown || busy} aria-busy={busy}>
        <label className="option">
          <input type="radio" name="where-dashboard" checked={shown?.background === false} onChange={() => void pick(false)} />
          <span><b>With your AI sessions</b><small>The dashboard runs while your AI's app is open, and stops when the last one closes. The usual choice.</small></span>
        </label>
        <label className="option">
          <input type="radio" name="where-dashboard" checked={shown?.background === true} onChange={() => void pick(true)} />
          <span><b>Always, in the background</b><small>A small process (about 30 MB of memory) serves the dashboard from when you log in, with no AI app open. Your AI chats still each run a small Progressor process to talk to it.</small></span>
        </label>
      </fieldset>
      {progress && (
        <p className={`switch-note ${progress.state}`} role={progress.state === "failed" ? "alert" : "status"} aria-live="polite">
          {busy && <span className="spinner" aria-hidden="true" />}
          {progress.text}
        </p>
      )}
      {!busy && <p className="hint" aria-live="polite">{shown ? shown.text : "Looking…"}</p>}
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
    const now = await load();
    if (now?.background) await choose(false).catch(() => undefined);
  },
};
