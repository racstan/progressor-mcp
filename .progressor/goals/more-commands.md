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
- [x] plan and idea work with no text ^t6
  - summary: Some apps allow only plain text in a command's argument (Claude's app refuses links and formatting), so plan and idea take it optionally: left empty, the Agent asks in the chat, where anything can be written.
  - code: `src/prompts.ts`
  - code: `src/server.ts`
  - code: `test/server.test.ts`
  - code: `docs/reference.md`
  - code: `README.md`

## Detour: Commands that need no rich text ^d1

- branched from: ^t5
- reason: Trying the commands in Claude's app, sending text with a link or formatting after a command was refused ("nothing was sent"); plan and idea must work in apps that allow only plain text in a command's argument.
- status: merged back

## Detour: Top bar overflows narrow windows ^d2

- branched from: ^t5
- reason: At a half-screen browser width (about 910px) the dashboard's top bar runs past the window's right edge, hiding the view buttons, the Detours switch and the theme toggle; it blocks the demo recording.
- status: open
