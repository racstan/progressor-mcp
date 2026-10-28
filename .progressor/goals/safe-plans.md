# Keep plans safe

## Tasks

- [x] Refuse to overwrite a file that didn't read ^t1
  - summary: A non-empty roadmap.md with no Goals section, or a goal file with no Tasks section, is reported as damaged: tools refuse to write it and say which file to fix; get_status says so too.
  - code: `src/project.ts`
  - code: `src/roadmap.ts`
  - code: `src/planFile.ts`
  - code: `test/safety.test.ts`
  - helper: Sonnet
  - helper branch: fix/safe-plans
  - evidence: Reviewed diff; 566 tests pass on fix/safe-plans; typecheck clean
  - estimate: 1h 30m
  - time spent: 3m
  - code: `docs/troubleshooting.md`
- [x] Safe saving on Windows ^t2
  - summary: Retry the rename a few times on EPERM/EBUSY/EACCES, remove the temporary file whatever happens, and only then fall back.
  - code: `src/project.ts`
  - code: `test/safety.test.ts`
  - helper: Sonnet
  - helper branch: fix/safe-plans
  - evidence: Rename retried 5x on EPERM/EBUSY/EACCES, tmp always removed; tested
  - estimate: 45m
  - time spent: 3m
  - code: `src/lock.ts`
