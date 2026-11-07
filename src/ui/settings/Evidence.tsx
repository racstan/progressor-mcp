// The Evidence section of Settings: whether a finished step records what git says about its work
// (settings.ts, "evidence"), and whether your AI is warned about files not saved in git.
import type { SettingsContext, SettingsSection } from "./types.js";

function Evidence({ ctx }: { ctx: SettingsContext }) {
  const e = ctx.computer?.settings.evidence;
  if (!e) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  return (
    <>
      <label className="option">
        <input type="checkbox" checked={e.record} onChange={(ev) => void ctx.save("evidence", { record: ev.target.checked })} />
        <span><b>Link finished steps to their commits and tests</b><small>When a step is finished, its commits, branch and test run are saved on it and shown here, with links to the commits when the project is on GitHub, GitLab or Gitea.</small></span>
      </label>
      <label className="option">
        <input type="checkbox" checked={e.warnUncommitted} disabled={!e.record} onChange={(ev) => void ctx.save("evidence", { warnUncommitted: ev.target.checked })} />
        <span><b>Warn about work not saved in git</b><small>Your AI is told, and the step is marked, when a finished step's files still have changes not saved in git.</small></span>
      </label>
    </>
  );
}

export const evidenceSection: SettingsSection = {
  id: "evidence",
  group: "plan",
  title: "Commits and tests",
  Component: Evidence,
  reset: (ctx) => ctx.resetComputer("evidence"),
};
