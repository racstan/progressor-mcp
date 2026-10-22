# Dashboard refresh and clear finished

## Tasks

- [x] Refresh button in the top bar ^t1
  - summary: Loads the latest plan and running servers at once.
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/styles.css`
- [x] Hide all finished goals ^t2
  - summary: A Hide all button under Finished hides every finished goal from this browser's list; the plan is unchanged.
  - code: `src/ui/goalList.ts`
  - code: `src/ui/App.tsx`
  - code: `test/goalList.test.ts`
