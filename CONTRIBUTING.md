# Contributing

Thanks for helping. Report problems and ideas through the [issue forms](https://github.com/racstan/progressor-mcp/issues/new/choose); for code, open a pull request with tests for anything with logic.

## Development

The code uses Progressor's own terms (Goal, Task, Detour, Outcome, Standing Instruction), defined in the [glossary](GLOSSARY.md). Everything a person reads says them in everyday words instead (goal, step, side trip, Finished when, a rule your AI keeps): the dashboard's words are in `src/ui/words.ts`, and the [reference](docs/reference.md) has the full list.

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` compiles the server to `dist/` and bundles the dashboard (React, in `src/ui/`) into `dist/ui/`; `node dist/cli.js` starts the server on stdio. To try the dashboard without an MCP client, serve it for one or more project folders (by default the sample in `test/fixtures/sample-project`). It runs on port 4800 with a throwaway project list, so it never takes the real dashboard's place:

```bash
node scripts/dashboard.mjs test/fixtures/sample-project
```

The README's video, GIF and screenshots come from two sample projects, "Recipe box" and "Portfolio site", that `scripts/demo.mjs` writes and films with headless Chrome. It writes the GIF, the screenshots and the YouTube thumbnail that live in `docs/media/`, and the full video (`progressor-showcase.mp4`, which is uploaded to YouTube and kept out of git). It needs playwright-core and ffmpeg; see the top of the script:

```bash
npm run build && node scripts/demo.mjs docs/media
```

`npm run dev:ui` rebuilds the page on every change; reload the browser to see it. The server side of the dashboard is in `src/dashboard/`: the HTTP server and API (`http.ts`), the project list (`registry.ts`), the file watcher (`watch.ts`), and the pure logic shared with the page: the metro map layout (`graph.ts`), the Copy-as-prompt text (`prompt.ts`) and the editor links (`editor.ts`).

## Releasing

Releases publish themselves from GitHub Actions ([release.yml](.github/workflows/release.yml)). Bump the version (here `0.6.0`) in `package.json` and `server.json` (both `version` and `packages[0].version`), add a `CHANGELOG.md` entry, commit, then tag and push:

```bash
git tag v0.6.0
```

```bash
git push origin main --tags
```

The workflow checks that the tag and both files agree, then publishes to npm through npm's trusted publishing (no token or one-time code) and to the official MCP Registry, signed in through GitHub. A version already published is skipped, so a failed run can simply be run again from the Actions tab.
