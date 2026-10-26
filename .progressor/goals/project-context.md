# Important context page for each project

## Tasks

- [x] Decide what the page holds ^t1
  - summary: Decided with the Developer: one page per project with two parts, Rules (the Standing Instructions, unchanged) and a free-form Context; only the AI writes it; the AI sees the whole page at chat start and after compression, within a size limit.
- [x] Store the page and add tools to read and edit it ^t2
  - summary: Kept in .progressor/context.md (4000-character limit); the update_context tool replaces it and get_status shows it after the rules.
  - code: `src/project.ts`
  - code: `src/server.ts`
  - code: `test/project.test.ts`
  - code: `test/server.test.ts`
- [x] Show it in get_status and after compression ^t3
  - summary: The session-start hook (start of chat and after compression) adds the whole page; the per-prompt line does not.
  - code: `src/hooks.ts`
  - code: `test/hooks.test.ts`
- [x] Add the Important context page to the dashboard ^t4
  - summary: A read-only Important context page in the sidebar above Your goals, at #/context: Rules, then Context with paragraphs and lists.
  - code: `src/ui/App.tsx`
  - code: `src/ui/context.ts`
  - code: `src/ui/styles.css`
  - code: `test/context.test.ts`
- [x] Docs for the Important context page ^t5
  - code: `docs/using.md`
  - code: `docs/dashboard.md`
  - code: `docs/reference.md`
  - code: `docs/markdown-format.md`
  - code: `GLOSSARY.md`
