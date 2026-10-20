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

Any other MCP client can run the same command over stdio: `npx -y progressor-mcp`. Progressor keeps its files in the project folder: the one Claude Code names in `CLAUDE_PROJECT_DIR`, or else the folder the client starts it in. Set `PROGRESSOR_ROOT` to use another folder.

## Use Progressor in every project

`init` sets Progressor up one project at a time, so a conversation opened in another folder has no Progressor. To have it in every conversation, whatever its folder, register it once for your user instead:

```bash
claude mcp add --scope user progressor -- npx -y progressor-mcp
```

On Windows, put `cmd /c` before `npx`. With the global install, `progressor-mcp` on its own replaces `npx -y progressor-mcp` and starts faster. Other MCP apps have a user-wide MCP settings file too (in Cursor, `~/.cursor/mcp.json`); add the same command there.

Then, in any folder, type **/progressor:setup** in the chat. The Agent lists what it would add (the hooks, the note in `CLAUDE.md` and an empty Roadmap), and runs `progressor-mcp init --no-server` once you say OK. It leaves `.mcp.json` alone, since Progressor is already running. Progressor's tools work at once; the hooks and the note take effect from the next conversation.

Register Progressor one way or the other, not both: a project entry in `.mcp.json` as well as the user one would start two copies.

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
