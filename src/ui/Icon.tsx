// Simple line icons, drawn the same on every computer (emoji are not: they differ between Windows,
// macOS and Linux, and some Linux fonts have none). 24-unit grid, stroke in the text colour.

const PATHS = {
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  help: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  copy: "M9 9h10v11H9zM5 15V4h10",
  file: "M14 3H6v18h12V7zM14 3v4h4",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  send: "M4 12l16-8-6 16-2-7z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  note: "M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5",
  pin: "M12 21v-6M7 4h10l-2 6 3 3H6l3-3z",
  play: "M8 5v14l11-7z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  chart: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  folder: "M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** A small ring that fills as a goal's steps get done; full and green once the goal is finished. */
export function Ring({ done, total, finished, size = 16 }: { done: number; total: number; finished?: boolean; size?: number }) {
  const r = 6.5;
  const c = 2 * Math.PI * r;
  const part = finished ? 1 : total > 0 ? done / total : 0;
  return (
    <svg className={`ring ${finished ? "finished" : ""}`} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="ring-track" />
      {part > 0 && (
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="ring-fill" strokeDasharray={`${part * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 8 8)" />
      )}
    </svg>
  );
}
