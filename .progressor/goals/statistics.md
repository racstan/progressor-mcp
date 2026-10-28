# Statistics

## Tasks

- [x] Work out the statistics from the plan ^t1
  - summary: A pure function over every goal's steps and side trips: counts, time spent against estimates, side trips and how they ended, steps finished per day, longest steps, per goal; served at GET /api/projects/:p/stats.
  - code: `src/stats.ts`
  - code: `test/stats.test.ts`
  - code: `src/dashboard/http.ts`
  - estimate: 1h 30m
  - time spent: 2m
  - code: `test/dashboard.test.ts`
  - added: 2026-10-28T12:09:33.540Z by AI
  - updated: 2026-10-28T12:13:39.092Z by AI
- [x] Statistics page ^t2
  - summary: Sidebar link and #/stats page: a few headline numbers, a per-day bar chart, how estimates compare, side trips, longest steps and a table per goal; follows the theme rules.
  - code: `src/ui/StatsPage.tsx`
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/context.ts`
  - code: `src/ui/styles.css`
  - estimate: 2h
  - time spent: 3m
  - code: `src/ui/words.ts`
  - code: `src/ui/Icon.tsx`
  - code: `test/words.test.ts`
  - added: 2026-10-28T12:09:33.540Z by AI
  - updated: 2026-10-28T12:16:31.413Z by AI
- [x] Docs and changelog ^t3
  - summary: Describe the Statistics page and the out-of-date bar.
  - code: `docs/dashboard.md`
  - code: `docs/reference.md`
  - code: `CHANGELOG.md`
  - estimate: 20m
  - time spent: 2m
  - added: 2026-10-28T12:09:33.540Z by AI
  - updated: 2026-10-28T12:18:01.677Z by AI

## Hand tests

- [ ] After restarting the chat, open Statistics in the sidebar. Check the numbers look believable for this project, hover the bars in "Finished each day", and click a goal in "Each goal" to open it. Try it in Dark and Vibrant too. ^h1
  - added: 2026-10-28T12:18:01.700Z by AI
