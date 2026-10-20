# Reference

The details behind Progressor, for the technically curious and for AI agents. You don't need any of this to use it.

The dashboard and the guides use everyday words; the AI's tools and the files use Progressor's own terms. They match like this:

| On the dashboard | In the tools and files |
| --- | --- |
| goal | Goal |
| step | Task |
| side trip | Detour |
| Finished when | Outcome |
| cancelled | dropped |
| Your goals | Roadmap |
| a rule your AI keeps | Standing Instruction |
| a chat working on a goal | a Session holding a Claim |

The [glossary](../GLOSSARY.md) defines each term.

## Slash commands

Progressor offers these as MCP prompts. Claude Code lists them in the `/` menu as `/progressor:status (MCP)` and so on (typing `/mcp__progressor__status` works too); other apps name them their own way. The text after a command is its argument, in plain words: some apps, Claude's among them, refuse links, `code` or other formatting there. For anything more, send the command on its own, and the AI asks in the chat.

| Command | What it does |
| --- | --- |
| `status` | A short summary of where things stand; with no Goal claimed, the Goals to pick from. |
| `next` | Picks up where the plan left off: finishes an open Detour, carries on with the Task in progress or starts the next one, claiming a Goal first if needed; completes the Goal when every Task is done. |
| `plan [goal]` | The AI proposes a title, short ID, Outcome and Tasks for the Goal described, and waits for an OK before adding it. |
| `review [goal ID]` | The AI checks a Goal's finished Tasks against the code and its Outcome, says what is missing, and completes the Goal if nothing is. Without an ID, the claimed Goal. |
| `dashboard` | The link to this project's dashboard, opened in the app's browser pane where there is one. |
| `setup` | The AI runs `progressor-mcp init --yes --no-server` in the conversation's folder, for when Progressor is registered for every project. |

## Tools

The AI calls these; the server's instructions tell it when.

| Tool | What it does |
| --- | --- |
| `get_status` | The claimed Goal, current Task, open Detour, next Task and Standing Instructions, then the project folder and the dashboard link. |
| `get_item` | Looks up any item by its `progressor://` ref, with its file and line. |
| `add_goal` | Adds a Goal with an optional Task list, Outcome and short ID; `claim: true` claims it at once; `done: true` records finished work. |
| `update_goal` | Renames a Goal or changes its Outcome. |
| `move_goal` | Moves a Goal before or after another. |
| `drop_goal` | Drops a Goal that is no longer wanted, with a reason. |
| `claim_goal` | Claims a Goal for this Session (pausing any other it held); a done Goal is reopened. |
| `release_goal` | Releases the Claim; the Goal is paused. |
| `complete_goal` | Marks the claimed Goal done, once every Task is done or dropped and no Detour is open. |
| `add_tasks` | Appends Tasks (title, files and summary) to the claimed Goal. |
| `start_task` | Marks a Task in progress (one at a time). |
| `update_task` | Changes a Task's title, summary or files. |
| `complete_task` | Marks a Task done, with the files it touched and its final summary. |
| `drop_task` | Drops a Task, with a reason. |
| `start_detour` | Declares a Detour, with a Reason, branching from the current Task. |
| `end_detour` | Ends the open Detour: merge back, return (optionally adding Tasks) or recalibrate (replacing the remaining Tasks). |
| `add_standing_instruction` | Saves a lasting rule from the Developer. |
| `update_standing_instruction` | Changes a rule's text, or removes it when the text is empty. |

## `progressor-mcp` commands

| Command | What it does |
| --- | --- |
| `progressor-mcp` | Runs the MCP server over stdio (what AI apps start). |
| `progressor-mcp init [folder] [--yes] [--no-server]` | Sets a project up: the server in `.mcp.json` (left out with `--no-server`), Claude Code's hooks in `.claude/settings.json`, the note in `CLAUDE.md` and `AGENTS.md`, and an empty Roadmap. Lists the changes and asks first; `--yes` skips the question. Running it again changes nothing unless something is missing. |
| `progressor-mcp init [folder] --remove [--yes]` | Takes all of that out again, leaving `.progressor/` alone. |
| `progressor-mcp dashboard [folder] [--no-open] [--forget <folder>]` | Opens the dashboard on every project in a folder, with no AI app running. See [the dashboard](dashboard.md#the-dashboard-without-an-ai-running). |
| `progressor-mcp hook <session-start\|prompt>` | Claude Code's hooks: prints the plan for the AI. |
| `progressor-mcp --version` | Prints the version. |

## Environment variables

Set these in the `env` of the `progressor` server in your app's MCP settings.

| Variable | What it does |
| --- | --- |
| `PROGRESSOR_ROOT` | The project folder. Without it: the folder the app reports as open (MCP roots), then `CLAUDE_PROJECT_DIR`, then the folder the server starts in. |
| `PROGRESSOR_PORT` | The dashboard's port (default 4747; the next free one if taken). |
| `PROGRESSOR_DASHBOARD` | `off` runs without the dashboard. |
| `PROGRESSOR_EDITOR` | The editor files open in from the dashboard; see [choosing the code editor](dashboard.md#choosing-the-code-editor). |
| `PROGRESSOR_REGISTRY` | Where the list of projects for the dashboard is kept (default `~/.progressor/projects.json`). |

## Claude Code's hooks

Two hooks put the plan in front of the AI without it having to ask:

- **At session start, on resume and after the conversation is summarised**, the full status: the Goal, the current Task, any open Detour, the next Task and the Standing Instructions.
- **On every message**, one line, such as `[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests`. It is left out when no Goal is being worked on.

`progressor-mcp init` adds them. By hand, with Progressor installed globally, add this to `.claude/settings.json` in the project (or `~/.claude/settings.json` for every project), merging into any `hooks` already there:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "progressor-mcp hook session-start" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "progressor-mcp hook prompt" }] }]
  }
}
```

The hook reads `.progressor/` straight from disk, so it needs no running server, and prints nothing in projects without Progressor. It never blocks a message: if anything goes wrong, it stays silent. `npx -y progressor-mcp hook ...` works too, but adds about 1.5 seconds to every message, so the global install is recommended.

## The files

Everything lives in `.progressor/` in the project:

- `roadmap.md`: the Goals in order, with their Outcomes and Claims, and the Standing Instructions.
- `goals/<id>.md`: one Plan File per Goal, with its Tasks and Detours.

They are plain markdown, written only by the server's tools. An example Plan File:

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

The full format is in [markdown-format.md](markdown-format.md).
