// What the dashboard shows while it waits for something: a row of gently bouncing dots with a short label,
// and, for a page or card, grey shimmering lines in the shape of what is coming. Screen readers hear the label once.
// With "reduce motion" on, the global rule in styles.css stills it into a plain grey outline.

export type LoadingSize = "page" | "card" | "inline";

/** How many shimmering lines a loader of this size draws, and how wide each one is (in %). */
export function skeletonLines(size: LoadingSize): number[] {
  if (size === "page") return [38, 92, 84, 88, 60];
  if (size === "card") return [70, 90, 54];
  return [];
}

export function Loading({ size = "card", label = "Loading" }: { size?: LoadingSize; label?: string }) {
  const lines = skeletonLines(size);
  return (
    <div className={`loading loading-${size}`} role="status" aria-live="polite">
      <span className="loading-label">
        <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
        {label}…
      </span>
      {lines.length > 0 && (
        <span className="skeleton" aria-hidden="true">
          {lines.map((w, i) => <i key={i} style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />)}
        </span>
      )}
    </div>
  );
}

/** A button's class while it may be sending something: "busy" adds a small spinner before its words. */
export const busyClass = (base: string, busy: boolean | undefined): string => (busy ? `${base} busy` : base);
