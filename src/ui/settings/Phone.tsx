// The "Phone notifications" section of Settings: pushes to the ntfy app on a phone, sent by the
// dashboard's server (ntfy.ts). Off until turned on; the private topic is made then. One choice: the
// default (ntfy.sh and that private topic) or your own server, topic and token (phoneMode.ts).
import { useEffect, useState } from "react";
import { PHONE_EVENTS, PHONE_HOW, PHONE_OFF_NOTE, PHONE_TITLES_HINT, PHONE_WARNING, phoneAddress } from "../words.js";
import { DEFAULT_PHONE_SERVER, phoneMode, topicProblem } from "./phoneMode.js";
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

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/** The address to subscribe to, with Copy (which says "Copied" for a moment) and a link to open it. */
function Address({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="phone-address">
      <p>Subscribe to this address in the ntfy app:</p>
      <div className="phone-address-row">
        <code>{address}</code>
        <button className="btn small" aria-live="polite" onClick={() => void copyText(address).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
        <a className="btn ghost small" href={address} target="_blank" rel="noreferrer">Open</a>
      </div>
      <p className="muted">{PHONE_HOW}</p>
    </div>
  );
}

function Phone({ ctx }: { ctx: SettingsContext }) {
  const ntfy = ctx.computer?.settings.ntfy as Ntfy | undefined;
  const tokenSet = ctx.computer?.secretsSet.includes("ntfy.token") ?? false;
  const inUse = ntfy ? phoneMode(ntfy, tokenSet) : "default";
  const [mode, setMode] = useState<"default" | "own">(inUse);
  const [server, setServer] = useState(ntfy?.server ?? DEFAULT_PHONE_SERVER);
  const [topic, setTopic] = useState(ntfy?.topic ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setMode(inUse), [inUse]);
  useEffect(() => setServer(ntfy?.server ?? DEFAULT_PHONE_SERVER), [ntfy?.server]);
  useEffect(() => setTopic(ntfy?.topic ?? ""), [ntfy?.topic]);
  if (!ntfy) return <p className="muted">Phone notifications need a newer dashboard. Restart Progressor to get it.</p>;
  const save = (values: Record<string, unknown>) => ctx.save("ntfy", values).catch((e: Error) => ctx.toast(e.message));
  const address = ntfy.topic ? phoneAddress(ntfy.server, ntfy.topic) : "";
  const problem = topicProblem(topic.trim());

  const useDefault = async () => {
    setMode("default");
    if (inUse === "default") return;
    try {
      await ctx.save("ntfy", { server: DEFAULT_PHONE_SERVER, token: "" });
      // a topic of your own may be known to others, so the default always gets a private one
      if (!/^progressor-[0-9a-f]{16}$/.test(ntfy.topic)) await ctx.renewTopic();
      ctx.toast("Back to the default: ntfy.sh with a private address. Subscribe to it in the ntfy app.");
    } catch (e) {
      ctx.toast((e as Error).message);
    }
  };
  const renew = async () => {
    if (!confirm("Make a new private address? Your phone stops getting messages until you subscribe to the new one in the ntfy app.")) return;
    try {
      await ctx.renewTopic();
      ctx.toast("New address made. Subscribe to it in the ntfy app.");
    } catch (e) {
      ctx.toast((e as Error).message);
    }
  };

  return (
    <div className="phone">
      <label className="option">
        <input type="checkbox" checked={ntfy.enabled} onChange={(e) => void save({ enabled: e.target.checked })} />
        <span><b>Send me messages on my phone</b><small>{ntfy.enabled ? "On. Sent through ntfy while the dashboard is running." : PHONE_OFF_NOTE}</small></span>
      </label>
      {ntfy.enabled && (
        <>
          <div className="phone-choice" role="radiogroup" aria-label="Where messages are sent">
            <label className="option">
              <input type="radio" name="phone-mode" checked={mode === "default"} onChange={() => void useDefault()} />
              <span><b>Use the default (recommended)</b><small>The free ntfy.sh service, with a private address Progressor made for you.</small></span>
            </label>
            <label className="option">
              <input type="radio" name="phone-mode" checked={mode === "own"} onChange={() => setMode("own")} />
              <span><b>Use my own</b><small>Your own ntfy server, a topic you chose, or a token for a protected topic.</small></span>
            </label>
          </div>

          {mode === "default" ? (
            <>
              {address && <Address address={address} />}
              <div className="phone-actions">
                <button className="btn ghost small" onClick={() => void renew()}>Make a new private address</button>
              </div>
            </>
          ) : (
            <div className="phone-own">
              <label className="phone-field">
                <span>Server</span>
                <input className="picker" value={server} placeholder={DEFAULT_PHONE_SERVER} onChange={(e) => setServer(e.target.value)}
                  onBlur={() => server.trim() && server.trim() !== ntfy.server && void save({ server: server.trim() })} />
              </label>
              <label className="phone-field">
                <span>Topic</span>
                <input className="picker" value={topic} aria-invalid={!!problem} onChange={(e) => setTopic(e.target.value)}
                  onBlur={() => !problem && topic.trim() !== ntfy.topic && void save({ topic: topic.trim() })} />
              </label>
              {problem && topic !== ntfy.topic && <p className="phone-problem" role="alert">{problem}</p>}
              <label className="phone-field">
                <span>Token {tokenSet ? "(one is saved)" : "(optional)"}</span>
                <input className="picker" type="password" autoComplete="off" value={token} placeholder={tokenSet ? "Type a new one to change it" : "Only for a protected topic"}
                  onChange={(e) => setToken(e.target.value)} />
              </label>
              <div className="phone-actions">
                <button className="btn ghost small" disabled={!token} onClick={() => void save({ token }).then(() => setToken(""))}>Save token</button>
                {tokenSet && <button className="btn ghost small" onClick={() => void save({ token: "" })}>Remove token</button>}
              </div>
              {address && <Address address={address} />}
            </div>
          )}

          <p className="phone-warning" role="note"><b>Keep the address private.</b> {PHONE_WARNING}</p>
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
  group: "notifications",
  title: "Phone notifications",
  Component: Phone,
  reset: (ctx) => (ctx.computer === null ? undefined : ctx.resetComputer("ntfy")),
};
