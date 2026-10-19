# Release 0.4.0

## Tasks

- [x] Changelog, version bump and tag ^t1
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
  - code: `package-lock.json`
- [x] Release workflow publishes it ^t2
  - summary: The v0.4.0 tag published to npm and, after the wait for npm, to the MCP Registry, all steps passing first time. The Registry check now asks for the exact version, since the search listing is cached.
  - code: `.github/workflows/release.yml`
- [x] Check npm, the Registry and the global install ^t3
  - summary: npm latest is 0.4.0; the Registry's version endpoints give 0.4.0 as latest (its search listing still shows a cached 0.3.1); the global install is 0.4.0.
