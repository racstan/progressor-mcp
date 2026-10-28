# Pictures on the dashboard

## Tasks

- [x] Attach a picture ^t1
  - state: released
  - summary: A tool for the AI to attach an image or short video (PNG, JPG, WebP, GIF, WebM) from a file path to a goal, step or hand test, with a caption; copied into the project's .progressor folder with a size limit.
  - code: `src/server.ts`
  - code: `src/project.ts`
  - code: `test/pictures.test.ts`
  - helper: Sonnet
  - helper branch: feat/pictures
  - evidence: 602 tests pass; real attach via MCP on a plan copy
  - estimate: 2h
  - time spent: 17m
- [x] Serve pictures to the dashboard ^t2
  - state: released
  - summary: The dashboard server serves only attached files of registered projects, with the right content type, nothing else from disk.
  - code: `src/dashboard/http.ts`
  - code: `test/pictures.test.ts`
  - helper: Sonnet
  - helper branch: feat/pictures
  - evidence: Served image and webm in Chrome, video plays
  - estimate: 1h
  - time spent: 17m
- [x] Show pictures on the goal page ^t3
  - state: released
  - summary: Thumbnails under a step, a thing to try and the Needs you box, a Pictures section in Notes, and a full-size view on click.
  - code: `src/ui/GoalPage.tsx`
  - code: `src/ui/Steps.tsx`
  - code: `src/ui/styles.css`
  - helper: Sonnet
  - helper branch: feat/pictures
  - evidence: Fixed viewer and Notes rows; light and dark screenshots
  - estimate: 2h
  - time spent: 17m
- [x] Docs and changelog ^t4
  - state: released
  - summary: How to ask the AI for screenshots, where they are kept.
  - code: `docs/reference.md`
  - code: `CHANGELOG.md`
  - helper: Sonnet
  - helper branch: feat/pictures
  - evidence: Docs and changelog reviewed
  - estimate: 30m
  - time spent: 17m

## Decisions

- Pictures stay on this computer only, out of git (.progressor/pictures/<goal>/ with index.json; pictures/ added to .progressor/.gitignore). One new tool, attach_picture (with remove). PNG, JPG, WebP, GIF, WebM, MP4, up to 10 MB each. Chosen by the Agent as the Developer said to implement pictures without picking; easy to change. ^c1
