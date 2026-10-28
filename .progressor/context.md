# Important context

Progressor is an MCP server (npm package progressor-mcp) that keeps an AI's plan for a project in .progressor/ and shows it on a live dashboard. It is written in TypeScript; the dashboard is a small React app in src/ui.

- Tests: npm test (vitest). Type check: npm run typecheck. Build: npm run build.
- The dashboard runs at http://localhost:4747 and shows every project at once.
- Releases: pushing a version tag such as v0.6.3 makes GitHub publish to npm and the MCP Registry.
- The repo is github.com/racstan/progressor-mcp; finished work is merged into main locally. Since 2026-10-28 it is pushed only after the Developer has tested it locally and says so (s2).
- The Developer works on Linux and Windows, so setup must work on both.
- The dashboard can write to the plan in a few guarded ways (stop a server, mark hand tests, messages and answers, and editing the rules and this Important context on Project notes, which also messages the AI); each is a POST that only the dashboard's own page can send, written under the plan lock.
