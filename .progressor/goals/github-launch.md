# Public GitHub repo and launch

Goal: people can find the source and trust the package.

## Tasks

- [x] Create the public GitHub repository ^t1
  - summary: racstan/progressor-mcp, created with gh at the Developer's request. Before the first push, commits are rewritten to Rachit Asthana with the GitHub noreply address so the personal email stays private.
- [x] Link the repo from package.json ^t2
  - summary: Add repository, homepage and bugs fields so the npm page links to the source.
  - code: `package.json`
- [x] Push main ^t3
  - summary: Add the remote and push main, with the Developer's go-ahead. The prototype branch stays local.
- [x] Tests on Windows, macOS and Linux in CI ^t4
  - summary: A GitHub Actions workflow running npm test on all three, on every push and pull request.
  - code: `.github/workflows/test.yml`
- [x] Demo GIF for the README ^t5
  - summary: Thirty seconds: an Agent drifts, the Detour appears on the dashboard, the plan carries on. Recorded headless from a scripted Agent; GIF in the README, MP4 linked.
  - code: `README.md`
  - code: `docs/media/demo.gif`
  - code: `docs/media/demo.mp4`
- [/] List Progressor in MCP server directories ^t6
  - summary: Official MCP Registry as io.github.racstan/progressor-mcp: listed and active since 0.2.1 (published by the Developer with mcp-publisher), a PR to punkpeye/awesome-mcp-servers (https://github.com/punkpeye/awesome-mcp-servers/pull/16893), and the web forms at mcp.so and PulseMCP, which the Developer submits. Glama lists it by itself; claim it there.
  - code: `server.json`
  - code: `package.json`
