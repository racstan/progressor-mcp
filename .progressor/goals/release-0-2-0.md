# Release 0.2.0

Goal: publish Settings and finished Goals, and Workspaces, together as 0.2.0.

## Tasks

- [ ] Changelog and version bump ^t1
  - summary: Add the 0.2.0 entry to CHANGELOG.md, then npm version minor.
  - code: `CHANGELOG.md`
  - code: `package.json`
- [ ] Dry run ^t2
  - summary: npm publish --dry-run: tests pass and only dist, README and LICENSE are included.
- [ ] Developer publishes with their one-time code ^t3
  - summary: The Developer runs npm publish --otp=<code>; Claude never publishes on its own.
- [ ] Verify the install from npm ^t4
  - summary: Install 0.2.0 from the registry in a throwaway folder and check the server, hooks and the dashboard command.
