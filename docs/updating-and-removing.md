# Updating and removing

## Updating

```bash
npm install -g progressor-mcp@latest
```

Then restart your AI app. Chats that were already open keep running the old version until they restart; the dashboard tells you if one of them is serving the page.

> **Ask your AI:** *"Update Progressor with `npm install -g progressor-mcp@latest`, then tell me to restart the app."*

If you set Progressor up with `npx` instead of installing it, it updates itself the next time the app starts it.

Running `progressor-mcp init` again in a project changes nothing unless something is missing or out of date, so it's safe to run after an update.

## Removing Progressor from a project

In a terminal, in the project's folder:

```bash
progressor-mcp init --remove
```

It shows what it will take out and asks once: the server in `.mcp.json`, the hooks in `.claude/settings.json`, and the Progressor notes in `CLAUDE.md` and `AGENTS.md`. Everything else in those files stays. Your plan in `.progressor/` stays too; delete that folder yourself if you don't want it.

If you added Progressor to an app's MCP settings by hand, remove the `progressor` entry there as well (see [Setup for your app](apps.md) for where each app keeps them). For Claude Code's every-project setup: `claude mcp remove --scope user progressor`.

> **Ask your AI:** *"Remove Progressor from this project with `progressor-mcp init --remove --yes`, and from this app's MCP settings."*

## Removing it from your computer

```bash
npm uninstall -g progressor-mcp
```

Progressor also keeps a short list of your projects for the dashboard in a `.progressor` folder in your home folder (`~/.progressor/`). You can delete it.

## Working with others

Each person needs Progressor installed once (`npm install -g progressor-mcp`). The commands `init` writes suit the computer it ran on: on Windows the server is started through `cmd /c`. If you commit `.mcp.json` and teammates use another system, each of them runs `progressor-mcp init` once in their copy.
