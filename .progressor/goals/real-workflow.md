# Plans that match how the Agent really works

## Tasks

- [x] Several goals in progress at once ^t1
  - summary: A Session can hold several Goals; tools take an optional goal; get_status, hooks and the dashboard show all of them.
  - code: `src/project.ts`
  - code: `src/server.ts`
  - code: `src/hooks.ts`
  - code: `src/ui/Servers.tsx`
- [x] More step states ^t2
  - summary: set_task_state adds with a helper, waiting on you, checked and released, stored as a state: line; each has its own mark on the map and list.
  - code: `src/planFile.ts`
  - code: `src/server.ts`
  - code: `src/ui/StepKey.tsx`
  - code: `src/ui/MetroMap.tsx`
  - code: `src/ui/Checklist.tsx`
- [x] 'Waiting on you' state ^t3
  - summary: A Goal with a step waiting on you shows amber as Waiting on you in the sidebar, banner and overview, and sorts first.
  - code: `src/dashboard/http.ts`
  - code: `src/ui/App.tsx`
  - code: `src/ui/Overview.tsx`
- [x] Decisions log for each goal ^t4
  - summary: add_decision / update_decision keep decisions (c1...) in the plan file; shown under the goal and in get_status.
  - code: `src/planFile.ts`
  - code: `src/server.ts`
  - code: `src/ui/GoalNotes.tsx`
- [x] Notes for each goal and side trip ^t5
  - summary: add_note / update_note file notes (n1...) on any goal, with where they were found; resolved ones fold away.
  - code: `src/planFile.ts`
  - code: `src/server.ts`
  - code: `src/ui/GoalNotes.tsx`
- [x] Decided with the Developer ^t6
  - summary: Several goals per chat; step states: with a helper, waiting on you, checked, released (plus to do, in progress, done, cancelled); decisions and notes listed under each goal, notes can be filed on another goal.
