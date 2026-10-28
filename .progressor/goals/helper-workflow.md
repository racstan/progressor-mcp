# Helpers, checks and hand tests

## Tasks

- [x] Record a helper's branch and folder on a step ^t1
  - summary: set_task_state 'with a helper' (and update_tasks) take optional helper info: branch, worktree folder, helper name. get_status and the dashboard show it, and get_status warns about helper work that was handed back but never merged or released (orphaned branches/folders).
  - code: `src/helperWork.ts`
  - code: `src/planFile.ts`
  - code: `src/server.ts`
  - code: `src/project.ts`
  - code: `src/ui/Checklist.tsx`
  - estimate: 2h
  - time spent: 5m
  - updated from: rachitkdeaichat at 2026-10-28T03:33:07.152Z
- [-] Definition of done per project ^t2
  - summary: A per-project checklist (e.g. tests, container check, live send, install, push) that a step goes through between checked and released; tools to tick items with a short note; the dashboard shows which checks a step has passed, and releasing warns when items are unticked.
  - estimate: 3h
  - updated from: rachitkdeaichat at 2026-10-28T03:27:32.657Z
  - reason: The Developer dropped the rest of this goal (2026-10-28).
  - updated: 2026-10-28T11:42:08.252Z by AI
- [x] Evidence when a step is checked ^t3
  - summary: Marking a step checked takes a short evidence line ('715 passed, live send OK'); it is kept on the step and shown on the dashboard and in get_status.
  - code: `src/planFile.ts`
  - code: `src/server.ts`
  - code: `src/ui/words.ts`
  - estimate: 1h
  - time spent: 5m
  - updated from: rachitkdeaichat at 2026-10-28T03:33:07.152Z
- [x] Locks on shared resources ^t4
  - summary: A session or helper claims a named resource (dev-window, plasmashell) with a short reason; others see who holds it and are refused or warned; locks expire if the holder's session ends.
  - code: `src/resources.ts`
  - code: `src/server.ts`
  - code: `src/project.ts`
  - code: `src/ui/App.tsx`
  - estimate: 2h
  - time spent: 5m
  - updated from: rachitkdeaichat at 2026-10-28T03:38:06.593Z
- [x] Hand-test list the Developer ticks ^t5
  - summary: Per Goal, things only the Developer can test. The Agent adds items; the Developer marks each on the dashboard as works, doesn't work (with a note) or won't test. A failed item becomes a new step automatically; get_status shows the results to the next session.
  - code: `src/planFile.ts`
  - code: `src/project.ts`
  - code: `src/server.ts`
  - code: `src/dashboard/http.ts`
  - code: `src/ui/HandTests.tsx`
  - estimate: 3h
  - time spent: 10m
  - updated from: rachitkdeaichat at 2026-10-28T03:38:06.593Z
- [-] Warn about conflict-prone files ^t6
  - summary: A project lists files that conflict on merge (changelog, translation template, manifest); when two steps with helpers both touch one, get_status warns and suggests merging them one at a time.
  - estimate: 2h
  - updated from: rachitkdeaichat at 2026-10-28T03:27:32.657Z
  - reason: The Developer dropped the rest of this goal (2026-10-28).
  - updated: 2026-10-28T11:42:08.252Z by AI
- [-] Calibrate estimates from history ^t7
  - summary: Use estimated-vs-actual times of finished steps (by kind: small fix, helper step) to suggest better estimates and to show a realistic schedule.
  - estimate: 2h
  - updated from: rachitkdeaichat at 2026-10-28T03:27:32.657Z
  - reason: The Developer dropped the rest of this goal (2026-10-28).
  - updated: 2026-10-28T11:42:08.252Z by AI

## Notes

- [ ] Merged into main (1e1c0ba, NOT pushed, no version bump; 516 tests pass): helper info + evidence (src/helperWork.ts), hand tests (ADR 0004, first dashboard write endpoint, hub version 3→4), resource locks (src/resources.ts, temp-folder JSON, 30 min default, dashboard re-fetch every 15 s). Developer to review the UX choices: wrong-state helper/evidence params are refused; 'checked too long' = 24 h; hand-test box 'Things to try by hand' with ✓ Works / ✗ Doesn't work / Won't test + Undo; a failure adds 'Fix: …' and reopens a finished goal; only untried items block complete_goal (override unmarked_hand_tests_ok); locks are per Session+label, refused for others unless force. Not yet looked at in a real browser by a person. Remaining steps: t2 definition of done, t6 conflict-prone files, t7 estimate calibration. ^n1
  - updated from: rachitkdeaichat at 2026-10-28T03:38:12.424Z
