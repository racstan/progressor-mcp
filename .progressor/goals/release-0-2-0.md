# Release 0.2.0

Goal: publish Settings and finished Goals, and Workspaces, together as 0.2.0, with the status hooks from 0.1.2, which was never published.

## Tasks

- [x] Changelog and version bump ^t1
  - summary: Add the 0.2.0 entry to CHANGELOG.md, then npm version minor.
  - code: `CHANGELOG.md`
  - code: `package.json`
- [x] Dry run ^t2
  - summary: npm publish --dry-run: tests pass and only dist, README and LICENSE are included.
- [/] Developer publishes with their one-time code ^t3
  - summary: The Developer runs npm publish --otp=<code>; Claude never publishes on its own.
- [ ] Verify the install from npm ^t4
  - summary: Install 0.2.0 from the registry in a throwaway folder and check the server, hooks and the dashboard command.
- [ ] Verify the hooks in a real Claude Code session ^t5
  - summary: Register 0.2.0 with the hooks, run a session, force a compaction with /compact, and confirm the Agent still knows its Task without calling get_status. Moved here from 0.1.2.
