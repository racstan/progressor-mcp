# Release 0.5.2

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: 0.5.2: the top bar fits narrow windows.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.5.2 tag published to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [x] Check npm, the Registry and the global install ^t3
  - summary: npm latest is 0.5.2; the Registry's version endpoint gives 0.5.2; the global install is 0.5.2.
