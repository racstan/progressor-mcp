# Running servers in the dashboard

## Tasks

- [x] Servers register themselves ^t1
  - summary: Each server and dashboard command writes ~/.progressor/servers/<pid>.json with its kind, folder, Session, version and memory, refreshes it every 15 s, removes it on exit, and exits cleanly when a stop request file appears. Test-first.
  - code: `src/servers.ts`
  - code: `src/serve.ts`
  - code: `src/dashboardCommand.ts`
  - code: `test/servers.test.ts`
- [x] List and stop through the dashboard API ^t2
  - summary: GET /api/servers lists live processes with the Goal each Session holds; POST /api/servers/<pid>/stop writes a stop request, only for listed processes, only from the dashboard's own page (Origin and a custom header, so other web pages cannot). Test-first.
  - code: `src/dashboard/http.ts`
  - code: `test/dashboard.test.ts`
- [x] Dashboard handover ^t3
  - summary: A process sharing the dashboard checks every 5 s that the hub still answers and takes the port over when it is gone, so stopping the hub keeps the dashboard up.
  - code: `src/dashboard/http.ts`
  - code: `test/dashboard.test.ts`
- [x] Servers panel in the top bar ^t4
  - summary: A top-bar button with the count opens a panel listing each process (project, folder, kind, Goal, memory, started, serves the dashboard) with a Stop button behind a confirm.
  - code: `src/ui/App.tsx`
  - code: `src/ui/Servers.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/styles.css`
- [x] Check in the browser and document ^t5
  - summary: Ran three servers from the build on port 4800: the panel listed them, Stop ended a plain server and then the hub, and another server took the dashboard over while the page stayed live. Documented in the README, changelog and ADR 0001.
  - code: `README.md`
  - code: `CHANGELOG.md`
  - code: `docs/adr/0001-mcp-server-hosts-the-dashboard.md`
