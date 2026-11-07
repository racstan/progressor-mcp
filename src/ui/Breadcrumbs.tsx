// The trail at the top of every page: Home › project › page. Home and the project are links back;
// on a narrow window the middle of the trail shortens first, so it never runs off the screen.
import type { Crumb } from "./route.js";

export function Breadcrumbs({ trail, onHome, onProject }: { trail: Crumb[]; onHome: () => void; onProject: () => void }) {
  return (
    <nav className="crumbs" aria-label="Where you are">
      <ol>
        {trail.map((c, i) => (
          <li key={i} className={i === 0 ? "first" : i === trail.length - 1 ? "last" : "middle"}>
            {i > 0 && <span className="sep" aria-hidden="true">›</span>}
            {c.to ? (
              <button className="crumb-link" title={c.to === "home" ? "Home: every project at a glance" : `${c.label}: back to its goals`}
                onClick={c.to === "home" ? onHome : onProject}>
                {c.label}
              </button>
            ) : (
              <span className="crumb-here" aria-current="page" title={c.label}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
