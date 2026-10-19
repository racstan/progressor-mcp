# Setting Progressor up

The [README](../README.md#install) has the quick setup for Claude Code. This page has the rest: updating and removing, other MCP apps, and the hooks by hand.

## Updating, removing and teammates

To update later, run `npm install -g progressor-mcp@latest` and restart Claude Code. Running `init` again in a project changes nothing unless something is missing. To take Progressor out of a project, run `progressor-mcp init --remove`: it removes the server, the hooks and the note, and leaves your `.progressor/` record alone.

The commands `init` writes suit the computer it ran on (on Windows the server is started through `cmd /c`). If you commit `.mcp.json` and teammates use another system, each of them runs `npm install -g progressor-mcp` and `progressor-mcp init` once in their copy.

## Without the hooks, or with another MCP app

To add only the server to Claude Code, with no install, hooks or note:

```bash
claude mcp add progressor -- npx -y progressor-mcp
```

Any other MCP client can run the same command over stdio: `npx -y progressor-mcp`. Progressor keeps its files in the folder the client starts it in; set `PROGRESSOR_ROOT` to use another folder.

## Claude Code hooks (recommended)

An Agent can forget to call `get_status`, especially after its context has been compressed. With Claude Code you can take that out of its hands: two hooks put the plan in front of the Agent automatically.

- **At session start, on resume and after compaction**, the Agent gets the full status: the Goal, the current Task and its summary, any open Detour, the next Task and your Standing Instructions.
- **On every message**, it gets one line, such as `[Progressor] Goal: Ship OAuth login · Task: t2 Fix callback redirect loop · Next: t3 End-to-end tests`. The line is left out when no Goal is being worked on.

`progressor-mcp init` sets them up for you. To add them by hand, install Progressor globally (`npm install -g progressor-mcp`), then add this to `.claude/settings.json` in your project (or to `~/.claude/settings.json` for every project). If the file already has a `hooks` section, add these two entries to it:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "progressor-mcp hook session-start" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "progressor-mcp hook prompt" }] }]
  }
}
```

The hook reads `.progressor/` straight from disk, so it needs no running server, and it prints nothing in projects that don't use Progressor. It never blocks or fails a message: if anything goes wrong, it stays silent. Without a global install, `npx -y progressor-mcp hook ...` works as the command too, but npx adds about 1.5 seconds to every message while it checks the package, so a global install is recommended.
