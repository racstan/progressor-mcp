# The MCP server also hosts one dashboard for every project

Progressor ships as one npm package (`progressor-mcp`). The process the Agent's app starts serves both the MCP tools and the Developer's web dashboard on `localhost`, so a single install gives both. The dashboard is view-only: only the Agent writes to the progress record, and the Developer steers by talking to the Agent. Instead of editing, the Developer copies an item as a self-describing prompt (its reference, plan-file location and related code) and pastes it into the Agent chat, so there is never a second writer to keep in sync.

There is one dashboard address, `localhost:4747`, for every project on the machine. Each Progressor server adds its project folder to a per-user registry (`~/.progressor/projects.json`). Whichever Progressor process holds the port is the hub: it serves every registered project, one at a time behind a project switcher, by reading that project's `.progressor/` markdown straight from disk and watching it for changes. Because the files are the source of truth (ADR 0002), the hub needs nothing from the other processes, so there is no protocol between them. The other servers only link to the hub, each `get_status` pointing at its own project (`?project=<id>`). When the hub exits, the next Progressor server to start takes the port, and so does the next `get_status` from one already running.

## Consequences

- The registry only lists where projects are, so it can never disagree with their progress. Entries whose folder or `.progressor/` is gone are hidden, not deleted.
- The hub's own settings (such as `PROGRESSOR_EDITOR`) apply to every project it serves. The editor can also be chosen per browser in the dashboard.
- A hub from an incompatible Progressor version answers on the port but is not shared. Newer servers move to the next free port.

## Considered Options

- Editing in the dashboard, with changes attached to the Agent's next tool response: rejected to keep the Agent the single writer and the dashboard simple.
- A separate dashboard app alongside the MCP server: rejected because it means two installs that can drift apart.
- One dashboard per project, each on its own port (the first design): rejected after use. The Developer had to know which port belonged to which project, and a stale process on 4747 showed the wrong project's Roadmap.
- Forwarding requests to the process that owns each project: rejected because the hub can read the markdown itself.
