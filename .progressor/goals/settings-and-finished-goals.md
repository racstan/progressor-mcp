# Settings and finished Goals

Goal: a Settings panel for the Developer's dashboard defaults, finished Goals that ask to be looked at and then get out of the way, and Goals that can be reopened after a review.

## Tasks

- [x] Settings panel ^t1
  - summary: A ⚙️ button in the navbar opens Settings, saved per browser: default view (Across, Down, List), default "Open in" editor, theme (light, dark, system) and how finished Goals behave. Built so more settings can be added later.
  - code: `src/ui/App.tsx`
  - code: `src/ui/Settings.tsx`
- [x] Move "Open in" from the navbar into Settings ^t2
  - summary: The editor picker lives in Settings; the navbar gets less crowded.
  - code: `src/ui/App.tsx`
- [x] Finished Goals ask to be looked at ^t3
  - summary: A Goal that is done gets a green dot and colour until the Developer opens it; then it moves into a collapsed Done group. A setting moves finished Goals to Done straight away instead. View-only: the plan files are not touched.
  - code: `src/ui/App.tsx`
  - code: `src/ui/views.ts`
- [x] Hide a Goal with right-click ^t4
  - summary: Right-click a Goal in the sidebar to hide it from your view, and bring hidden Goals back from Settings. Saved per browser; the plan files are not touched.
  - code: `src/ui/App.tsx`
- [x] Reopen a finished Goal ^t5
  - summary: Test-first: claim_goal on a done Goal reopens it (back to in progress) so new Tasks can be added to the same list after a review; finished Tasks stay done. Update the server instructions.
  - code: `src/project.ts`
  - code: `src/server.ts`
  - code: `test/project.test.ts`
- [x] Copy as prompt for a finished Goal suggests reopening ^t6
  - summary: The copied text for a done Goal tells the Agent how to reopen it with claim_goal and add the missing Tasks.
  - code: `src/dashboard/prompt.ts`
  - code: `test/prompt.test.ts`
- [x] Check it in the browser ^t7
  - summary: Light and dark, every setting, a Goal finishing live, hiding and unhiding, and a reopened Goal.
