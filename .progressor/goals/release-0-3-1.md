# Release 0.3.1

## Tasks

- [x] Changelog, version bump and tag ^t1
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.3.1 tag published to npm through trusted publishing; npm took about 4 minutes to serve it, so the Registry step failed once. The workflow now waits for npm, and a re-run published to the Registry.
  - code: `.github/workflows/release.yml`
- [x] Check npm and the MCP Registry ^t3
  - summary: npm latest is 0.3.1 with SLSA provenance; the MCP Registry lists 0.3.1 as latest; the global install is updated.
