# Release 0.3.1

## Tasks

- [x] Changelog, version bump and tag ^t1
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [/] Release workflow publishes it ^t2
  - summary: Pushing the v0.3.1 tag publishes to npm through trusted publishing (its first run, which validates it) and to the MCP Registry.
- [ ] Check npm and the MCP Registry ^t3
  - summary: Both show 0.3.1 as the latest version, and npm shows its provenance.
