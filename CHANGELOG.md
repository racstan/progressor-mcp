# Changelog

All notable changes to progressor-mcp. Each release is a Goal on Progressor's own Roadmap (`.progressor/`); from 0.2.0 on, one release bundles several finished Goals.

## 0.3.0 · Setup, slash commands and shaping Goals

### One-command setup

- New `progressor-mcp init [folder]`. It registers the MCP server in `.mcp.json`, adds the status hooks to `.claude/settings.json`, adds a short note for the Agent to `CLAUDE.md` and creates an empty Roadmap.
  - It lists the changes and asks once; `--yes` skips the question.
  - Running it again changes nothing.
  - `--remove` takes it out again and leaves `.progressor/` alone.
- When run through npx, it says that npx adds about 1.5 seconds to every message and suggests a global install. The README's hooks section says the same.

### Slash commands

- Three MCP prompts, which Claude Code shows as `/mcp__progressor__status`, `/mcp__progressor__plan <goal>` and `/mcp__progressor__review [goal]`.

### Shaping Goals

- New tools:
  - `update_goal` renames a Goal or changes its Outcome.
  - `move_goal` reorders the Roadmap.
  - `drop_goal` drops a Goal with a reason.
- A Goal can have an **Outcome**, one line on what done looks like. It is shown in the status, the session-start hook, Copy as prompt and the dashboard banner.
- `add_goal` takes an optional short `id`.
- `add_goal` refuses a second Goal with the same title unless `allow_duplicate` is set.
- Finished work can be recorded in one call: `add_goal` with `done: true` and Tasks marked `done`.
- Clearer tool descriptions.

### Dashboard

- `progressor-mcp dashboard <folder>` now says when it remembers a new folder as a Workspace, and how to forget it.

## 0.2.1

- Dashboard: the Goal on screen stays on screen when it finishes, instead of jumping to the next planned Goal.
- The source is public at [github.com/racstan/progressor-mcp](https://github.com/racstan/progressor-mcp); the npm page links to it, and the README opens with a demo.
- Listed in the official MCP Registry as `io.github.racstan/progressor-mcp` (`mcpName` in package.json, `server.json` in the repository).

## 0.2.0 · Workspaces, Settings and finished Goals

Also includes the status hooks below: 0.1.2 was never published on its own.

### Workspaces

- New `progressor-mcp dashboard [folder]` command: opens the dashboard on a folder from anywhere, with no Agent running. It shows every project inside it, meaning every folder with a `.progressor/roadmap.md`, at any depth. Dependency, build and hidden folders are skipped.
- The folder is remembered as a Workspace in `~/.progressor/workspaces.json`, so its projects keep showing. `--forget` stops showing it; `--no-open` only prints the address.
- The project switcher groups projects by Workspace. When there is more than one project, the start page is an overview of every project's Goals in progress and how far along they are.

### Settings and finished Goals

- A **⚙️ Settings** panel holds:
  - the view a Goal opens in (Across, Down or List)
  - the theme (light, dark or match the system)
  - the editor for "Open in file", moved out of the navbar
  - how finished Goals behave
  - whether hidden Goals are shown

  Settings are saved per browser.
- A finished Goal turns green with a green dot until you open it, then moves to a collapsed **Done** group. A setting moves finished Goals to Done straight away instead.
- Right-click a Goal in the sidebar to hide it from the list, or to move a finished Goal to Done. This changes only what your browser shows.
- `claim_goal` on a done Goal reopens it, so work found after a review joins the same Task list; its finished Tasks stay done. Copy as prompt on a done Goal tells the Agent how.

### Fixes

- The dashboard loads faster. It now also listens on IPv6 loopback (`::1`), because browsers try `localhost` there first and waited up to two seconds for that attempt to fail.
- The dashboard's internal version is now 2, so a running 0.1.x dashboard is not shared. A 0.2.0 server uses the next free port until the old one exits.

## 0.1.2 · Status hooks for Claude Code (not published; shipped in 0.2.0)

- New `progressor-mcp hook <event>` command for Claude Code hooks, so the Agent no longer has to remember to check the plan:
  - `hook session-start` gives the Agent the full status at startup, on resume and after context compaction: the Goal, the current Task and its summary, any open Detour, the next Task and the Standing Instructions.
  - `hook prompt` adds a one-line reminder to every message, and stays silent when no Goal is being worked on.
  - It reads `.progressor/` straight from disk, needs no running server, and never blocks or fails a message. The README shows how to set it up.
- Dashboard: the navbar shows "Progressor" once and no longer shows Session chips. A new **Help** menu holds the Standing Instructions, the parked Ideas and a Buy Me a Coffee link.

## 0.1.1 · Dashboard fixes

- Text in backticks inside Task summaries and Detour Reasons is shown as code, instead of showing the backticks.
- The sidebar heading reads "Roadmap · N Goals", and the Goals sit on one rail, so it's clear they belong to a single Roadmap.

## 0.1.0

First release.

- MCP server for any MCP app, with tools for Goals, Tasks, Detours (Merge back, Return, Recalibration), Ideas and Standing Instructions.
- Progress stored as markdown inside the project: `.progressor/roadmap.md` and one Plan File per Goal.
- One live, view-only dashboard at `localhost:4747` for every project on the machine, with Metro (across and down) and checklist views, Open in file and Copy as prompt.
