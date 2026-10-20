# Release 0.5.1

## Tasks

- [/] Changelog, version bump and tag ^t1
  - summary: 0.5.1: plan and idea take their text optionally and ask in the chat when it is left out.
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [ ] Release workflow publishes it ^t2
  - summary: The v0.5.1 tag publishes to npm and then the MCP Registry.
  - code: `.github/workflows/release.yml`
- [ ] Check npm, the Registry and the global install ^t3
  - summary: npm latest and the Registry's version endpoint both give 0.5.1.
