# Public GitHub repo and launch

Goal: people can find the source and trust the package.

## Tasks

- [ ] Developer creates the GitHub repository ^t1
  - summary: Developer step: create the repo under their account and share its address.
- [ ] Link the repo from package.json ^t2
  - summary: Add repository, homepage and bugs fields so the npm page links to the source.
  - code: `package.json`
- [ ] Push main ^t3
  - summary: Add the remote and push main, with the Developer's go-ahead. The prototype branch stays local.
- [ ] Tests on Windows, macOS and Linux in CI ^t4
  - summary: A GitHub Actions workflow running npm test on all three, on every push and pull request.
  - code: `.github/workflows/test.yml`
- [ ] Demo GIF for the README ^t5
  - summary: Thirty seconds: an Agent drifts, the Detour appears on the dashboard, the plan carries on.
  - code: `README.md`
- [ ] List Progressor in MCP server directories ^t6
  - summary: Submit it to the main MCP server directories once the repo, demo and a release exist.
