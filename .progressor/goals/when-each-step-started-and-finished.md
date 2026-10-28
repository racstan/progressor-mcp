# When each step started and finished

## Tasks

- [x] Record when a step starts and finishes ^t1
  - summary: A step gets a started line the first time it is worked on and a finished line when it is done, released or cancelled (cleared if it goes back to work); the dashboard gets both.
  - code: `src/planFile.ts`
  - code: `src/dashboard/graph.ts`
  - code: `test/planFile.test.ts`
  - estimate: 45m
  - time spent: 2m
  - code: `test/project.test.ts`
  - code: `test/estimates.test.ts`
  - code: `test/server.test.ts`
  - code: `test/hooks.test.ts`
  - added: 2026-10-28T11:52:50.633Z by AI
  - updated: 2026-10-28T11:55:12.527Z by AI
- [x] Show the times on Steps ^t2
  - summary: The row's end says done today 14:02 or Working on it · started 13:50; the details say Started … · finished …, with exact times on hover; older done steps use when they last changed.
  - code: `src/ui/Steps.tsx`
  - code: `src/ui/words.ts`
  - code: `test/words.test.ts`
  - estimate: 45m
  - time spent: 1m
  - code: `src/ui/Popover.tsx`
  - added: 2026-10-28T11:52:50.633Z by AI
  - updated: 2026-10-28T11:56:42.372Z by AI
- [x] Docs and changelog ^t3
  - summary: Note the new started and finished lines in the plan format and the changelog.
  - code: `docs/markdown-format.md`
  - code: `CHANGELOG.md`
  - estimate: 10m
  - added: 2026-10-28T11:52:50.633Z by AI
  - updated: 2026-10-28T11:56:59.348Z by AI

## Hand tests

- [ ] After restarting the chat, ask your AI to do any small step. While it works, its row in Steps should say "Working on it · since" and a time; once it's done, "Done" and the time. Open the step: it should say "Started … · finished …", and hovering shows the exact date. ^h1
  - added: 2026-10-28T11:56:59.369Z by AI
