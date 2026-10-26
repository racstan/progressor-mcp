# Setup that works on every computer

## Tasks

- [x] Fix the Windows-only launcher in shared setup ^t1
  - summary: .mcp.json now gets the plain command on every system; on Windows, init also registers the cmd /c command in Claude Code local settings for this folder only.
  - code: `src/init.ts:24`
  - code: `.mcp.json`
  - code: `src/init.ts`
  - code: `src/initCommand.ts`
  - code: `test/init.test.ts`
  - code: `docs/apps.md`
  - code: `docs/troubleshooting.md`
  - code: `docs/updating-and-removing.md`
- [x] Fix this repo's .mcp.json ^t2
  - summary: Rewrite this repo's own .mcp.json with the new launcher so Progressor connects here on Linux.
  - code: `.mcp.json`
- [x] Warn when the launcher can't run here ^t3
  - summary: The session-start hook warns when .mcp.json starts Progressor with a command this computer does not have, and points at progressor-mcp init.
  - code: `src/init.ts`
  - code: `src/hooks.ts`
  - code: `test/hooks.test.ts`
  - code: `test/init.test.ts`
