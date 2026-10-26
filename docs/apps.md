# Setup for your app

Progressor is an MCP server: a small program your AI app starts in the background to give your AI extra tools. Every app that supports MCP can run it. The quickest way is to paste the setup message from the [README](../README.md#set-it-up) into your AI's chat and let it follow this page for you. If you'd rather do it by hand, find your app below.

Everywhere on this page you need [Node.js](https://nodejs.org) 22 or later, and Progressor installed once on your computer:

```bash
npm install -g progressor-mcp
```

> **Without installing:** you can put `npx` with the arguments `-y progressor-mcp` wherever this page says `progressor-mcp`. It downloads Progressor when the app starts it, which is a little slower.

After you add Progressor to an app, **restart the app** (or reload its MCP servers), and approve the `progressor` server if it asks. Then ask your AI: *"Call Progressor's get_status and tell me what it says."* If it answers with the plan (empty at first) and a dashboard link, it works.

## Claude Code

In a terminal, in your project folder:

```bash
progressor-mcp init
```

It shows what it will add and asks once:

- the `progressor` server in `.mcp.json`, so Claude Code starts it in this project;
- two hooks in `.claude/settings.json` that hand your AI the plan at the start of every conversation and a one-line reminder with every message, so it never loses track;
- a short note in `CLAUDE.md` and `AGENTS.md` telling the AI to use Progressor;
- an empty plan in `.progressor/`.

Restart Claude Code in that folder and approve `progressor`. Its commands are in the `/` menu as `/progressor:status (MCP)` and so on: type `/progressor` to see them.

**In every project at once.** Instead of `init` in each project, register Progressor once for your user:

```bash
claude mcp add --scope user progressor -- progressor-mcp
```

Then type **/progressor:setup** in any project's chat: your AI adds the hooks, the notes and the empty plan to that folder for you. Use one way or the other, not both, or Claude Code starts two copies.

**On Windows**, `init` sets up the right command for you. `.mcp.json` gets the same command on every system, and Claude Code is told to start Progressor through `cmd /c` on your computer only, so a project set up on Windows still works on a Mac or Linux. If you add Progressor by hand, put `cmd /c` before the command: `claude mcp add --scope user progressor -- cmd /c progressor-mcp`.

The Claude desktop app's **Code** tab is Claude Code, so all of this applies there too.

## Claude Desktop (the chat app)

Open **Settings → Developer → Edit Config**. It opens `claude_desktop_config.json` (on Windows in `%APPDATA%\Claude\`, on macOS in `~/Library/Application Support/Claude/`). Add Progressor under `mcpServers`, with your project's folder:

```json
{
  "mcpServers": {
    "progressor": {
      "command": "progressor-mcp",
      "args": [],
      "env": { "PROGRESSOR_ROOT": "C:\\Users\\you\\projects\\my-app" }
    }
  }
}
```

The chat app is not opened in a project folder, so `PROGRESSOR_ROOT` tells Progressor where your project is (on macOS and Linux, a path like `/Users/you/projects/my-app`). If the file already has other servers, add `"progressor": { ... }` next to them. Save, then quit Claude Desktop completely and open it again.

## VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your project (or run **MCP: Add Server** from the Command Palette, pick **Command (stdio)** and enter `progressor-mcp`):

```json
{
  "servers": {
    "progressor": {
      "type": "stdio",
      "command": "progressor-mcp",
      "args": []
    }
  }
}
```

Note that VS Code calls the list `servers`, not `mcpServers`. Switch Copilot Chat to **Agent** mode, and start the server when VS Code asks (or with the ▷ Start link above it in `mcp.json`). VS Code tells Progressor which folder is open, so the plan lands in your project. Progressor's commands appear in the chat's `/` menu among the MCP commands.

## Cursor

Create `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` to have Progressor in every project:

```json
{
  "mcpServers": {
    "progressor": {
      "command": "progressor-mcp",
      "args": []
    }
  }
}
```

Then open **Cursor Settings → MCP** and check that `progressor` is on and shows a green dot.

## Windsurf

Open **Windsurf Settings → Cascade → MCP servers → View raw config**, which opens `~/.codeium/windsurf/mcp_config.json`, and add:

```json
{
  "mcpServers": {
    "progressor": {
      "command": "progressor-mcp",
      "args": []
    }
  }
}
```

Windsurf's MCP settings are for every project. If Progressor says it cannot tell which folder is your project, add `"env": { "PROGRESSOR_ROOT": "<your project folder>" }` as in the [Claude Desktop](#claude-desktop-the-chat-app) example.

## Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.progressor]
command = "progressor-mcp"
```

Codex starts Progressor in the folder you run it in, so start Codex in your project.

## Any other app

Progressor is a standard MCP server that talks over stdio. Give your app:

- **command:** `progressor-mcp` (or `npx` with the arguments `-y progressor-mcp`)
- **arguments:** none
- **environment (only if needed):** `PROGRESSOR_ROOT` set to your project folder

## After adding it to an app other than Claude Code

So that your AI reads its instructions in every conversation, add Progressor's note to your project too. In a terminal, in your project folder:

```bash
progressor-mcp init --no-server
```

It adds a short note to `AGENTS.md` (which most AI apps read) and to `CLAUDE.md`, and creates the empty plan. It leaves your app's MCP settings alone. It also adds Claude Code's hooks to `.claude/settings.json`, which other apps simply ignore.

## Windows notes

- If an app can't start `progressor-mcp` or `npx`, use `"command": "cmd"` with `"args": ["/c", "progressor-mcp"]`.
- In JSON files, write folders with double backslashes: `"C:\\Users\\you\\my-app"`.

## Which folder Progressor uses

Progressor keeps the plan in a `.progressor` folder inside your project. To find your project, it looks, in this order, at:

1. `PROGRESSOR_ROOT`, if you set it;
2. the folder your app says is open (most apps tell it);
3. the project folder Claude Code gives it;
4. the folder the app started it in.

It will not start a plan in your home folder, the top of a drive or the Windows folder, since that means the app started it outside your project. If you see that message, open your project's folder in the app, or set `PROGRESSOR_ROOT`. Every `get_status` ends with a `Project folder:` line, so you can check.
