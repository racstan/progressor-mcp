# Ship OAuth login

## Tasks

- [x] Add provider config ^t1
  - summary: Read the OAuth client ID, secret and redirect URL from the environment and fail fast when one is missing.
  - code: `src/auth/config.ts`
- [-] Callback route ^t2
  - summary: Exchange the code for tokens and store them in the session.
  - dropped by: ^d2
- [-] Session storage ^t3
  - dropped by: ^d2
- [-] Tests ^t4
  - dropped by: ^d2
- [x] Swap to a PKCE-capable session library ^t5
  - summary: Replace the cookie-session library with one that supports PKCE; sessions keep their shape.
  - code: `package.json`
  - code: `src/auth/session.ts`
  - added by: ^d2
- [/] Fix callback redirect loop ^t6
  - summary: Callback re-sets the session cookie on every hit; only set it after token exchange.
  - code: `src/auth/callback.ts`
  - code: `src/auth/session.ts:42`
  - added by: ^d2
- [ ] Session storage ^t7
  - summary: Keep tokens server-side, keyed by session ID, instead of in the cookie.
  - code: `src/auth/store.ts`
  - added by: ^d2
- [ ] End-to-end tests ^t8
  - summary: Log in against the provider's sandbox and check the session survives a reload.
  - code: `test/e2e/login.spec.ts`
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
