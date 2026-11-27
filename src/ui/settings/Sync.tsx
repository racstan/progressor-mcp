// Plan sync (routes/sync.ts): whether this computer keeps its plans in the private plans repo, how the
// last sync went, the switch for messages and screenshots, and what lost a clash. Your AI turns it on
// with one command; nothing here is needed for it to work.
import { useEffect, useState } from "react";
import type { SyncView } from "../../dashboard/routes/sync.js";
import type { SettingsContext, SettingsSection } from "./types.js";

async function load(): Promise<SyncView | null | undefined> {
  try {
    const res = await fetch("/api/sync", { cache: "no-store" });
    return res.ok ? ((await res.json()) as SyncView) : res.status === 404 ? null : undefined;
  } catch {
    return undefined;
  }
}

async function post(what: "now" | "off"): Promise<SyncView> {
  const res = await fetch(`/api/sync/${what}`, { method: "POST", headers: { "x-progressor": "sync", "content-type": "application/json" }, body: "{}" });
  const body = (await res.json().catch(() => ({}))) as SyncView & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
  return body;
}

const when = (iso: string | undefined) => (iso ? new Date(iso).toLocaleString() : "not yet");

function Sync({ ctx }: { ctx: SettingsContext }) {
  const [shown, setShown] = useState<SyncView | null>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const look = () => void load().then((v) => live && v !== undefined && setShown(v));
    look();
    const timer = setInterval(look, 15_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (shown === null) return <p className="empty">The Progressor serving this page is older and can't sync plans. It can once it's updated.</p>;
  if (shown === undefined) return <p className="quiet">Loading…</p>;
  const act = async (what: "now" | "off") => {
    setBusy(true);
    try {
      setShown(await post(what));
    } catch (e) {
      ctx.toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const { state } = shown;
  if (!shown.enabled)
    return (
      <>
        <p>
          <b>Off on this computer.</b> Turn it on to keep every project's plan the same on all your computers, through one private GitHub repository of
          yours.
        </p>
        <p className="quiet">
          Ask your AI: <i>“Turn on plan sync for this computer.”</i> It runs <code>npx progressor-mcp sync connect</code>, which finds or makes your
          private <code>progressor-plans</code> repository. Do the same on each computer.
        </p>
      </>
    );
  return (
    <>
      <p>
        <b>On</b>, with <code>{shown.repo}</code>.
      </p>
      <p className="quiet">
        Last synced: {when(state.lastSync)}
        {state.pending > 0 ? ` · ${state.pending} change${state.pending === 1 ? "" : "s"} waiting to upload` : ""}
      </p>
      {state.problem ? (
        <p>
          <b>{state.offline ? "Offline. " : "Problem: "}</b>
          {state.problem}
        </p>
      ) : null}
      <p>
        <button type="button" disabled={busy} onClick={() => void act("now")}>
          {busy ? "Syncing…" : "Sync now"}
        </button>{" "}
        <button type="button" disabled={busy} onClick={() => void act("off")}>
          Turn off on this computer
        </button>
      </p>
      <label className="option">
        <input type="checkbox" checked={shown.talk} onChange={(e) => void ctx.save("sync", { talk: e.target.checked }).then(() => load().then((v) => v && setShown(v))).catch((err: Error) => ctx.toast(err.message))} />
        <span>
          <b>Sync messages and screenshots too</b>
          <small>Off, your messages with your AI, its screenshots and attached files stay on this computer. Goals and steps always sync.</small>
        </span>
      </label>
      {state.conflicts.length > 0 ? (
        <>
          <h4>When two computers changed the same thing</h4>
          <p className="quiet">The newer change was kept. Here is the other one, so nothing is lost.</p>
          <ul>
            {[...state.conflicts].reverse().map((c, i) => (
              <li key={i}>
                <details>
                  <summary>
                    {c.project} · {c.file}
                    {c.id ? ` · ${c.id}` : ""} · {when(c.at)} · kept the {c.kept === "ours" ? `change from ${c.host}` : "change from another computer"}
                  </summary>
                  {c.lost ? <pre>{c.lost}</pre> : <p className="quiet">The other side had deleted it.</p>}
                </details>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

export const syncSection: SettingsSection = {
  id: "sync",
  group: "plan",
  title: "Sync",
  Component: Sync,
  reset: (ctx) => ctx.resetComputer("sync"),
};
