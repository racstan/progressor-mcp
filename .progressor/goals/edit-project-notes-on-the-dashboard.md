# Edit project notes on the dashboard

## Tasks

- [x] Save note changes from the dashboard ^t1
  - summary: Guarded dashboard POSTs to add, reword or remove a rule and to replace the About this project text, written under the plan lock through the same code the AI's tools use; each change also leaves a short message to the whole project so the AI hears of it.
  - code: `src/dashboard/http.ts`
  - code: `test/notes.test.ts`
  - estimate: 1h
  - time spent: 1m
  - code: `test/dashboard.test.ts`
  - added: 2026-10-28T11:42:23.435Z by AI
  - updated: 2026-10-28T11:44:23.955Z by AI
- [x] Edit buttons on Project notes ^t2
  - summary: Add a rule (with a Must never be broken box), Edit and Remove on each rule (remove asks first), and Edit on About this project with Save and Cancel.
  - code: `src/ui/ContextPage.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/App.tsx`
  - code: `src/ui/styles.css`
  - estimate: 1h 30m
  - time spent: 2m
  - code: `src/ui/Talk.tsx`
  - added: 2026-10-28T11:42:23.435Z by AI
  - updated: 2026-10-28T11:46:38.835Z by AI
- [x] Docs and changelog ^t3
  - summary: Say the notes can be edited on the dashboard.
  - code: `CHANGELOG.md`
  - code: `docs/reference.md`
  - estimate: 15m
  - code: `docs/dashboard.md`
  - added: 2026-10-28T11:42:23.435Z by AI
  - updated: 2026-10-28T11:47:08.275Z by AI

## Hand tests

- [x] After restarting the chat, open Project notes on the dashboard. Add a rule (try ticking Must never be broken), edit it, then remove it, and press Edit on About this project and save a small change. Each should save straight away, and Message your AI should show a note to your AI for each change. Then check that your AI replies to them at its next step. ^h1
  - marked: 2026-10-28T11:51:42.825Z
  - seen: yes
  - added: 2026-10-28T11:47:08.292Z by AI
  - updated: 2026-10-28T11:51:42.825Z by Developer
