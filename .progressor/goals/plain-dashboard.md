# Plain-English dashboard

## Tasks

- [x] Plain words everywhere ^t1
  - summary: Step, side trip, Your goals, cancelled, Finished when; empty pages say to tell your AI what to build; no tool names, ids or file paths on screen.
  - code: `src/ui/`
- [x] One clear status line ^t2
  - summary: AI working / AI waiting (chat open, nothing new for 15 min) / AI stopped (chat closed) · step 3 of 7 · last update 2 min ago, from the Plan File's change time the roadmap API now sends.
  - code: `src/ui/App.tsx`
  - code: `src/dashboard/http.ts`
- [x] Live dot and hovers ^t3
  - summary: The Live chip is a dot with its words on hover (Reconnecting stays visible); every control gets a plain-English hover.
  - code: `src/ui/App.tsx`
  - code: `src/ui/styles.css`
- [x] Show menu ^t4
  - summary: A Show menu with side trips, cancelled steps and file names (off by default) replaces the lone Detours switch.
  - code: `src/ui/App.tsx`
  - code: `src/ui/views.ts`
- [x] Fewer things up front ^t5
  - summary: Help keeps only feedback links; Ideas and Standing Instructions leave the dashboard and search. Editor, hidden goals and running servers move to Settings > Advanced; Open plan file shows only with File names on.
  - code: `src/ui/App.tsx`
  - code: `src/ui/Search.tsx`
  - code: `src/dashboard/search.ts`
