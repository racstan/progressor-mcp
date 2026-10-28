# Calm dashboard

## Tasks

- [x] Design system: colours, type, spacing, icons ^t1
  - summary: One accent plus greys, green only for done and amber only for needs-you, a 4-size type scale and an 8px spacing scale as CSS variables, and simple line icons instead of emoji.
  - code: `src/ui/styles.css`
  - code: `src/ui/Icon.tsx`
  - estimate: 1h 30m
  - time spent: 15m
- [x] Home page ^t2
  - summary: What you see first: a short greeting line, 'Needs you' across projects, 'In progress', then each project with its open goals; stable, no jumping.
  - code: `src/ui/Home.tsx`
  - code: `src/ui/App.tsx`
  - estimate: 2h
  - code: `src/ui/HomePage.tsx`
  - code: `src/ui/home.ts`
  - code: `test/home.test.ts`
- [x] Shell: top bar and sidebar ^t3
  - summary: Top bar with project, search and settings only; sidebar groups goals as Needs you, In progress, Up next, Finished (folded), one line each; phone gets a menu button.
  - code: `src/ui/App.tsx`
  - code: `src/ui/Sidebar.tsx`
  - code: `src/ui/TopBar.tsx`
  - estimate: 2h
  - code: `src/ui/Menus.tsx`
  - code: `src/ui/Search.tsx`
- [x] Goal page ^t4
  - summary: Title, finished-when line, one quiet progress line; one 'Needs you' panel; steps as a clean list with details on click; map, conversation, decisions and notes in tabs.
  - code: `src/ui/GoalPage.tsx`
  - code: `src/ui/Checklist.tsx`
  - code: `src/ui/Talk.tsx`
  - code: `src/ui/HandTests.tsx`
  - estimate: 3h
  - code: `src/ui/Steps.tsx`
  - code: `src/ui/GoalNotes.tsx`
  - code: `src/ui/Popover.tsx`
  - code: `src/ui/ContextPage.tsx`
- [x] Check, screenshots and your approval ^t5
  - summary: Light, dark, laptop and phone screenshots of the real plan; the Developer approves before merge.
  - estimate: 1h
  - time spent: 1h 21m
- [x] Monochrome with heavy borders ^t6
  - summary: Black, white and greys only: no blue accent, green or amber; no coloured backgrounds. Heavy 2px borders on cards, panels and lists; states told apart by fill, weight and borders. Map in greys too.
  - code: `src/ui/styles.css`
  - code: `src/ui/MetroMap.tsx`
  - estimate: 1h
  - time spent: 2m
- [x] Highlight what is being done, with transitions ^t7
  - summary: The step being worked on stands out (inverted row, moving progress stripe, pulsing mark), the goal in progress is marked in the sidebar and on Home, and hovers, tabs, opening a step and the drawer move smoothly; all respects reduced motion.
  - code: `src/ui/styles.css`
  - code: `src/ui/Steps.tsx`
  - code: `src/ui/GoalPage.tsx`
  - estimate: 1h
  - code: `src/ui/App.tsx`
  - code: `src/ui/HomePage.tsx`
- [x] Vibrant theme ^t8
  - summary: A fourth theme in Settings next to Light, Dark and System: the colourful look (indigo accent, green for done, amber for needs you, soft borders), light only.
  - code: `src/ui/styles.css`
  - code: `src/ui/App.tsx`
  - estimate: 45m

## Decisions

- Untried hand tests count as needing the Developer, but each "things to try" reason has a Not now button (Developer asked for a way to dismiss). Not now is kept in this browser only and leaves the plan unchanged; the goal comes back to Needs you when the AI adds another thing to try. Questions and steps waiting on the Developer cannot be put off. ^c1
