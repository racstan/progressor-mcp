# Search and a flat project list

## Tasks

- [x] Flat project list ^t1
  - summary: The overview and switcher list projects flat, those with a Goal in progress first and then by name, each with its full folder path; the Workspace headings and relative paths are gone.
  - code: `src/ui/workspaces.ts`
  - code: `src/ui/Overview.tsx`
  - code: `src/ui/App.tsx`
  - code: `src/ui/projectList.ts`
  - code: `test/projectList.test.ts`
- [x] Search API ^t2
  - summary: GET /api/search?q= matches project names and folders, Goal titles and Outcomes, Task titles and summaries, and Ideas across every project, ranked and capped. Test-first.
  - code: `src/dashboard/search.ts`
  - code: `src/dashboard/http.ts`
  - code: `test/search.test.ts`
  - code: `test/dashboard.test.ts`
- [x] Search box in the top bar ^t3
  - summary: A search box in the top bar (/ or Ctrl+K) lists matching projects, Goals, Tasks and Ideas grouped by kind as you type; arrow keys and Enter open one, a Task with its popover, an Idea in the Help panel. The overview narrows to the projects with results.
  - code: `src/ui/Search.tsx`
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/Overview.tsx`
  - code: `src/ui/styles.css`
