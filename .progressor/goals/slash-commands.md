# Slash commands in chat

Goal: the Developer can steer Progressor from the chat with two or three slash commands, served as MCP prompts, instead of having to word requests to the Agent.

## Tasks

- [x] Decide the commands and what each one does ^t1
  - summary: Decided: status (a summary, or the Goals to pick from), plan <goal> (propose title, short ID, Outcome and Tasks, wait for an OK, then add and claim), review [goal] (check finished Tasks against the code and the Outcome, reopen with missing work). Claude Code shows them as /mcp__progressor__status, /mcp__progressor__plan and /mcp__progressor__review.
- [x] Serve the commands as MCP prompts ^t2
  - summary: Test-first: register the prompts with the MCP server, each returning a message that tells the Agent which tools to call, with the live status filled in where it helps.
  - code: `src/server.ts`
  - code: `src/prompts.ts`
  - code: `test/server.test.ts`
- [-] Try them in Claude Code ^t3
  - summary: Check that the commands show up in the / menu, take their arguments, and lead the Agent to the right tools.
  - reason: One try covers both command goals: moved into more-commands t5.
  - updated: 2026-10-28T11:35:36.342Z by AI
- [x] Document the commands in the README ^t4
  - code: `README.md`
