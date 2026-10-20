# More slash commands

## Tasks

- [x] Fix the command names in the docs ^t1
  - summary: Claude Code lists MCP prompts as /progressor:status (MCP), not /mcp__progressor__status; the docs say both, menu form first.
  - code: `README.md`
  - code: `docs/reference.md`
  - code: `src/server.ts`
- [x] next, idea and dashboard commands ^t2
  - summary: Test-first: next picks up the Goal in progress and starts its next Task; idea parks an Idea with record_idea; dashboard hands over this project's dashboard link.
  - code: `src/prompts.ts`
  - code: `src/server.ts`
  - code: `test/server.test.ts`
- [x] setup command and init --no-server ^t3
  - summary: Test-first: init --no-server skips .mcp.json; the setup command lists what init would add to this folder (hooks, CLAUDE.md note, Roadmap) and has the Agent run it after an OK.
  - code: `src/init.ts`
  - code: `src/initCommand.ts`
  - code: `src/prompts.ts`
  - code: `src/server.ts`
  - code: `test/init.test.ts`
  - code: `test/server.test.ts`
- [x] Use Progressor in every project ^t4
  - summary: The server takes its folder from CLAUDE_PROJECT_DIR when set, like the hooks; the docs show registering it once for the user, so it runs in any folder and /progressor:setup works there.
  - code: `src/serve.ts`
  - code: `docs/setup.md`
  - code: `README.md`
- [/] Try the commands in a real session ^t5
  - summary: Check each command appears in the / menu, takes its argument and leads the Agent to the right tools.
