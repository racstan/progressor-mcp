# Smaller plan fixes

## Tasks

- [ ] Move a step between goals ^t1
  - summary: A single move-step tool instead of dropping and re-adding.
- [ ] Update several steps in one call ^t2
  - summary: Complete several steps and start the next in one call to cut token cost.
- [ ] Clean up after dead sessions ^t3
  - summary: Notice when the owner of a claim or of the dashboard on port 4747 is dead; free the claim and take the port back instead of moving to 4748.
- [ ] Rules block for helper-agent briefs ^t4
  - summary: A flag or call that returns the Standing Instructions as a ready-to-paste block for subagent briefs.
- [ ] Mark hard rules ^t5
  - summary: A hard-rule flag on Standing Instructions so reminders stress those over preferences.
- [ ] Show how old reminders are ^t6
  - summary: The status line added to each prompt can go stale, for example naming a step a helper already finished; show how long ago it was updated.
