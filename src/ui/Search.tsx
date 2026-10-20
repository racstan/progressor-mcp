// The search box in the top bar: finds projects, goals and steps across every project as you
// type. "/" focuses it; arrow keys move through the results and Enter opens one.
import { useEffect, useRef, useState } from "react";
import type { SearchView } from "./data.js";
import { GOAL_WORD, STEP_WORD } from "./words.js";

export type SearchHit = SearchView[number];

const KINDS: { kind: SearchHit["kind"]; label: string; icon: string }[] = [
  { kind: "project", label: "Projects", icon: "📁" },
  { kind: "goal", label: "Goals", icon: "🎯" },
  { kind: "task", label: "Steps", icon: "•" },
];

/** Where a hit lives, under its title. */
const context = (h: SearchHit) =>
  h.kind === "project" ? h.detail : [h.project.name, h.goal?.title, h.status && (h.kind === "goal" ? GOAL_WORD : STEP_WORD)[h.status]].filter(Boolean).join(" · ");

export function SearchBox({ query, hits, onChange, onOpen }: {
  query: string;
  /** The results for `query`; undefined while searching. */
  hits: SearchView | undefined;
  onChange: (q: string) => void;
  onOpen: (hit: SearchHit) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const ordered = KINDS.flatMap(({ kind }) => (hits ?? []).filter((h) => h.kind === kind));
  useEffect(() => setActive(0), [hits]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "/" || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const open = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onOpen(hit);
    onChange("");
    input.current?.blur();
  };
  const showing = focused && query.trim() !== "";
  // The top bar clips what overflows it, so the results are placed on the page under the box.
  const box = showing ? input.current?.getBoundingClientRect() : undefined;

  return (
    <div className="search" role="search">
      <input
        ref={input}
        type="search"
        value={query}
        placeholder="Search projects, goals, steps…"
        title="Search every project for a goal or step (shortcut: /)"
        aria-label="Search projects, goals and steps"
        aria-controls="search-results"
        aria-expanded={showing}
        aria-activedescendant={showing && ordered[active] ? `search-hit-${active}` : undefined}
        role="combobox"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        // a click on a result lands before the box loses focus
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = ordered.length;
            if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
          } else if (e.key === "Enter") {
            e.preventDefault();
            open(ordered[active]);
          } else if (e.key === "Escape") {
            onChange("");
            input.current?.blur();
          }
        }}
      />
      {!focused && !query && <kbd aria-hidden="true">/</kbd>}
      {showing && (
        <div className="search-results" id="search-results" role="listbox" aria-label="Search results"
          style={box ? { top: box.bottom + 6, left: Math.max(16, Math.min(box.left, innerWidth - 496)) } : undefined}>
          {hits && ordered.length === 0 && <p className="empty">Nothing matches “{query.trim()}”.</p>}
          {!hits && <p className="empty">Searching…</p>}
          {KINDS.map(({ kind, label, icon }) => {
            const group = ordered.filter((h) => h.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} role="group" aria-label={label}>
                <h4>{label}</h4>
                {group.map((h) => {
                  const i = ordered.indexOf(h);
                  return (
                    <button
                      key={`${h.kind}:${h.project.id}:${h.goal?.id ?? ""}:${h.id ?? h.title}`}
                      id={`search-hit-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={`hit ${h.status ?? ""}`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => open(h)}
                    >
                      <span className="icon" aria-hidden="true">{icon}</span>
                      <span className="text">
                        <span className="t">{h.title}</span>
                        {context(h) && <span className="c">{context(h)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
