# Release 0.5.0

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: Bundles More slash commands into 0.5.0.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.5.0 tag published to npm and then the MCP Registry, every step passing.
  - code: `.github/workflows/release.yml`
- [x] Check npm, the Registry and the global install ^t3
  - summary: npm latest is 0.5.0; the Registry's version endpoint gives 0.5.0; the global install is 0.5.0.
