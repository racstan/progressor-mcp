import { useEffect, useMemo } from "react";
import changelogText from "../../CHANGELOG.md";
import { parseChangelog, releaseBody } from "./changelog.js";
import { Icon } from "./Icon.js";

/** Where the changelog's relative links (docs/…) point. */
const DOCS_BASE = "https://github.com/racstan/progressor-mcp/blob/main/";

export const changelog = parseChangelog(changelogText);

/**
 * What changed in each release, newest first: the newest open, the rest folded. Escape or a click
 * outside closes it. It opens by itself the first time after the version changes (firstLook.ts),
 * unless Don't show again is ticked.
 */
export function WhatsNew({ version, onClose, autoOpen, onAutoOpen }: {
  version?: string;
  onClose: () => void;
  /** Whether it opens by itself on new versions. */
  autoOpen: boolean;
  onAutoOpen: (on: boolean) => void;
}) {
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
        <footer className="changes-foot">
          <label className="option">
            <input type="checkbox" checked={!autoOpen} onChange={(e) => onAutoOpen(!e.target.checked)} />
            <span><b>Don't show again</b><small>Don't open this by itself when Progressor is updated. It's always in ❓ Help › What's new, and a dot on Help says when there's something new.</small></span>
          </label>
          <span className="sp" />
          <button className="btn small" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
