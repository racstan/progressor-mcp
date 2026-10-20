# Release 0.5.1

## Tasks

- [x] Changelog, version bump and tag ^t1
  - summary: 0.5.1: plan and idea take their text optionally and ask in the chat when it is left out.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.5.1 tag published to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [x] Check npm, the Registry and the global install ^t3
  - summary: npm latest is 0.5.1; the Registry's version endpoint gives 0.5.1; the global install is 0.5.1.
