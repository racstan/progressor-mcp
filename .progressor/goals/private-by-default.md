# Plans stay private by default

## Tasks

- [x] Keep a new plan out of git ^t1
  - summary: When a project's .progressor/ folder is first made (by init or the first change to the plan), write .progressor/.gitignore with a line that ignores everything, and a comment on how to share it instead.
  - code: `src/project.ts`
  - code: `src/init.ts`
  - code: `test/project.test.ts`
  - code: `test/init.test.ts`
  - code: `src/initCommand.ts`
  - code: `test/private.test.ts`
  - estimate: 45m
  - time spent: 2m
  - started: 2026-10-28T13:28:48.320Z
  - finished: 2026-10-28T13:30:23.403Z
  - added: 2026-10-28T13:28:48.270Z by AI
  - updated: 2026-10-28T13:30:23.403Z by AI
- [x] Docs and changelog ^t2
  - summary: Say the plan is private by default and how to share it with git; add it to the 1.0.0 changelog.
  - code: `docs/faq.md`
  - code: `docs/markdown-format.md`
  - code: `docs/reference.md`
  - code: `README.md`
  - code: `CHANGELOG.md`
  - code: `docs/dashboard.md`
  - estimate: 20m
  - finished: 2026-10-28T13:30:23.422Z
  - added: 2026-10-28T13:28:48.270Z by AI
  - updated: 2026-10-28T13:30:23.422Z by AI
