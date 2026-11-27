import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { takeSyncLine } from "../src/sync/notice.js";
import { tempDir } from "./tmp.js";

function files(state: object) {
  const dir = tempDir("progressor-syncnotice-");
  const stateFile = join(dir, "sync-state.json");
  writeFileSync(stateFile, JSON.stringify(state));
  return { stateFile, toldFile: join(dir, "sync-told.json") };
}

const clash = (at: string) => ({ file: "goals/a.md", section: "Tasks", id: "t2", kept: "theirs", lost: "- [ ] Old ^t2", project: "github.com/me/app", host: "pc", at });

describe("takeSyncLine: the AI hears about a sync problem once", () => {
  it("says nothing while sync is off or all is well", () => {
    const f = files({ ok: true, offline: false, pending: 0, conflicts: [] });
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toBeUndefined();
    const g = files({ ok: false, problem: "Boom", offline: false, pending: 0, conflicts: [] });
    expect(takeSyncLine(g.stateFile, g.toldFile, false)).toBeUndefined();
  });

  it("tells a problem once, and again only when it changes", () => {
    const f = files({ ok: false, problem: "Couldn't upload", offline: false, pending: 1, conflicts: [] });
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toMatch(/Plan sync: Couldn't upload/);
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toBeUndefined();
    writeFileSync(f.stateFile, JSON.stringify({ ok: false, problem: "Something else", offline: false, pending: 1, conflicts: [] }));
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toMatch(/Something else/);
  });

  it("does not nag about being offline", () => {
    const f = files({ ok: false, problem: "Can't reach GitHub", offline: true, pending: 2, conflicts: [] });
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toBeUndefined();
  });

  it("tells new clashes once, with how many", () => {
    const f = files({ ok: true, offline: false, pending: 0, conflicts: [clash("2026-11-27T10:00:00.000Z"), clash("2026-11-27T10:00:00.000Z")] });
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toMatch(/2 changes.*Settings › Sync/);
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toBeUndefined();
    writeFileSync(f.stateFile, JSON.stringify({ ok: true, offline: false, pending: 0, conflicts: [clash("2026-11-27T10:00:00.000Z"), clash("2026-11-27T11:00:00.000Z")] }));
    expect(takeSyncLine(f.stateFile, f.toldFile, true)).toMatch(/1 change /);
  });
});
