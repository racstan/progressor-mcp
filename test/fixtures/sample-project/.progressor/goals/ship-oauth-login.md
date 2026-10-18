# Ship OAuth login

## Tasks

- [x] Add provider config ^t1
  - code: `src/auth/config.ts`
- [-] Callback route ^t2
  - dropped by: ^d2
- [-] Session storage ^t3
  - dropped by: ^d2
- [-] Tests ^t4
  - dropped by: ^d2
- [x] Swap to a PKCE-capable session library ^t5
  - added by: ^d2
  - code: `package.json`
  - code: `src/auth/session.ts`
- [/] Callback route ^t6
  - added by: ^d2
  - code: `src/auth/callback.ts`
  - code: `src/auth/session.ts:42`
- [ ] Session storage ^t7
  - added by: ^d2
- [ ] End-to-end tests ^t8
  - added by: ^d2

## Detour: Fix flaky CI test ^d1

- branched from: ^t1
- reason: CI kept failing on an unrelated timing test, which blocked every push
- status: merged back

## Detour: Session library lacks PKCE ^d2

- branched from: ^t2
- reason: The planned session library cannot do PKCE, which the provider requires
- status: recalibrated

## Detour: Logger refactor ^d3

- branched from: ^t6
- reason: Callback errors were unreadable, so the logger is being restructured first
- status: open
