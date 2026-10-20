# Progressor

[![npm](https://img.shields.io/npm/v/progressor-mcp)](https://www.npmjs.com/package/progressor-mcp) [![Test](https://github.com/racstan/progressor-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/racstan/progressor-mcp/actions/workflows/test.yml) [![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

![An Agent works through "Ship OAuth login": Tasks tick off, a Detour branches off and merges back, a second Detour recalibrates the plan, and the Goal finishes, all live on the dashboard](docs/media/demo.gif)

<sub>This is the dashboard, a page in your browser that you keep open beside your editor or terminal. You keep chatting with your Agent as usual, and the page follows along by itself as it works through a Goal: Tasks tick off, a Detour is merged back, another one recalibrates the plan, and a stop is opened to copy it as a prompt. [Watch as video](docs/media/demo.mp4).</sub>

Progressor keeps an AI coding Agent and you, the Developer, focused on the same Goal across long sessions, context compression and distractions. It is an [MCP](https://modelcontextprotocol.io) server: your Agent's app starts it, and the Agent uses its tools to keep a live record of what is planned, what is done, and what came up along the way. You work in your Agent's chat as before; the dashboard is optional, for when you want to see the whole plan at a glance.

The record is plain markdown inside your project, in `.progressor/`, so it is readable, diffable and travels with the repo. See [GLOSSARY.md](GLOSSARY.md) for the words used here and [docs/markdown-format.md](docs/markdown-format.md) for the file format.

## For AI agents

The quickest setup: paste this into your Agent's chat in the project folder, and it installs Progressor and checks it for you.

```text
Set up Progressor (https://github.com/racstan/progressor-mcp) in this project:
1. Run `node --version`. Progressor needs Node 22 or later; if it is older, stop and tell me.
2. Run `npm install -g progressor-mcp`, then `progressor-mcp --version` to check it installed.
3. In this project folder, run `progressor-mcp init --yes`.
   If you are not Claude Code, skip init: instead add an MCP server named "progressor"
   to this app's MCP config that runs `npx -y progressor-mcp` over stdio in this folder.
4. Tell me to restart this app and approve the "progressor" server if it asks. After the
   restart, call the progressor `get_status` tool and show me what it says.
```

If you are an AI agent reading this to set Progressor up, follow the same steps, and see [Troubleshooting](#troubleshooting) if one fails. Once it is connected, call `get_status` at the start of every conversation, and follow the instructions the server sends with its tools.

## Install

You need Node 22 or later (`node --version`). Then, in your project folder:

```bash
npm install -g progressor-mcp
```

```bash
progressor-mcp init
```

`init` shows what it will add and asks once: the `progressor` server in `.mcp.json`, two [Claude Code hooks](docs/setup.md#claude-code-hooks-recommended) that hand the Agent the plan at the start of every conversation, a short note in `CLAUDE.md`, and an empty Roadmap in `.progressor/`.

Restart Claude Code in that folder and approve the `progressor` server when it asks. Type `/progressor` to see its commands in the `/` menu: pick **progressor:status** to check it works, then **progressor:plan** followed by what you want to build, such as `add Google sign-in`.

Its other commands include **progressor:next** to pick up where you left off and **progressor:idea** to park an idea for later; the [reference](docs/reference.md#slash-commands) lists them all.

To have Progressor in every project instead of running `init` in each, [register it once for your user](docs/setup.md#use-progressor-in-every-project) and type **/progressor:setup** in any folder. Another MCP app, updating, removing and setting the hooks by hand: see [docs/setup.md](docs/setup.md).

## How it works

- **Goals** sit on a Roadmap, and each Goal has a list of **Tasks**, each with its files and a one-line summary.
- Each conversation **claims** one Goal and keeps its Tasks up to date as it works. After the context is compressed, `get_status` puts the plan back in front of the Agent.
- When the Agent has to do something off the plan, it declares a **Detour** with a reason instead of drifting silently. It then merges back, returns, or recalibrates the plan.
- Ideas for later are parked as **Ideas**. Lasting rules you give the Agent ("ask me before recalibrating") are saved as **Standing Instructions** and survive new conversations.

You steer by talking to the Agent. The [glossary](GLOSSARY.md) explains the words, and [the file format](docs/markdown-format.md) shows the markdown.

## The dashboard

While your Agent is running Progressor, open **http://localhost:4747/**, or run `progressor-mcp dashboard` to open it on its own. It shows every project you use Progressor in, each Goal as a metro map or a checklist, and updates by itself as the Agent works. Click any Task for its details and **Copy as prompt**. The **❓ Help** menu has links to report a problem or share an idea.

In VS Code you can keep it beside your code with **Simple Browser: Show** from the Command Palette. The full guide is in [docs/dashboard.md](docs/dashboard.md).

## Troubleshooting

**`progressor` is missing from `/mcp`, or shows as failed.** Restart Claude Code in the project folder, and approve the server when it asks. Check that `.mcp.json` in the folder lists `progressor`; if not, run `progressor-mcp init` again. Then run `node --version` (22 or later is needed) and `progressor-mcp --version` in a terminal: an error from either is the cause.

**`progressor-mcp: command not found`.** npm's global folder is not on your `PATH`. `npm prefix -g` prints that folder (its `bin` folder on macOS and Linux); add it to `PATH` and open a new terminal. Or skip the global install and use `npx -y progressor-mcp` instead.

**The dashboard does not open.** It runs only while an Agent app is running Progressor, or while `progressor-mcp dashboard` runs. If port 4747 was taken, it is on the next free port: the `Dashboard:` line at the end of `get_status` has the right address. Check that `PROGRESSOR_DASHBOARD` is not set to `off`.

**The dashboard says it is served by an older Progressor.** A conversation started before you updated is still running the old version. Restart it, or stop that server in **🖥 Servers**.

**The Agent does not follow the plan, or never calls `get_status`.** Check that `CLAUDE.md` has the Progressor note and `.claude/settings.json` has the two [hooks](docs/setup.md#claude-code-hooks-recommended); `progressor-mcp init` adds anything missing. The hooks need the global install. The **/progressor:status** command shows the Agent the plan straight away.

Still stuck? [Report a problem](#feedback-and-help).

## Feedback and help

Progressor is young, and what you run into shapes what comes next.

- **Something not working?** [Report a problem](https://github.com/racstan/progressor-mcp/issues/new?template=bug_report.yml). The form asks for your version (`progressor-mcp --version`), system and steps.
- **An idea, or feedback of any kind?** [Share it](https://github.com/racstan/progressor-mcp/issues/new?template=idea.yml), even a sentence helps.
- **From the dashboard**, the **❓ Help** menu has both links, with your version and system already filled in.

Before opening one, have a look at the [open issues](https://github.com/racstan/progressor-mcp/issues): someone may have hit it already.

## More

- [Setup details](docs/setup.md): other MCP apps, updating, removing, the hooks by hand
- [Dashboard guide](docs/dashboard.md): views, search, settings, editors, Workspaces
- [Reference](docs/reference.md): slash commands, every tool, an example Plan File
- [Contributing](CONTRIBUTING.md): developing and releasing Progressor

## Support

Progressor is free and open source. If it keeps you on track, you can [buy me a coffee](https://buymeacoffee.com/rachitasthana). The link is also at the bottom of the dashboard's ⚙️ Settings.

## License

Copyright (C) 2026 Rachit Asthana

Progressor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
