# Automatic drift detection

Goal: Detours get recorded even when the Agent doesn't notice it has drifted. When it edits a file that isn't part of the current Task, Progressor nudges it to declare a Detour or explain why the file belongs to the Task.

## Tasks

- [ ] Decide how pushy drift nudges are ^t1
  - summary: Developer decision. Options: (a) a gentle note, (b) ask the Agent to declare a Detour or say why the file belongs to the Task, (c) block the edit until it does. Recommendation: (b), never block.
- [ ] Decide which files count as on-plan ^t2
  - summary: Developer decision. Recommendation: the current Task's files and their folders, plus test files next to them; everything else is off-plan.
- [ ] File-matching rules as a pure function ^t3
  - summary: Test-first: given the current Task's files and an edited path, say whether the edit is on-plan. Handles path:line entries, folders, Windows and POSIX paths, and paths relative to the project root.
  - code: `src/drift.ts`
  - code: `test/drift.test.ts`
- [ ] PostToolUse hook for file edits ^t4
  - summary: Fires after Edit and Write, compares the edited file with the current Task's files and, when it's off-plan, adds the nudge through additionalContext.
  - code: `src/hooks.ts`
  - code: `src/drift.ts`
- [ ] Don't nag ^t5
  - summary: Nudge at most once per file per Task; stay silent while a Detour is open, when no Task is in progress, and for files the Agent has already added to the Task.
  - code: `src/drift.ts`
- [ ] Let the Agent resolve a nudge in one call ^t6
  - summary: The nudge names the two ways out: start_detour with a Reason, or update_task to add the file to the current Task. Update the server instructions to match.
  - code: `src/server.ts`
- [ ] Verify in a real Claude Code session ^t7
  - summary: Start a Task, have the Agent edit an unrelated file, and confirm it gets nudged once and records a Detour or updates the Task.
