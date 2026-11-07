// The "Releases" section of Settings (settings.ts, "release"): which file your AI writes the changelog
// entry in, and which files carry the version it bumps, when it works on a release goal (facts.ts).
import { useEffect, useState } from "react";
import type { SettingsContext, SettingsSection } from "./types.js";

function Release({ ctx }: { ctx: SettingsContext }) {
  const r = ctx.computer?.settings.release;
  const [changelog, setChangelog] = useState(r?.changelog ?? "");
  const [files, setFiles] = useState(r?.files.join(", ") ?? "");
  useEffect(() => {
    setChangelog(r?.changelog ?? "");
    setFiles(r?.files.join(", ") ?? "");
  }, [r?.changelog, r?.files.join(",")]);
  if (!r) return <p className="quiet">These settings need a newer dashboard server. Restart Progressor to use them.</p>;
  const saveChangelog = () => {
    const v = changelog.trim();
    if (v && v !== r.changelog) void ctx.save("release", { changelog: v });
    else setChangelog(r.changelog);
  };
  const saveFiles = () => {
    const list = files.split(",").map((f) => f.trim()).filter(Boolean);
    if (list.join(",") !== r.files.join(",")) void ctx.save("release", { files: list });
  };
  return (
    <>
      <p className="quiet">When your AI works on a release goal, Progressor hands it the finished goals, their steps and decisions, and the commits since the last version. Your AI writes the changelog entry and the new version from them, and asks before tagging or publishing.</p>
      <label className="phone-field">
        <span>Changelog file</span>
        <input className="picker" type="text" value={changelog} onChange={(ev) => setChangelog(ev.target.value)} onBlur={saveChangelog} spellCheck={false} />
      </label>
      <label className="phone-field">
        <span>Files with the version (separated by commas; ones a project doesn't have are skipped)</span>
        <input className="picker" type="text" value={files} onChange={(ev) => setFiles(ev.target.value)} onBlur={saveFiles} spellCheck={false} />
      </label>
    </>
  );
}

export const releaseSection: SettingsSection = {
  id: "release",
  group: "records",
  title: "Releases",
  Component: Release,
  reset: (ctx) => ctx.resetComputer("release"),
};
