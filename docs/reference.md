# Reference

## Slash commands

In Claude Code, Progressor adds three commands to the `/` menu:

| Command                          | What it does                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/mcp__progressor__status`       | A short summary of where things stand; with no Goal claimed, the Goals to pick from.             |
| `/mcp__progressor__plan <goal>`  | The Agent proposes a title, short ID, Outcome and Tasks for the Goal you describe, and waits for your OK before adding it. |
| `/mcp__progressor__review [goal]` | The Agent checks a Goal's finished Tasks against the code and its Outcome, and says what is missing. |

## Example

```markdown
# Ship OAuth login

## Tasks

- [x] Add the /login route ^t1
  - summary: Serve the login page and redirect to the provider with the client ID and state.
  - code: `src/routes/login.ts`
- [/] Fix callback redirect loop ^t2
  - summary: Callback re-sets the session cookie on every hit; only set it after token exchange.
  - code: `src/auth/callback.ts`
  - code: `src/auth/session.ts:42`
- [ ] Add logout ^t3

## Detour: Fix flaky token refresh ^d1

- branched from: ^t2
- reason: The callback tests fail randomly because token refresh races the cookie write
- status: open
```

## Tools

| Tool                       | What it does                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| `get_status`               | Summary of the claimed Goal, current Task, open Detour, next Task and Standing Instructions. |
| `get_item`                 | Looks up any item by ref, with its file and line.                            |
| `add_goal`                 | Adds a Goal to the Roadmap, with an optional Task list, Outcome and short ID; with `done`, records finished work. |
| `update_goal`              | Renames a Goal or changes its Outcome.                                       |
| `move_goal`                | Moves a Goal before or after another on the Roadmap.                         |
| `drop_goal`                | Drops a Goal that is no longer wanted, with a reason.                        |
| `claim_goal`               | Claims a Goal for this Session (pausing any other it held).                  |
| `release_goal`             | Releases the Claim; the Goal is paused.                                      |
| `complete_goal`            | Marks the claimed Goal done.                                                 |
| `add_tasks`                | Appends Tasks (title, files and summary) to the claimed Goal.                |
| `start_task`               | Marks a Task in progress (one at a time).                                    |
| `update_task`              | Changes a Task's title, summary or files.                                    |
| `complete_task`            | Marks a Task done, recording the files it touched and its final summary.     |
| `drop_task`                | Drops a Task with a reason.                                                  |
| `start_detour`             | Declares a Detour, with a Reason, branching from the current Task.           |
| `end_detour`               | Ends the open Detour: merge back, return or recalibrate.                     |
| `record_idea`              | Parks an Idea for later.                                                     |
| `promote_idea`             | Turns an Idea into a Task or a Goal.                                         |
| `add_standing_instruction` | Saves a lasting rule from the Developer.                                     |
