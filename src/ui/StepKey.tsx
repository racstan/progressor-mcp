import { STEP_HINT, STEP_MARK, STEP_WORD, isBadge, statusClass } from "./words.js";

/** The step states that look different from the usual to-do, doing, done; each has a mark worth explaining. */
export const KEYED = ["with a helper", "waiting on you", "checked", "released"] as const;

/** The mark of a step state, as in the list and on the map. */
export function StepMark({ status }: { status: string }) {
  return (
    <span className={`mark ${statusClass(status)} ${isBadge(status) ? "mk" : ""}`} aria-hidden="true">
      {STEP_MARK[status]}
    </span>
  );
}

/**
 * What the marks mean, as a row of small entries (a legend) or, with `all`, a list with each one's
 * explanation (the Help panel). By default only the states that this plan has are named.
 */
export function StepKey({ statuses, className, all }: { statuses: readonly string[]; className?: string; all?: boolean }) {
  const shown = all ? KEYED : KEYED.filter((k) => statuses.includes(k));
  if (shown.length === 0) return null;
  if (all)
    return (
      <ul className={`step-key all ${className ?? ""}`}>
        {shown.map((k) => (
          <li key={k}>
            <StepMark status={k} />
            <span><b>{STEP_WORD[k]}</b><small>{STEP_HINT[k]}</small></span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className={`step-key ${className ?? ""}`} aria-label="What the marks mean">
      {shown.map((k) => (
        <span key={k} title={STEP_HINT[k]}>
          <StepMark status={k} /> {STEP_WORD[k]}
        </span>
      ))}
    </div>
  );
}
