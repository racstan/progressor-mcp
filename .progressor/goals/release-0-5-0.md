# Release 0.5.0

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: Bundles More slash commands into 0.5.0.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [ ] Release workflow publishes it ^t2
  - summary: The v0.5.0 tag publishes to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [ ] Check npm, the Registry and the global install ^t3
  - summary: npm latest and the Registry's version endpoint both give 0.5.0.
