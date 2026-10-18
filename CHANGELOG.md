# Changelog

All notable changes to progressor-mcp. Each release is one Goal on Progressor's own Roadmap (`.progressor/`).

## 0.1.2 · Status hooks for Claude Code

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
