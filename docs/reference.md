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
| with a helper | with a helper (a Task state) |
| waiting on you | waiting on you (a Task state) |
| checked | checked (a Task state) |
| released | released (a Task state) |
| decision | Decision |
| note | Note |
| Your goals | Roadmap |
| a rule your AI keeps | Standing Instruction |
| a rule marked Must | a hard Standing Instruction |
| estimated, took | `estimate`, `time spent` (Task and Goal details) |
| at most 2 helpers at once | the helper limit (`helpers at once` on a Standing Instruction) |
| a chat working on a goal | a Session holding a Claim |
| Updated from *project* | a change from elsewhere (an `updated from` line) |

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
| `get_status` | Every Goal this Session holds, each with its current Task, open Detour, Tasks with a helper, waiting on the Developer or checked, next Task, decisions and open notes; the helper limit and the schedule, one short line each, when set; then the Standing Instructions, the project folder and the dashboard link. |
| `get_item` | Looks up any item by its `progressor://` ref, with its file and line; a Task with its time against its estimate, a Goal with its estimate and expected finish. |
| `get_rules` | The Standing Instructions as a block to paste into a helper agent's brief: hard rules first, then the others, the helper limit if one is set, and a line telling the helper not to edit `.progressor/`. |
| `add_goal` | Adds a Goal with an optional Task list, Outcome, `estimate` and short ID; `claim: true` claims it at once; `done: true` records finished work. |
| `update_goal` | Renames a Goal or changes its Outcome or `estimate` (empty removes it). |
| `move_goal` | Moves a Goal before or after another. |
| `drop_goal` | Drops a Goal that is no longer wanted, with a reason. |
| `claim_goal` | Claims a Goal for this Session, which keeps any others it holds; a done Goal is reopened. |
| `release_goal` | Releases the Claim; the Goal is paused. |
| `complete_goal` | Marks the claimed Goal done, once every Task is done, released or dropped, no Detour is open and the Developer has marked every hand test. `unmarked_hand_tests_ok: true` finishes it anyway, only when the Developer says so. |
| `add_tasks` | Appends Tasks (title, files, summary and `estimate`) to the claimed Goal. |
| `start_task` | Marks a Task in progress (one per Goal at a time). |
| `set_task_state` | Sets a Task's state: with a helper, waiting on you, checked, released (or pending, in progress, done). Setting one Task too many with a helper still works, with a warning naming the helper limit. |
| `update_task` | Changes a Task's title, summary, files or `estimate` (empty removes it). |
| `complete_task` | Marks a Task done, with the files it touched and its final summary. |
| `update_tasks` | Changes several Tasks in one call: a list of `operations`, each `{task, action, goal?}` with `action` `start`, `complete` (with optional `code` and `summary`), `state` (with `state`), `drop` (with `reason`) or `estimate` (with `estimate`); `estimate` can also go with any other action. Applied in order, all or nothing, with one write per Goal, and answers with one line, plus the time taken by completed Tasks and the helper limit's warning when it applies. |
| `move_task` | Moves a Task to another Goal (`to_goal`, optionally `before` or `after` one of its Tasks). It keeps its title, summary, files and state and gets a new ID there, with a `moved from` line; the old Task stays, dropped with the reason `Moved to the goal "<title>" (<ref>)`. |
| `drop_task` | Drops a Task, with a reason. |
| `start_detour` | Declares a Detour, with a Reason, branching from the current Task. |
| `end_detour` | Ends the open Detour: merge back, return (optionally adding Tasks) or recalibrate (replacing the remaining Tasks). |
| `add_decision` | Records a decision made for the claimed Goal. |
| `update_decision` | Rewords a decision, or removes it when the text is empty. |
| `add_note` | Adds a note to any Goal that is not dropped, claimed or not. |
| `update_note` | Resolves, reopens or rewords a note, or removes it when the text is empty. |
| `add_hand_test` | Adds something only the Developer can try by hand to the claimed Goal (`text`, optionally the `task` it is about). The Developer marks it on the dashboard. Takes no `project`. |
| `update_hand_test` | Rewords a hand test, changes or removes its `task` link (empty string), or removes the test when the text is empty. The Developer's mark stays. |
| `add_standing_instruction` | Saves a lasting rule from the Developer; `hard: true` marks one that must never be broken; `helpers_at_once: 2` makes it the rule that holds the helper limit. |
| `update_standing_instruction` | Changes a rule's text, its `hard` flag and/or the helper limit it holds (`helpers_at_once`, 0 removes it), or removes the rule when the text is empty. |
| `update_context` | Replaces the project's Important context (at most 4000 characters), or clears it with an empty text. |

### Changing another project's plan

`get_status`, `add_goal`, `update_goal`, `move_goal`, `complete_goal`, `add_tasks`, `set_task_state`, `update_task`, `complete_task`, `update_tasks`, `add_decision`, `add_note` and `update_note` take an optional `project`: another project's plan to act on instead of this one's. Give its name or ID as the dashboard's project list shows them (the names of the projects in the registry and in the dashboard's Workspaces, without case), or the full path of its folder. A path is followed to its real folder, which must already have a `.progressor/` folder: a plan is never started in a folder from another project. An unknown project, a name two projects share, or a folder without a plan is refused with a message saying so. Naming this project itself is the same as leaving `project` out.

In another project's plan:

- `get_status` shows its Goals, with the Tasks of each Goal that can be changed from here, and its Standing Instructions.
- Nothing is claimed there, so the tools that change a Goal need `goal`. `add_goal` refuses `claim: true`; with `done: true` it records finished work.
- A Goal held by a Session that may still be running in that project can't be changed from here: every tool but `add_note` is refused with *Goal … is being worked on by an AI chat in that project (Session …, still running), so it cannot be changed from here.* A finished Goal takes only notes and `update_goal`; a dropped one, nothing. A Goal whose Session has ended can be changed; its old Claim is left for that project to clear.
- Each Goal, Task, decision or note added or changed gets an `updated from: <this project's name> at <ISO time>` line (see [the file format](markdown-format.md#changes-from-another-project)). A Goal not started yet whose Tasks move on is set to started, so it reads as paused.
- The answer ends with *That was in project …; it is marked there as updated from …* instead of where this project's work stands.

The project's own Session hears about those changes once: `get_status`, and Claude Code's hooks, add *Changed from elsewhere since you last looked (by an AI chat working in another project): …* listing the items (at most 8, then how many more). When it last looked is kept per project in `~/.progressor/seen.json`, beside the project registry.

While a tool reads and rewrites a plan, it holds that plan, so a Session in the project and a change from another project take turns instead of one overwriting the other. The hold is a small file in the system's temp folder; one left by a process that ended is taken over. If another Progressor holds the plan for more than 5 seconds, the tool answers *The plan in … is busy: another Progressor is changing it. Try again in a moment.*

Every tool that changes a claimed Goal (`add_tasks`, `start_task`, `set_task_state`, `update_task`, `complete_task`, `drop_task`, `update_tasks`, `move_task` (the Goal the Task is in), `start_detour`, `end_detour`, `add_decision`, `update_decision`, `add_hand_test`, `update_hand_test`, `complete_goal`, `release_goal`) takes an optional `goal`: the Goal's ID. It is needed only while the Session holds several Goals.

### Hand tests

Anything only the Developer can try goes in the Goal's hand-test list, not in the Agent's chat summary. The Developer marks each item on the dashboard (see [the dashboard](dashboard.md#things-to-try-by-hand)) as works, doesn't work (with a short note) or won't test, and can undo a mark. `get_status` shows, for each Goal it lists: a count line, the items still not tried (with the Task each is about), and **New marks from the Developer since the last status**: each mark not yet shown, a failure with the Developer's note and the step that was added for it. Showing a mark records it as seen (a `seen: yes` line), so a mark appears as new once. `get_item` takes a hand test's ref (`progressor://<goal>/h2`), and Claude Code's hooks list the same in the status they add.

A failed result adds a pending Task to the Goal (`Fix: <the test>`, its summary holding the note, linked both ways) and reopens a finished Goal as paused, so the next Session sees it. `complete_goal` is refused while any hand test is not tried yet, naming them; pass `unmarked_hand_tests_ok: true` to finish anyway, only when the Developer says to.

### The dashboard's write endpoint

The dashboard shows the plan and changes nothing but two things: asking a server to stop (`POST /api/servers/<pid>/stop`) and marking a hand test:

```
POST /api/projects/<project>/goals/<goal>/hand-tests/<id>
x-progressor: mark
content-type: application/json

{"mark": "doesn't work", "note": "it asked twice, then froze"}
```

`mark` is `works`, `doesn't work`, `won't test` or `clear` (undo); `note` (at most 500 characters, kept only with `doesn't work`) is optional. The answer is the updated hand test as JSON. The request is refused (403) unless it carries the `x-progressor: mark` header and an `Origin` of the dashboard's own page on localhost, so another web page cannot send it; like every dashboard request it is refused unless addressed to `localhost`, `127.0.0.1` or `[::1]`, and the server listens on the loopback interface only. Other answers: 415 for a body that is not JSON, 413 over 4 KB, 400 for a mark it does not know, 404 for an unknown project, Goal or hand test (a dropped Goal is 400). It writes through the same code as the tools, holding the plan's lock, and needs no Claim. The dashboard's hub version is now 4 (it was 3), so a Progressor with this change takes the port over from an older one that cannot take marks.

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

- **At session start, on resume and after the conversation is summarised**, the full status: the Goal, the current Task, any open Detour, the Tasks with a helper or waiting on the Developer, the next Task, the Goal's decisions and open notes, and the Standing Instructions (hard rules first, marked `HARD RULE`).
- **After an AI chat in another project changed this plan**, at the next session start or message, one more line: *Changed from elsewhere since you last looked (by an AI chat working in another project): …*, said once.
- **On every message**, one line, such as `[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests · updated 12 min ago`. It ends with how long ago the Goal's plan last changed (the Plan File's time), such as `· updated 12 min ago`; after 30 minutes it adds `, may be out of date; call get_status`, since the line can still name a step a helper finished long ago. With several Goals in progress, only a Goal whose plan is that old is flagged. It is left out when no Goal is being worked on.

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

- `roadmap.md`: the Goals in order, with their Outcomes and Claims, and the Standing Instructions (a hard rule has a `hard: yes` line).
- `goals/<id>.md`: one Plan File per Goal, with its Tasks, decisions, notes, hand tests and Detours.

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

## Estimates, the helper limit and the schedule

- **Estimates** are written like `45m`, `2h` or `1h 30m` (also `90 min`, `1.5h`, `2 hours`; days are not taken). A Task's goes in an `estimate` line; a Goal's, in roadmap.md, covers its open Tasks that have none, else a Goal's estimate is the sum of its open Tasks'.
- **Time spent** is clocked by the tools: a `timing since` line is added when a Task becomes in progress, with a helper, waiting on you or checked, and when it becomes done, released, dropped or pending again the stretch is added to its `time spent` line. Pausing (back to pending) does not count.
- **The helper limit** is a `helpers at once: 2` line on one Standing Instruction. It lives on a rule because it is one: it reads as a rule in every place rules are shown (get_status, get_rules, the dashboard), so helpers are told about it in their brief, and it needs no new tool. Handing out one Task too many is not refused, since the AI may have a reason; the answer carries a warning.
- **The schedule** is a greedy list schedule. The open Tasks of the open Goals are taken in Roadmap order, then Task order. Tasks in progress or with a helper run now, with what is left of their estimate; at most as many Tasks run at once as the helper limit allows (without one, as many as run now, at least one), and each next Task starts as soon as one finishes. Tasks waiting on you or checked add no time. A Task without an estimate counts as no time and is counted as *not estimated*, so a finish leaves those out instead of guessing.
