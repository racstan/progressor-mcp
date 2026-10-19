# Across view for long plans

## Tasks

- [x] Wrap the line into rows ^t1
  - summary: chooseWrap picks the number of columns that shows the whole plan at the largest scale; rows run like a snake with U-turns at the ends, and merge or return loops follow each row's direction. Short plans stay on one line.
  - code: `src/dashboard/graph.ts`
  - code: `src/ui/geometry.ts`
  - code: `src/ui/MetroMap.tsx`
  - code: `test/geometry.test.ts`
- [x] One file chip per stop ^t2
  - summary: The horizontal map shows one file chip per stop plus +n, with names over 22 characters shortened; the vertical map keeps two.
  - code: `src/ui/MetroMap.tsx`
- [x] Open on the current Task ^t3
  - summary: With the plan wrapped to fit, the first view shows the whole Goal, current Task included, at a readable scale (0.72 for the 45-Task plan at 1440x900); the existing focus centring still applies when it cannot fit.
  - code: `src/ui/MetroMap.tsx`
