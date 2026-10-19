# One-command setup

Goal: one command initializes a Project: the MCP server, the hooks, a note for the Agent and an empty Roadmap.

## Tasks

- [x] Decide what init changes and whether it asks first ^t1
  - summary: Decided: init shows the list of changes (register the server, add hooks to .claude/settings.json, add a note to CLAUDE.md, create .progressor/roadmap.md) and asks once; --yes skips the question.
- [x] progressor-mcp init command ^t2
  - summary: Initializes the current folder as a Project and prints what it did and how to open the dashboard.
  - code: `src/cli.ts`
  - code: `src/init.ts`
- [x] Merge hooks into existing settings safely ^t3
  - summary: Add Progressor's hooks to .claude/settings.json without touching other hooks or settings; running init twice changes nothing.
  - code: `src/init.ts`
- [x] CLAUDE.md note between markers ^t4
  - summary: A short note telling the Agent to use Progressor, written between marker comments so a re-run updates it instead of adding a second copy.
  - code: `src/init.ts`
- [x] Undo with init --remove ^t5
  - summary: Removes the hooks, the CLAUDE.md note and the server registration, and leaves .progressor/ alone.
  - code: `src/init.ts`
- [x] Tests on temporary projects ^t6
  - summary: Fresh project, project with existing settings and hooks, project with an existing CLAUDE.md, re-run, and remove.
  - code: `test/init.test.ts`
- [x] Rewrite the README setup section around init ^t7
  - summary: One command to start, with the manual steps kept below for other MCP apps.
  - code: `README.md`
