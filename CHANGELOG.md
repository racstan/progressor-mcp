# Changelog

All notable changes to progressor-mcp. Each release is a Goal on Progressor's own Roadmap (`.progressor/`); from 0.2.0 on, one release bundles several finished Goals.

## 0.7.0 · Progress that survives, and plans that match how the AI works

Your progress no longer depends on the chat: everything the AI knows about the project is saved where both of you can see it, so a new chat, a compressed memory or a different app picks up exactly where things stopped.

### Important context

- Each project has one **📌 Important context** page: your rules, then the project's background (what it is, key facts, choices that hold for the whole project). The AI keeps it up to date and reads all of it at the start of every chat and after its memory is compressed. Find it in the dashboard's sidebar, above Your goals.
- Rules can be marked as **must never be broken**. They come first everywhere and carry a **Must** label on the page.
- When the AI hands work to a helper agent, it can paste your rules into the helper's instructions in one go.

### Plans that match how the AI really works

- One chat can work on **several goals at once**, for example while helper agents work on two of them.
- Steps have four new states: **With a helper**, **Waiting on you**, **Checked** and **Released**, each with its own mark on the map and the list.
- A goal with a step **waiting on you** turns amber and says so in the sidebar, at the top of the goal and in All projects, so you see at a glance when something needs you.
- Each goal lists the **decisions** made along the way and **notes**, including notes found while working on another goal.
- The AI can move a step to another goal, and update several steps in one go, which uses fewer tokens.
- The reminder the AI gets with each message says how old it is, and warns when it may be out of date.

### Fixes

- A project set up on Windows now works on macOS and Linux too, and the other way round. Before, Progressor failed to start with "Executable not found in $PATH: cmd". At the start of a chat the AI now warns you if Progressor can't start in that folder.
- When a chat closes, however it closes, its goals are freed and the dashboard's address (port 4747) is handed back. Goals left behind by chats that ended are cleared the next time the AI reads the plan. If the dashboard has to use another port, the AI tells you why.

## 0.6.2 · Refresh and hide finished goals

- A **Refresh** button in the top bar loads the latest plan and running servers at once, instead of waiting for the next change.
- **Hide all** under the **Finished** heading hides every finished goal from your list in one click. The plan keeps them, and they're listed under **Hidden**, where you can show them again. Only your browser's list changes.

## 0.6.1 · The Finished group closes

- The **Finished** group in the dashboard's sidebar now opens and closes when you click it. Before, it stayed open while the goal on screen was one of the finished ones.
- The README explains that one running Progressor shows every project on the same dashboard, whichever project or app it was started from, and how to have Progressor in every project.

## 0.6.0 · Simple for anyone, in any app

Progressor is now made for people who don't code as much as for those who do: the AI manages the plan by itself, the dashboard speaks plain English, and the docs cover every MCP app.

### The dashboard

- **Plain words everywhere**: *step*, *side trip*, *Your goals*, *Finished when* and *cancelled*, with no IDs, tool names or file paths unless you ask for them.
- **A status line** says what the AI is doing: *AI working · step 3 of 7 · last update 2 min ago*; *AI waiting* when its chat is open but nothing has changed for 15 minutes; *AI stopped* when its chat has closed.
- **A Show menu** replaces the Detours switch: side trips (on), cancelled steps (off) and file names (off).
- **Fewer things up front**: the Live chip is a green dot with its words on hover, and every control explains itself on hover. Help keeps only the feedback links. The code editor, hidden goals and the running servers move to **⚙️ Settings → Advanced**. The plan's rules and Ideas are no longer shown.
- Empty pages tell you what to say to your AI instead of which tool it should call.
- The top bar fits a phone screen.

### The AI

- **It runs the whole loop by itself**: it plans new work and starts it, carries on with a paused goal, finishes a goal when every step is done, and tells you in a plain sentence, with the dashboard link.
- **It talks plainly**: no tool names, IDs or file names when it tells you what it's doing.
- **It can change or drop a rule** you gave it, with the new `update_standing_instruction` tool.
- **Ideas are gone**: the `record_idea` and `promote_idea` tools and the **/progressor:idea** command are removed, to keep things simple. Ideas already in a plan are kept in the file.
- **/progressor:setup** has the AI run the setup itself instead of asking you to.

### Any MCP app

- **The right project folder in every app**: Progressor asks the app which folder is open (MCP roots), and refuses to start a plan in your home folder, the top of a drive or the Windows folder, saying how to fix it. `get_status` shows the project folder.
- **`init` adds Progressor's note to `AGENTS.md`** as well as `CLAUDE.md`, since most apps other than Claude Code read `AGENTS.md`.

### Fixes

- Two side trips with the same title no longer mix up their details.
- A goal can only be finished once every step is done or cancelled and no side trip is open.
- Titles, reasons and rules given with line breaks are kept on one line, so they no longer break the plan file.

### Docs

- A short README with a setup message to paste into any AI app.
- New guides: [getting started](docs/getting-started.md), [setup for your app](docs/apps.md) (Claude Code, Claude Desktop, VS Code, Cursor, Windsurf, Codex and others), [using Progressor](docs/using.md), [questions](docs/faq.md), [troubleshooting](docs/troubleshooting.md) with a line to paste to your AI for each problem, and [updating and removing](docs/updating-and-removing.md).

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
