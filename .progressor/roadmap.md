# Roadmap

Progressor's own plan, kept with Progressor. Version 0.1.0 is published. Each Goal below is one small release: it ships one improvement and ends by publishing the next 0.1.x version.

## Goals

- [x] [0.1.1 · Dashboard fixes](goals/v0-1-1.md) ^v0-1-1
- [/] [0.1.2 · Status hooks for Claude Code](goals/v0-1-2.md) ^v0-1-2
- [ ] [0.1.3 · Automatic drift detection](goals/v0-1-3.md) ^v0-1-3
- [ ] [0.1.4 · One-command setup](goals/v0-1-4.md) ^v0-1-4
- [ ] [0.1.5 · Public GitHub repo and launch](goals/v0-1-5.md) ^v0-1-5

## Ideas

- Sections that group a large Goal's Tasks by area or file ^i1
  - note: Option (b) from the "titles" discussion; only if real Goals get too long to scan
- Shared dashboards for teams ^i2
- Statistics: how often work drifts and how long Tasks take ^i3
- A /progressor MCP prompt that shows the status on demand ^i4
- Import existing markdown plans (TODO.md, checklists) into Goals and Tasks ^i5
  - note: Start with GitHub-style checklists, headings as Goals; init --import <file> with a preview, original file untouched
- Cheaper get_status: send only what changed since the Session's last call ^i6
  - note: Measure today's token cost first
- Dashboard you can trust at a glance: stale warning, plan history from git, activity feed ^i7
  - note: Stale warning when a claimed Goal hasn't changed for ~20 minutes

## Standing Instructions

- Ask the Developer about product and UX decisions; make technical ones yourself and say what you chose ^s1
- Merge finished, tested branches into main yourself; ask before pushing or publishing ^s2
- Write tests first for anything with logic ^s3
- Each Goal is one patch release (0.1.x) and ends with its release Tasks; the Developer runs npm publish with their one-time code ^s4
