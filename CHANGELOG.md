# Changelog

All notable changes to progressor-mcp. Each release is a Goal on Progressor's own Roadmap (`.progressor/`); from 0.2.0 on, one release bundles several finished Goals.

## 0.5.2 · The top bar fits narrow windows

- In a browser window about half a screen wide, the dashboard's top bar ran past the right edge, hiding the view buttons, the Detours switch and the theme toggle. The search box now shrinks to make room, and below 820px the logo drops its name, so the whole bar fits down to about 700px.

## 0.5.1 · Commands that work with no text

- **/progressor:plan** and **/progressor:idea** no longer need text after them. Sent on their own, the Agent asks you in the chat what to plan or park, and your answer can hold anything: links, code, pasted text.
  - Some apps allow only plain words after a command. Claude's app refuses links and formatting there with "A command takes file @-mentions but no other @-mentions, slash commands, links, or inline formatting", so nothing was sent.
  - Plain words after the command still work as before.
- Troubleshooting in the README covers that error.

## 0.5.0 · More slash commands

### New commands

- **/progressor:next** picks up where the plan left off: it finishes an open Detour first, carries on with the Task in progress or starts the next one, and claims the paused Goal if no Goal is claimed (or asks which, when there are several).
- **/progressor:idea** parks an idea for later as an Idea, without working on it now.
- **/progressor:dashboard** gives the link to this project's dashboard, and opens it in the app's browser pane where there is one.
- **/progressor:setup** sets up the conversation's folder from the chat: the hooks, the note in `CLAUDE.md` and a Roadmap, after your OK.

### Progressor in every project

- Register Progressor once for your user (`claude mcp add --scope user progressor -- npx -y progressor-mcp`) and it runs in every conversation, whatever its folder; **/progressor:setup** then sets a folder up without a restart. See [docs/setup.md](docs/setup.md#use-progressor-in-every-project).
- `progressor-mcp init --no-server` sets a project up without adding it to `.mcp.json`, for an app that already runs Progressor in every folder.
- The server takes its project folder from `CLAUDE_PROJECT_DIR` when Claude Code sets it, as the hooks already did.

### Docs

- The commands are named as the `/` menu shows them, `/progressor:status (MCP)`, instead of `/mcp__progressor__status`, which only works when typed in full.

## 0.4.1 · Help and a shorter README

### Report a problem from the dashboard

- The ❓ Help menu opens with **Facing a problem?**: **Report a problem** and **Suggest an idea or share feedback** open a GitHub issue form with your Progressor version (and, for a problem, your system and browser) already filled in, next to a link to the open issues.
- The Help menu is there on every page, including before a project has any Goals.
- **Buy me a coffee** moves to the bottom of ⚙️ Settings.
- `progressor-mcp --version` (or `-v`) prints the version, for bug reports.
- New issue forms on GitHub for problems and ideas.

### A shorter README

- The README keeps what a new user needs: a **For AI agents** setup prompt to paste into your Agent's chat, a short install, how it works, the dashboard in brief, **Troubleshooting** for the common setup problems, and **Feedback and help**.
- The details move, unchanged, to [docs/setup.md](docs/setup.md), [docs/dashboard.md](docs/dashboard.md), [docs/reference.md](docs/reference.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## 0.4.0 · Search and long plans

### Search

- A search box in the top bar finds projects, Goals, Tasks and Ideas across every project as you type.
  - It matches titles, Outcomes, Task summaries, Idea notes and folders.
  - Press `/` or Ctrl+K to focus it.
  - Arrow keys and Enter open a result; a Task opens on its Goal's map with its details.
- The overview and the project switcher are one flat list of projects, those with work in progress first.
  - The Workspace headings are gone, and every project shows its full folder instead of a path relative to its Workspace (which showed "." for a Workspace that is itself a project).
  - Workspaces still decide which folders are scanned.
- On the overview, the cards narrow to the projects matching the search.

### Across view for long plans

- A plan too long for the screen wraps onto rows that turn back and forth like a snake, so a 45-Task Goal fits at a readable size.
- Detours branch and rejoin the right way on rows running in either direction.
- Each stop shows one file chip plus "+n", and long file names are shortened, so chips no longer overlap.

### Fixes

- The Servers panel no longer stays on "Loading…" when the dashboard is still served by a Progressor from before 0.3.1. It now says so and how to close that process.
- `/api/info` reports the process ID of the server serving the dashboard.

## 0.3.1 · Running servers

### Running servers in the dashboard

- A **🖥 Servers** button in the top bar shows how many Progressor processes are running.
- Its panel lists each one with its project, folder, Goal, memory and start time, and marks the one serving the dashboard.
- **Stop** ends a server after a confirm.
  - Only the dashboard's own page can stop one, never another website.
  - The server is asked to exit by itself, so no other program can be hit.
- When the server serving the dashboard stops, another running server takes the dashboard over within about 5 seconds.

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
