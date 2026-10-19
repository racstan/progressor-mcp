# Release 0.3.0

## Tasks

- [x] Changelog, version bump and dry run ^t1
  - code: `CHANGELOG.md`
  - code: `package.json`
  - code: `server.json`
- [ ] Publish to npm ^t2
  - summary: The release workflow publishes it once the Developer has added it as a trusted publisher on npmjs.com.
- [ ] Publish to the MCP Registry ^t3
  - summary: The release workflow publishes it; then check npm and the Registry show 0.3.0.
- [/] Automatic releases from GitHub Actions ^t4
  - summary: A version tag publishes to npm through trusted publishing and to the MCP Registry through GitHub sign-in; already published versions are skipped.
  - code: `.github/workflows/release.yml`
  - code: `README.md`
