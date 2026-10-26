# Smaller plan fixes

## Tasks

- [x] Move a step between goals ^t1
  - summary: move_task copies a step to another goal with a new ID and a moved from line; the old one stays cancelled, saying where it went.
  - code: `src/project.ts`
  - code: `src/planFile.ts`
  - code: `src/server.ts`
- [x] Update several steps in one call ^t2
  - summary: update_tasks applies up to 25 start/complete/state/drop operations in order, all or nothing, one write per goal.
  - code: `src/project.ts`
  - code: `src/server.ts`
- [ ] Clean up after dead sessions ^t3
  - summary: Notice when the owner of a claim or of the dashboard on port 4747 is dead; free the claim and take the port back instead of moving to 4748.
- [x] Rules block for helper-agent briefs ^t4
  - summary: get_rules returns the rules, hard ones first, as a block to paste into helper briefs.
  - code: `src/server.ts`
- [x] Mark hard rules ^t5
  - summary: Standing Instructions take hard: true (stored as hard: yes); listed first as HARD RULE, and with a Must label on the dashboard.
  - code: `src/roadmap.ts`
  - code: `src/server.ts`
  - code: `src/hooks.ts`
  - code: `src/ui/App.tsx`
- [x] Show how old reminders are ^t6
  - summary: The per-prompt reminder says how long ago the plan changed, and after 30 minutes that it may be out of date.
  - code: `src/hooks.ts`
  - code: `src/project.ts`
