import { useEffect, useMemo } from "react";
import changelogText from "../../CHANGELOG.md";
import { parseChangelog, releaseBody } from "./changelog.js";
import { Icon } from "./Icon.js";

/** Where the changelog's relative links (docs/…) point. */
const DOCS_BASE = "https://github.com/racstan/progressor-mcp/blob/main/";

export const changelog = parseChangelog(changelogText);

/** What changed in each release, newest first: the newest open, the rest folded. Escape or a click outside closes it. */
export function WhatsNew({ version, onClose }: { version?: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  const releases = changelog.releases;
  const current = useMemo(() => releases.findIndex((r) => r.version === version), [releases, version]);
  return (
    <div className="changes-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="changes" role="dialog" aria-modal="true" aria-label="What's new">
        <header>
          <h2>What's new</h2>
          {version && <span className="quiet">You have Progressor {version}</span>}
          <span className="sp" />
          <button className="iconbtn" title="Close" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        <div className="changes-body">
          {releases.map((r, i) => (
            <details key={r.title} open={i === 0} className="release">
              <summary>
                <b>{r.version}</b>
                {r.name && <span>{r.name}</span>}
                {i === current && <span className="release-tag">Yours</span>}
                {current > 0 && i < current && <span className="release-tag new">Newer</span>}
              </summary>
              <div className="release-body">{releaseBody(r, DOCS_BASE)}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
