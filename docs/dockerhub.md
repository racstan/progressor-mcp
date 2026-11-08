# Progressor

**Your AI's plan, saved in your project and shown live on a dashboard.**

Progressor is an MCP server for AI coding apps (Claude Code, Claude Desktop, Cursor, opencode and others). Your AI writes its plan (goals, steps, decisions, notes) into a `.progressor` folder in your project and keeps it up to date as it works, so the plan survives new conversations and compressed context. You follow every project on one page in your browser.

**Progressor is free. There is no paid version and no subscription. Anyone selling it is not us, so beware of impostors.** It's free for personal and other noncommercial use under the [PolyForm Noncommercial License 1.0.0](https://github.com/racstan/progressor-mcp/blob/main/LICENSE.md).

- Website: https://progressor-mcp.racstan.workers.dev
- Source and full docs: https://github.com/racstan/progressor-mcp
- Video: https://youtu.be/PVk795l6om8

## Use it

Your AI app starts the container itself for each conversation, so you save the command it should use, once. Your project folder is mounted into the container, because that's where the plan is kept.

**Claude Code**, in your project's folder (macOS or Linux):

```bash
claude mcp add progressor -- docker run -i --rm -v "$PWD:$PWD" -w "$PWD" -v progressor-data:/data -p 127.0.0.1:4800:4800 racstan/progressor-mcp
```

**Other apps** (Claude Desktop, Cursor, Windsurf…), in the app's MCP settings:

```json
{
  "mcpServers": {
    "progressor": {
      "command": "docker",
      "args": ["run", "-i", "--rm",
        "-v", "/path/to/your/project:/path/to/your/project", "-w", "/path/to/your/project",
        "-v", "progressor-data:/data", "-p", "127.0.0.1:4800:4800",
        "racstan/progressor-mcp"]
    }
  }
}
```

The dashboard is then at **http://localhost:4800**.

**Dashboard only, always running:**

```bash
docker run -d --name progressor --restart unless-stopped -v progressor-data:/data -v "$HOME/projects:$HOME/projects" -p 127.0.0.1:4800:4800 racstan/progressor-mcp daemon run
```

On Windows, mount the folder under `/work` and say so: `-v "C:\Projects\shop:/work/shop" -w /work/shop -e PROGRESSOR_ROOT=/work/shop`. More in the [README](https://github.com/racstan/progressor-mcp#run-it-with-docker).

## Tags

`latest` and each version (`1.3.0`, …), for `linux/amd64` and `linux/arm64`. The same image is on `ghcr.io/racstan/progressor-mcp`.
