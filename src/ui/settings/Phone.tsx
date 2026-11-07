// The "Phone notifications" section of Settings: pushes to the ntfy app on a phone, sent by the
// dashboard's server (ntfy.ts). Off until turned on; the topic is made then.
import { useEffect, useState } from "react";
import { PHONE_EVENTS, PHONE_HOW, PHONE_OFF_NOTE, PHONE_TITLES_HINT, PHONE_WARNING, phoneAddress } from "../words.js";
import type { SettingsContext, SettingsSection } from "./types.js";

type Ntfy = { enabled: boolean; server: string; topic: string; events: Record<string, boolean>; includeTitles: boolean };

async function sendTest(): Promise<string> {
  try {
    const res = await fetch("/api/settings/ntfy/test", { method: "POST", headers: { "x-progressor": "ntfy" } });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? "Test sent. It should show up on your phone in a moment." : (body.error ?? "The test could not be sent.");
  } catch {
    return "The test could not be sent.";
  }
}

function Phone({ ctx }: { ctx: SettingsContext }) {
  const ntfy = ctx.computer?.settings.ntfy as Ntfy | undefined;
  const [server, setServer] = useState(ntfy?.server ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setServer(ntfy?.server ?? ""), [ntfy?.server]);
  if (!ntfy) return <p className="muted">Phone notifications need a newer dashboard. Restart Progressor to get it.</p>;
  const tokenSet = ctx.computer?.secretsSet.includes("ntfy.token") ?? false;
  const save = (values: Record<string, unknown>) => ctx.save("ntfy", values).catch((e: Error) => ctx.toast(e.message));
  const address = ntfy.topic ? phoneAddress(ntfy.server, ntfy.topic) : "";
  return (
    <div className="phone">
      <label className="option">
        <input type="checkbox" checked={ntfy.enabled} onChange={(e) => void save({ enabled: e.target.checked })} />
        <span><b>Send me messages on my phone</b><small>{ntfy.enabled ? "On. Sent through ntfy while the dashboard is running." : PHONE_OFF_NOTE}</small></span>
      </label>
      {ntfy.enabled && (
        <>
          {address && (
            <div className="phone-address">
              <p>Subscribe to this address in the ntfy app:</p>
              <p><a href={address} target="_blank" rel="noreferrer"><code>{address}</code></a></p>
              <p className="muted">{PHONE_HOW}</p>
            </div>
          )}
          <p className="phone-warning" role="note"><b>Keep the topic private.</b> {PHONE_WARNING}</p>
          <label className="phone-field">
            <span>Server</span>
            <input className="picker" value={server} onChange={(e) => setServer(e.target.value)}
              onBlur={() => server !== ntfy.server && server.trim() && void save({ server: server.trim() })} />
          </label>
          <label className="phone-field">
            <span>Token {tokenSet ? "(one is saved)" : "(optional)"}</span>
            <input className="picker" type="password" autoComplete="off" value={token} placeholder={tokenSet ? "Type a new one to change it" : "Only for a protected topic"}
              onChange={(e) => setToken(e.target.value)} />
          </label>
          <div className="phone-actions">
            <button className="btn ghost small" disabled={!token} onClick={() => void save({ token }).then(() => setToken(""))}>Save token</button>
            {tokenSet && <button className="btn ghost small" onClick={() => void save({ token: "" })}>Remove token</button>}
          </div>
          <h4>Tell me</h4>
          {PHONE_EVENTS.map(([key, label, hint]) => (
            <label key={key} className="option">
              <input type="checkbox" checked={ntfy.events[key] ?? false} onChange={(e) => void save({ events: { [key]: e.target.checked } })} />
              <span><b>{label}</b><small>{hint}</small></span>
            </label>
          ))}
          <label className="option">
            <input type="checkbox" checked={ntfy.includeTitles} onChange={(e) => void save({ includeTitles: e.target.checked })} />
            <span><b>Include goal and project names</b><small>{PHONE_TITLES_HINT}</small></span>
          </label>
          <div className="phone-actions">
            <button className="btn ghost small" disabled={busy} onClick={() => { setBusy(true); void sendTest().then((m) => { ctx.toast(m); setBusy(false); }); }}>Send a test</button>
          </div>
        </>
      )}
    </div>
  );
}

export const phoneSection: SettingsSection = {
  id: "phone",
  title: "Phone notifications",
  Component: Phone,
  reset: (ctx) => (ctx.computer === null ? undefined : ctx.resetComputer("ntfy")),
};
