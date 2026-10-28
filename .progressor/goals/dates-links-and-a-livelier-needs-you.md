# Dates, links and a livelier Needs you

## Tasks

- [x] Record when and by whom ^t1
  - state: released
  - summary: Plan files get 'added: <time> by AI|Developer' and 'updated: <time>' lines on goals, steps, decisions, notes and hand tests, stamped automatically on every save by comparing with what was on disk; older items without them keep working.
  - code: `src/planFile.ts`
  - code: `src/roadmap.ts`
  - code: `src/project.ts`
  - code: `test/dates.test.ts`
  - code: `docs/markdown-format.md`
  - helper: Sonnet
  - helper branch: feat/dates
  - evidence: 636 tests pass; dates written on a plan copy by AI and dashboard
  - estimate: 3h
  - time spent: 9m
- [x] Show the dates on the dashboard ^t2
  - state: released
  - summary: Added 2 h ago by your AI · updated 10 min ago, with the exact date on hover, on the goal header, each step's details, decisions, notes, things to try and messages.
  - code: `src/dashboard/http.ts`
  - code: `src/ui/GoalPage.tsx`
  - code: `src/ui/Steps.tsx`
  - code: `src/ui/GoalNotes.tsx`
  - code: `src/ui/HandTests.tsx`
  - code: `src/ui/words.ts`
  - helper: Sonnet
  - helper branch: feat/dates
  - evidence: Dates shown in Chrome: header, step, decision, hand test
  - estimate: 1h 30m
  - time spent: 9m
- [x] Short Copy for your AI ^t3
  - summary: The copied text is a short pointer: what it is, its Progressor reference and the plan file with line, asking the AI to look it up with get_item, instead of a long description.
  - code: `src/dashboard/prompt.ts`
  - code: `test/prompt.test.ts`
  - code: `src/ui/Popover.tsx`
  - estimate: 45m
  - time spent: 3m
  - code: `src/ui/Steps.tsx`
- [x] Show in folder ^t4
  - summary: A guarded dashboard POST that opens the system file manager at a plan file inside the project (Linux xdg-open of its folder, macOS open -R, Windows explorer /select), with buttons on the goal header and a step's details.
  - code: `src/dashboard/http.ts`
  - code: `src/dashboard/reveal.ts`
  - code: `test/reveal.test.ts`
  - code: `src/ui/data.ts`
  - code: `src/ui/GoalPage.tsx`
  - code: `src/ui/Steps.tsx`
  - estimate: 1h 30m
  - code: `test/dashboard.test.ts`
  - code: `src/ui/Icon.tsx`
  - code: `src/ui/Popover.tsx`
  - code: `src/ui/App.tsx`
- [x] Animate what waits on you ^t5
  - summary: The Needs you box, a step waiting on you and Needs you rows in the sidebar and on Home get a gentle attention animation and entry transitions, in every theme, off with reduced motion.
  - code: `src/ui/styles.css`
  - estimate: 45m
  - time spent: 1m
  - code: `CHANGELOG.md`

## Hand tests

- [ ] After restarting your AI chat, open a goal on the dashboard and press "Show in folder". Your file manager should open where that goal's plan is saved. ^h1
  - task: ^t4
