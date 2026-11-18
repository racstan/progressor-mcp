# Progressor

<!-- mcp-name: io.github.racstan/progressor-mcp -->

**Your AI's plan, saved in your project and shown live on a dashboard.**

Progressor is an [MCP](https://modelcontextprotocol.io) server for AI coding apps (Claude Code, Claude Desktop, Cursor, VS Code with Copilot, Windsurf, Codex and others). Your AI writes its plan into your project as a **goal** made of **steps**, and ticks each step off as it works. You watch every project on one page in your browser. Because the plan lives in your project, not in the chat, your AI picks up from the exact step it was on after its memory is compressed, or when you switch to another AI app.

This is the Python package of Progressor. It is the same Progressor as the [npm package](https://www.npmjs.com/package/progressor-mcp), and it brings its own Node.js, so **you don't need Node installed**.

## Set it up

With [uv](https://docs.astral.sh/uv/), in your project's folder:

```bash
uvx progressor-mcp init
```

That one command sets up Claude Code and Claude Desktop: the server, the hooks that hand your AI the plan at the start of every conversation, and a short note telling it to use Progressor. Restart your AI app, then ask it to plan something.

For other apps, add this server to the app's MCP settings ([where each app keeps them](https://github.com/racstan/progressor-mcp/blob/main/docs/apps.md)):

```json
{
  "mcpServers": {
    "progressor": { "command": "uvx", "args": ["progressor-mcp"] }
  }
}
```

then run `uvx progressor-mcp init --no-server` in your project's folder.

Prefer pip? `pip install progressor-mcp` (or `uv tool install progressor-mcp`) gives you the `progressor-mcp` command; use it in place of `uvx progressor-mcp` above.

## The dashboard

It opens at **http://localhost:4747** while your AI app is running, and shows every project at once. To keep it up all the time: `progressor-mcp daemon install`.

## Update it

- **uvx:** `uv cache clean progressor-mcp`, then restart your AI app.
- **uv tool:** `uv tool upgrade progressor-mcp`.
- **pip:** `pip install -U progressor-mcp`.

The dashboard tells you when a newer version is out, with the command for your setup.

## More

The full guide, screenshots and a 5-minute video are on [GitHub](https://github.com/racstan/progressor-mcp#readme).

**Free for personal use.** Using it in a business, or selling, hosting or building a product on it, needs a license from the author: [ask for one](https://github.com/racstan/progressor-mcp/issues/new?template=commercial_license.yml). See [LICENSE.md](https://github.com/racstan/progressor-mcp/blob/main/LICENSE.md).
