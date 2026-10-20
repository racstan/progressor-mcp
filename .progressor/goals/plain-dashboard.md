# Plain-English dashboard

## Tasks

- [ ] Plain words everywhere ^t1
  - summary: Step, side trip, Your goals, cancelled, Finished when; empty pages say to tell your AI what to build; no tool names, ids or file paths on screen.
  - code: `src/ui/`
- [ ] One clear status line ^t2
  - summary: Working on X · step 3 of 7 · last update 2 min ago, or AI stopped 1 h ago.
  - code: `src/ui/App.tsx`
  - code: `src/dashboard/http.ts`
- [ ] Live dot and hovers ^t3
  - summary: The Live chip is a dot with its words on hover (Reconnecting stays visible); every control gets a plain-English hover.
  - code: `src/ui/App.tsx`
  - code: `src/ui/styles.css`
- [ ] Show menu ^t4
  - summary: A Show menu with side trips, cancelled steps and file names (off by default) replaces the lone Detours switch.
  - code: `src/ui/App.tsx`
  - code: `src/ui/views.ts`
- [ ] Fewer things up front ^t5
  - summary: Help keeps only feedback links; Ideas and Standing Instructions leave the dashboard; Servers, editor, Open plan file and hiding Goals move to Settings > Advanced.
  - code: `src/ui/App.tsx`
  - code: `src/ui/Search.tsx`
  - code: `src/dashboard/search.ts`
