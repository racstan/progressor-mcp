# Release 0.4.1

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: Bundles the Onboarding docs and feedback and Shorter README Goals into 0.4.1.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.4.1 tag published to npm and then the MCP Registry, every step passing first time.
  - code: `.github/workflows/release.yml`
- [x] Check npm, the Registry and the global install ^t3
  - summary: npm latest is 0.4.1; the Registry's version endpoint gives 0.4.1; the global install is 0.4.1.
