# Release 0.4.1

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: Bundles the Onboarding docs and feedback and Shorter README Goals into 0.4.1.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [ ] Release workflow publishes it ^t2
  - summary: The v0.4.1 tag publishes to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [ ] Check npm, the Registry and the global install ^t3
  - summary: npm latest and the Registry's version endpoint both give 0.4.1.
