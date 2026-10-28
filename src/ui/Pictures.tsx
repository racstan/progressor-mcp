import { useEffect, useState } from "react";
import type { GoalView } from "./data.js";
import { Icon } from "./Icon.js";

export type PictureItem = GoalView["pictures"][number];

/**
 * A row of the screenshots and screen recordings your AI attached, each with its caption. Clicking
 * one opens it large in front of the page.
 */
export function Pictures({ pictures }: { pictures: PictureItem[] }) {
  const [shown, setShown] = useState<PictureItem>();
  if (pictures.length === 0) return null;
  return (
    <>
      <ul className="pictures">
        {pictures.map((p) => (
          <li key={p.id}>
            <button type="button" className="picture" onClick={() => setShown(p)} title="Click to enlarge" aria-label={`${p.caption} (${p.kind === "video" ? "recording" : "picture"}): enlarge`}>
              <span className="frame">
                {p.kind === "video" ? (
                  <>
                    <video src={p.url} preload="metadata" muted playsInline tabIndex={-1} />
                    <span className="play"><Icon name="play" size={20} /></span>
                  </>
                ) : (
                  <img src={p.url} alt={p.caption} loading="lazy" />
                )}
              </span>
              <span className="caption">{p.caption}</span>
            </button>
          </li>
        ))}
      </ul>
      {shown && <Viewer picture={shown} onClose={() => setShown(undefined)} />}
    </>
  );
}

/** A picture or recording filling the window; Escape, the close button or a click outside it closes it. */
function Viewer({ picture: p, onClose }: { picture: PictureItem; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={p.caption} onClick={onClose}>
      <button type="button" className="viewer-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        {p.kind === "video" ? <video src={p.url} controls autoPlay playsInline /> : <img src={p.url} alt={p.caption} />}
        <figcaption>{p.caption}</figcaption>
      </figure>
    </div>
  );
}
