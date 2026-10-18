# Workspaces

Goal: point Progressor at any folder and see every Project inside it, grouped by folder, from anywhere on the PC and without an Agent running.

## Tasks

- [x] Find the Projects inside a folder ^t1
  - summary: Test-first: scan a folder and its subfolders for `.progressor/` folders, skipping `node_modules`, `.git`, `dist` and similar, with a depth limit so huge folders stay fast. Read-only: never creates anything.
  - code: `src/dashboard/workspace.ts`
  - code: `test/workspace.test.ts`
- [x] progressor-mcp dashboard command ^t2
  - summary: `progressor-mcp dashboard [folder]` scans the folder (the current one by default), serves the dashboard and opens it in the browser, with no MCP client needed.
  - code: `src/cli.ts`
  - code: `src/dashboard/http.ts`
- [x] Combine scanned Projects with the known ones ^t3
  - summary: The dashboard lists Projects found by scanning together with the ones Progressor servers have registered, without duplicates.
  - code: `src/dashboard/registry.ts`
  - code: `src/dashboard/http.ts`
- [x] Group the project switcher by Workspace ^t4
  - summary: The switcher shows Workspace, then Project (name and path), then its Goals.
  - code: `src/ui/App.tsx`
- [x] Workspace overview page ^t5
  - summary: Every Project in the Workspace at a glance: its active and paused Goals and their progress; the start page when there is more than one Project.
  - code: `src/ui/Overview.tsx`
- [x] Docs and decision record ^t6
  - summary: README section on Workspaces and the dashboard command; update ADR 0001 for scanning alongside the registry.
  - code: `README.md`
  - code: `docs/adr/0001-mcp-server-hosts-the-dashboard.md`
- [x] Check it in the browser ^t7
  - summary: A folder with several Projects at different depths, the overview, the switcher and live updates.
