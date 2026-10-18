# Slash commands in chat

Goal: the Developer can steer Progressor from the chat with two or three slash commands, served as MCP prompts, instead of having to word requests to the Agent.

## Tasks

- [ ] Decide the commands and what each one does ^t1
  - summary: Developer decision. Recommendation: /progressor:status (where are we: Goal, current Task, open Detour, next Task), /progressor:plan <goal> (add or claim a Goal and lay out its Tasks), /progressor:review (walk through what was done and reopen the Goal with any missing work).
- [ ] Serve the commands as MCP prompts ^t2
  - summary: Test-first: register the prompts with the MCP server, each returning a message that tells the Agent which tools to call, with the live status filled in where it helps.
  - code: `src/server.ts`
  - code: `src/prompts.ts`
  - code: `test/server.test.ts`
- [ ] Try them in Claude Code ^t3
  - summary: Check that the commands show up in the / menu, take their arguments, and lead the Agent to the right tools.
- [ ] Document the commands in the README ^t4
  - code: `README.md`
