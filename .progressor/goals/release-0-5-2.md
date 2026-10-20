# Release 0.5.2

## Tasks

- [/] Changelog, version bump and tag ^t1
  - summary: 0.5.2: the top bar fits narrow windows.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [ ] Release workflow publishes it ^t2
  - summary: The v0.5.2 tag publishes to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [ ] Check npm, the Registry and the global install ^t3
  - summary: npm latest and the Registry's version endpoint both give 0.5.2.
