# The MCP server also hosts the dashboard

Progressor ships as one npm package (`progressor-mcp`). The process the Agent's app starts serves both the MCP tools and the Developer's web dashboard on `localhost`, so a single install gives both, and both always show the same state. When several Agent sessions run on one project, the first to start serves the dashboard and every session watches the progress file. The dashboard is view-only: only the Agent writes to the progress record, and the Developer steers by talking to the Agent. Instead of editing, the Developer copies an item as a self-describing prompt (its reference, plan-file location and related code) and pastes it into the Agent chat, so there is never a second writer to keep in sync.

## Considered Options

- Editing in the dashboard, with changes attached to the Agent's next tool response: rejected to keep the Agent the single writer and the dashboard simple.
- A separate dashboard app alongside the MCP server: rejected because it means two installs that can drift apart.
