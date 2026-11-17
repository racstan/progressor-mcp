// The notice at the top of every page when a newer Progressor is out (updateCheck.ts): the command to
// update for how it was installed, a link to what changed, and a button that hides it until a newer
// version than that one comes out. Nothing shows offline, with the check off, or while the sample shows.
import { useEffect, useState } from "react";
import { getJson, live } from "./data.js";
import { Icon } from "./Icon.js";
import { sampleOn } from "./sample.js";

export interface UpdateInfo {
  current: string;
  latest?: string;
  available: boolean;
  install: "global" | "npx" | "docker";
  command: string;
  enabled: boolean;
}

const RELEASES = "https://github.com/racstan/progressor-mcp/releases/tag/v";

export function UpdateNotice({ toast }: { toast: (text: string) => void }) {
  const [info, setInfo] = useState<UpdateInfo>();
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (sampleOn()) return;
      getJson<UpdateInfo>("/api/update")
        .then((v) => alive && setInfo(v))
        .catch(() => undefined);
    };
    load();
    const stop = live.on({ update: () => load(), settings: () => load() });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  if (!info?.available || !info.latest || sampleOn()) return null;
  const latest = info.latest;

  const dismiss = async () => {
    setInfo({ ...info, available: false });
    const res = await fetch("/api/update/dismiss", {
      method: "POST",
      headers: { "x-progressor": "update", "content-type": "application/json" },
      body: JSON.stringify({ version: latest }),
    }).catch(() => undefined);
    if (!res?.ok) toast("Couldn't hide it for good; it may show again after a reload.");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.command);
      toast("Copied. Paste it into a terminal, then restart your AI app.");
    } catch {
      toast("Couldn't copy: select the command and copy it yourself.");
    }
  };
  const npx = info.install === "npx";

  return (
    <section className="update-notice" role="status" aria-label="A newer Progressor is out">
      <div className="update-text">
        <b>
          Progressor {latest} is out <span className="update-current">(you have {info.current})</span>
        </b>
        {npx ? (
          <span>Restart your AI app and it fetches the new version by itself.</span>
        ) : (
          <span>
            Update with <code className="update-command">{info.command}</code>, then restart your AI app. Or ask your AI to do it.
          </span>
        )}
      </div>
      <div className="update-actions">
        {!npx && (
          <button className="btn ghost" onClick={() => void copy()}>
            <Icon name="copy" /> Copy
          </button>
        )}
        <a className="btn ghost" href={`${RELEASES}${latest}`} target="_blank" rel="noopener noreferrer">
          What changed
        </a>
        <button className="iconbtn" aria-label={`Hide until a version newer than ${latest}`} title="Hide until the next version" onClick={() => void dismiss()}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </section>
  );
}
