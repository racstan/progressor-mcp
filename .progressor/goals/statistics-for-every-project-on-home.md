# Statistics for every project on Home

## Tasks

- [x] Add up every project's statistics ^t1
  - summary: combineStats sums the projects' statistics (per-day counts by day, longest steps across all, a line per project); served at GET /api/stats.
  - code: `src/stats.ts`
  - code: `test/stats.test.ts`
  - code: `src/dashboard/http.ts`
  - code: `test/dashboard.test.ts`
  - estimate: 45m
  - time spent: 1m
  - started: 2026-10-28T12:27:37.110Z
  - finished: 2026-10-28T12:28:23.780Z
  - added: 2026-10-28T12:27:37.077Z by AI
  - updated: 2026-10-28T12:28:23.780Z by AI
- [x] Statistics on Home ^t2
  - summary: A section on Home with the headline tiles, the per-day chart and estimates line across all projects, and a table of projects that opens each one's Statistics page; reuses the Statistics page's pieces.
  - code: `src/ui/HomePage.tsx`
  - code: `src/ui/StatsPage.tsx`
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/styles.css`
  - estimate: 1h
  - time spent: 1m
  - started: 2026-10-28T12:28:23.808Z
  - finished: 2026-10-28T12:29:49.508Z
  - added: 2026-10-28T12:27:37.077Z by AI
  - updated: 2026-10-28T12:29:49.510Z by AI
- [x] Docs and changelog ^t3
  - summary: Mention the statistics on Home.
  - code: `docs/dashboard.md`
  - code: `docs/reference.md`
  - code: `CHANGELOG.md`
  - estimate: 10m
  - started: 2026-10-28T12:29:49.509Z
  - finished: 2026-10-28T12:29:49.509Z
  - added: 2026-10-28T12:27:37.077Z by AI
  - updated: 2026-10-28T12:29:49.510Z by AI

## Hand tests

- [ ] After restarting the chat, open Home on the dashboard and scroll down to Statistics: the numbers should add up across your projects. Click Statistics on a project's line: it should open that project's Statistics page. ^h1
  - added: 2026-10-28T12:29:49.532Z by AI
