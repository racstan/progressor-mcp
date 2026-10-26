# Important context

Progressor is an MCP server (npm package progressor-mcp) that keeps an AI's plan for a project in .progressor/ and shows it on a live dashboard. It is written in TypeScript; the dashboard is a small React app in src/ui.

- Tests: npm test (vitest). Type check: npm run typecheck. Build: npm run build.
- The dashboard runs at http://localhost:4747 and shows every project at once.
- Releases: pushing a version tag such as v0.6.3 makes GitHub publish to npm and the MCP Registry.
- The repo is github.com/racstan/progressor-mcp; work is merged into main and pushed after each finished Goal.
- The Developer works on Linux and Windows, so setup must work on both.
