# Goal shaping from Developer feedback

## Tasks

- [x] update_goal, move_goal and drop_goal tools ^t1
  - summary: Rename a Goal or change its Outcome, reorder the Roadmap, and drop a Goal with a reason; a Goal held by another live Session cannot be dropped.
  - code: `src/roadmap.ts`
  - code: `src/project.ts`
  - code: `src/server.ts`
- [x] Optional Outcome on Goals ^t2
  - summary: One line saying what done looks like, stored as an outcome detail and shown in the status, the hook, Copy as prompt and the dashboard banner.
  - code: `src/roadmap.ts`
  - code: `src/ui/App.tsx`
- [x] Optional short Goal ID on add_goal ^t3
  - summary: Up to 48 lowercase letters, digits and dashes; refused when reserved or already used.
  - code: `src/roadmap.ts`
- [x] Refuse duplicate Goal titles unless allow_duplicate ^t4
  - summary: Case- and space-insensitive match against Goals that are not dropped.
  - code: `src/project.ts`
- [x] Record finished work in one add_goal call ^t5
  - summary: done: true on the Goal and its Tasks; refused before writing anything if a Task is not done.
  - code: `src/project.ts`
  - code: `src/planFile.ts`
- [x] Document npx hook delay ^t6
  - summary: README hooks section says npx adds about 1.5 s per message; init prints the same advice when run through npx.
  - code: `README.md`
  - code: `src/initCommand.ts`
- [x] Workspace notice on dashboard <folder> ^t7
  - summary: Prints that a new folder was remembered as a Workspace and how to forget it.
  - code: `src/dashboardCommand.ts`
