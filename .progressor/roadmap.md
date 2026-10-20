# Roadmap

Progressor's own plan, kept with Progressor. Version 0.1.1 is published; 0.1.2 was never published, and its changes ship in 0.2.0. From here on, Goals are features; a release Goal bundles several finished features into one version.

## Goals

- [x] [0.1.1 · Dashboard fixes](goals/v0-1-1.md) ^v0-1-1
- [x] [0.1.2 · Status hooks for Claude Code](goals/v0-1-2.md) ^v0-1-2
- [x] [Settings and finished Goals](goals/settings-and-finished-goals.md) ^settings-and-finished-goals
- [x] [Workspaces](goals/workspaces.md) ^workspaces
- [/] [Release 0.2.0](goals/release-0-2-0.md) ^release-0-2-0
- [ ] [Automatic drift detection](goals/drift-detection.md) ^drift-detection
- [x] [One-command setup](goals/one-command-setup.md) ^one-command-setup
- [/] [Public GitHub repo and launch](goals/github-launch.md) ^github-launch
- [/] [Slash commands in chat](goals/slash-commands.md) ^slash-commands
- [x] [Goal shaping from Developer feedback](goals/goal-shaping.md) ^goal-shaping
  - outcome: Goals can be renamed, reordered, dropped, given an Outcome and a short ID, recorded as already done, and duplicates are caught
- [x] [Release 0.3.0](goals/release-0-3-0.md) ^release-0-3-0
  - outcome: progressor-mcp 0.3.0 is on npm and in the MCP Registry with init, slash commands and the Goal tools
- [x] [Running servers in the dashboard](goals/servers-panel.md) ^servers-panel
  - outcome: The dashboard lists every running Progressor process with its folder, memory and age, and stops any of them after a confirm; stopping the one that serves the dashboard hands it to another.
- [x] [Release 0.3.1](goals/release-0-3-1.md) ^release-0-3-1
  - outcome: progressor-mcp 0.3.1 with the Servers panel is on npm and in the MCP Registry, published by the GitHub workflow alone.
- [x] [Search and a flat project list](goals/search.md) ^search
  - outcome: The overview and switcher list every project in one flat list, and a search box in the top bar finds projects, Goals, Tasks and Ideas across all projects as you type.
- [x] [Across view for long plans](goals/across-wrap.md) ^across-wrap
  - outcome: A 45-Task plan fits the screen in the Across view with readable labels and no overlapping chips, opening on the current Task.
- [x] [Release 0.4.0](goals/release-0-4-0.md) ^release-0-4-0
  - outcome: progressor-mcp 0.4.0 with search, the flat project list and wrapped Across maps is on npm and in the MCP Registry, published by the release workflow.
- [x] [Onboarding docs and feedback](goals/feedback.md) ^feedback
  - outcome: A new user (or their Agent) can set Progressor up from the README alone, and anyone stuck can report a problem from the dashboard's Help menu in one click.
- [x] [Shorter README](goals/short-readme.md) ^short-readme
  - outcome: The README holds only what a new user needs to set up, use and get help; the details live in docs/ and CONTRIBUTING.md, linked from it.
- [x] [Release 0.4.1](goals/release-0-4-1.md) ^release-0-4-1
  - outcome: 0.4.1, with the Help menu feedback links, --version and the shorter README, is on npm and the MCP Registry.
- [/] [More slash commands](goals/more-commands.md) ^more-commands
  - outcome: The docs name the commands as the / menu shows them (/progressor:status), and setup, next, idea and dashboard join status, plan and review.
  - claimed by: s-488302 (pid 19212) since 2026-10-20T05:10:06.827Z
- [x] [Release 0.5.0](goals/release-0-5-0.md) ^release-0-5-0
  - outcome: 0.5.0, with the setup, next, idea and dashboard commands and the every-project install, is on npm and the MCP Registry.
- [x] [Release 0.5.1](goals/release-0-5-1.md) ^release-0-5-1
  - outcome: 0.5.1, where plan and idea work with no text, is on npm and the MCP Registry.
- [x] [Release 0.5.2](goals/release-0-5-2.md) ^release-0-5-2
  - outcome: 0.5.2, where the dashboard's top bar fits a half-screen window, is on npm and the MCP Registry.

## Ideas

- Sections that group a large Goal's Tasks by area or file ^i1
  - note: Option (b) from the "titles" discussion; only if real Goals get too long to scan
- Shared dashboards for teams ^i2
- Statistics: how often work drifts and how long Tasks take ^i3
- A /progressor MCP prompt that shows the status on demand ^i4
  - promoted to: progressor://slash-commands
- Import existing markdown plans (TODO.md, checklists) into Goals and Tasks ^i5
  - note: Start with GitHub-style checklists, headings as Goals; init --import <file> with a preview, original file untouched
- Cheaper get_status: send only what changed since the Session's last call ^i6
  - note: Measure today's token cost first
- Dashboard you can trust at a glance: stale warning, plan history from git, activity feed ^i7
  - note: Stale warning when a claimed Goal hasn't changed for ~20 minutes
- Edit or remove a Standing Instruction ^i8
  - note: Came up fixing the outdated s4 (manual npm publish with a one-time code, now done by the release workflow): there is no tool to change or remove a Standing Instruction, so a replacement had to be added alongside it.

## Standing Instructions

- Ask the Developer about product and UX decisions; make technical ones yourself and say what you chose ^s1
- Merge finished, tested branches into main yourself; ask before pushing or publishing ^s2
- Write tests first for anything with logic ^s3
- A release bundles several finished Goals into one version, through its own release Goal; the Developer runs npm publish with their one-time code ^s4
- A release bundles several finished Goals into one version, through its own release Goal. Pushing a version tag (v0.4.1) makes the release workflow publish to npm and the MCP Registry by itself; ask the Developer before pushing the tag. This replaces s4. ^s5
