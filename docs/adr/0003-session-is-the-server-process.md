# A Session is the MCP server process, and a Claim records its pid

An MCP client starts one Progressor process per Agent conversation, and the conversation's sub-agents share it. So Progressor treats its own process as the Session: it makes up a Session ID at startup, and a Claim in `roadmap.md` records that ID, the process's pid and the time (`claimed by: s-7f3a (pid 18244) since ...`). The Claim is released when the process exits normally (stdin closes or it gets a signal). If the process dies without releasing it, the pid is no longer running, so the next Session that wants the Goal sees the Claim as stale and takes it. A Claim held by a running process can only be taken with an explicit `takeover`.

## Consequences

- Nothing in the protocol identifies a conversation, so a client that reuses one server process for several conversations would make them one Session.
- pids are reused by the OS, so a stale Claim can occasionally look live; `takeover` is the way out.
- Claims are only meaningful on one machine, which matches ADR 0002's progress-in-the-project design.

## Considered Options

- The Agent passes a session token to every tool: rejected because the Agent cannot reliably keep it across context compression, which is the problem Progressor exists to solve.
- Heartbeats with an expiry time: rejected for now because it needs a timer writing to the markdown file, producing noisy diffs.
