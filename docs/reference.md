# Reference

## Slash commands

In Claude Code, Progressor adds its commands to the `/` menu, listed as `/progressor:status (MCP)` and so on: type `/progressor` to see them. Typing the full name, such as `/mcp__progressor__status`, works too. A command's argument is the text after it.

| Command                          | What it does                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/progressor:status`             | A short summary of where things stand; with no Goal claimed, the Goals to pick from.             |
| `/progressor:plan <goal>`        | The Agent proposes a title, short ID, Outcome and Tasks for the Goal you describe, and waits for your OK before adding it. |
| `/progressor:review [goal]`      | The Agent checks a Goal's finished Tasks against the code and its Outcome, and says what is missing. |
| `/progressor:next`               | Picks up where the plan left off: finishes an open Detour, carries on with the Task in progress or starts the next one, claiming a Goal first if needed. |
| `/progressor:idea <idea>`        | Parks an idea for later as an Idea, without working on it now. |
| `/progressor:dashboard`          | Gives the link to this project's dashboard, and opens it in the app's browser pane where there is one. |
| `/progressor:setup`              | Sets up the conversation's folder: the hooks, the note in `CLAUDE.md` and a Roadmap, after your OK. For when Progressor is [registered for every project](setup.md#use-progressor-in-every-project). |

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
