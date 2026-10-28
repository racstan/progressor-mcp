# Warn when the dashboard page is out of date

## Tasks

- [x] Know when the page is out of date ^t1
  - summary: The server says which dashboard build it serves in /api/info; the page remembers the build it was opened with and checks again every minute and on reconnect. A pure function turns that and how long the connection has been lost into the words to show.
  - code: `src/dashboard/http.ts`
  - code: `src/ui/stale.ts`
  - code: `test/stale.test.ts`
  - code: `test/dashboard.test.ts`
  - estimate: 45m
  - time spent: 3m
  - added: 2026-10-28T12:09:33.503Z by AI
  - updated: 2026-10-28T12:12:08.645Z by AI
- [x] Out-of-date bar with Refresh ^t2
  - summary: A bar under the top bar with the words and a Refresh button (reloads the page for a new version, reloads the data otherwise); monochrome, gently animated.
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/styles.css`
  - estimate: 45m
  - code: `src/ui/Icon.tsx`
  - added: 2026-10-28T12:09:33.503Z by AI
  - updated: 2026-10-28T12:12:08.645Z by AI

## Hand tests

- [ ] Keep the dashboard open, then close every AI chat that uses Progressor and wait a minute: a bar at the bottom should say the page lost touch, with a Refresh button. Open a chat again: the bar should go away by itself. After the next update (restart the chat), an open page should say "Progressor was updated" within a minute; Refresh loads the new version. ^h1
  - added: 2026-10-28T12:12:05.444Z by AI
