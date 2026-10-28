# Lighter for the AI

## Tasks

- [x] Short answers for step updates ^t1
  - state: released
  - summary: start_task and complete_task answer with the short 'Now:' line (plus news) instead of the whole status; claim_goal, add_goal and get_status keep the full one.
  - code: `src/server.ts`
  - code: `test/server.test.ts`
  - helper: Sonnet
  - helper branch: feat/lighter-ai
  - evidence: Reviewed diff; 573 passed on main, typecheck OK
  - estimate: 1h
  - time spent: 7m
- [x] Status lists only open goals ^t2
  - state: released
  - summary: With nothing claimed, list active, paused and planned goals and say how many are finished, instead of every finished goal.
  - code: `src/server.ts`
  - code: `test/server.test.ts`
  - helper: Sonnet
  - helper branch: feat/lighter-ai
  - evidence: Reviewed; 573 passed
  - estimate: 45m
  - time spent: 7m
- [x] Shorter instructions ^t3
  - state: released
  - summary: Cut INSTRUCTIONS from 6.6k to about 3.5k characters: keep the essential rules, move details into the tool descriptions where they already are.
  - code: `src/server.ts`
  - helper: Sonnet
  - helper branch: feat/lighter-ai
  - evidence: Instructions 6594 -> 3318 chars
  - estimate: 45m
  - time spent: 7m
