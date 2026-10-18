# Changelog

All notable changes to progressor-mcp. Each release is one Goal on Progressor's own Roadmap (`.progressor/`).

## 0.1.1 · Dashboard fixes

- Text in backticks inside Task summaries and Detour Reasons is shown as code, instead of showing the backticks.
- The sidebar heading reads "Roadmap · N Goals", and the Goals sit on one rail, so it's clear they belong to a single Roadmap.

## 0.1.0

First release.

- MCP server for any MCP app, with tools for Goals, Tasks, Detours (Merge back, Return, Recalibration), Ideas and Standing Instructions.
- Progress stored as markdown inside the project: `.progressor/roadmap.md` and one Plan File per Goal.
- One live, view-only dashboard at `localhost:4747` for every project on the machine, with Metro (across and down) and checklist views, Open in file and Copy as prompt.
