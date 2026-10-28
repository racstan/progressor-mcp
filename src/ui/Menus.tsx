import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** A panel that drops from the top bar: Help or Settings. */
export function MenuPanel({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest(".menu-panel") && !t.closest(".menu-btn") && !t.closest(".pop")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div className="menu-panel" role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

/** A row of mutually exclusive buttons, for a setting with a few short choices. */
export function Choice<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The right-click menu of a goal in the sidebar. */
export function GoalMenu({ at, children, onClose }: { at: { x: number; y: number }; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  useLayoutEffect(() => {
    const el = ref.current!;
    setPos({ left: Math.min(at.x, innerWidth - el.offsetWidth - 8), top: Math.min(at.y, innerHeight - el.offsetHeight - 8) });
    el.querySelector("button")?.focus();
  }, [at]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".goal-menu")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} className="goal-menu" role="menu" style={pos}>
      {children}
    </div>
  );
}
