// Pull request links and a CI checks badge (ci.ts), beside a goal's or a step's commits.
// Light, Dark and System tell the states apart by border, weight and fill; only Vibrant adds colour.
// A run still going gently pulses its dot.
import type { CiPullRequest } from "./data.js";
import { CHECKS_HINT, CHECKS_WORDS, type ChecksState, pullRequestHint, pullRequestLabel } from "./words.js";

export function ChecksBadge({ checks }: { checks: ChecksState | undefined }) {
  if (!checks) return null;
  return (
    <span className={`ci-badge ${checks}`} title={CHECKS_HINT[checks]}>
      <span className="ci-dot" aria-hidden="true" />
      {CHECKS_WORDS[checks]}
    </span>
  );
}

export function PullRequestLinks({ prs }: { prs: CiPullRequest[] }) {
  return (
    <>
      {prs.map((pr) => (
        <a key={pr.url} className={`pr-link ${pr.state}`} href={pr.url} target="_blank" rel="noopener noreferrer" title={pullRequestHint(pr)}>
          {pullRequestLabel(pr)}
        </a>
      ))}
    </>
  );
}

/** A goal's pull requests and latest checks, in one row; nothing when there are none. */
export function GoalCiRow({ prs, checks }: { prs: CiPullRequest[]; checks: ChecksState | undefined }) {
  if (prs.length === 0 && !checks) return null;
  return (
    <div className="ci-row">
      <ChecksBadge checks={checks} />
      <PullRequestLinks prs={prs} />
    </div>
  );
}
