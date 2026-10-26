# Progressor

[![npm](https://img.shields.io/npm/v/progressor-mcp)](https://www.npmjs.com/package/progressor-mcp) [![Test](https://github.com/racstan/progressor-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/racstan/progressor-mcp/actions/workflows/test.yml) [![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

<p align="center">

[![Progressor MCP server](https://mcprush.com/badge/progressor-mcp/card.svg)](https://mcprush.com/to/progressor-mcp?ref=badge)

</p>

**See what your AI is building, step by step, in a page that updates by itself.**

![An AI works through "Ship OAuth login": steps tick off, a side trip branches off and rejoins the plan, another changes the plan, and the goal finishes, all live on the dashboard](docs/media/demo.gif)

You tell your AI coding assistant what you want. Progressor makes it plan the work as a **goal** with **steps**, keep that plan up to date as it works, and say so when it has to step off the plan. You watch it all on a dashboard in your browser: what the AI is doing now, how far along it is, and whether it has stopped. The AI manages everything; you don't have to.

It works with any app that supports [MCP](https://modelcontextprotocol.io) (the standard way AI apps add tools): Claude Code, Claude Desktop, VS Code with Copilot, Cursor, Windsurf, Codex and others.

## Your progress is never lost

AI chats forget. A long chat gets its memory compressed, a new chat starts from nothing, and switching to another app or AI tool usually means explaining your project all over again. With Progressor, none of that costs you your progress:

- **Everything is saved in your project.** The goals, every step and where each one stands, the side trips and why they happened, the decisions made along the way, notes, your rules, and the project's **Important context** (what the project is and the key facts about it) are kept in plain files in your project folder, not in the chat.
- **New chats pick up where the last one stopped.** Every new chat, and every chat after its memory is compressed, starts by reading the plan. You don't explain anything from scratch: just say *"carry on"*.
- **Switch apps or AI tools freely.** The plan belongs to the project, not to the app. Start in Claude Code, carry on in Cursor or VS Code, and the next AI sees exactly where things stand.
- **Clear to you and to the AI.** You see the same plan on the dashboard that the AI reads, so you always know what's done, what's under way, and what's waiting on you.

## Set it up

You need [Node.js](https://nodejs.org) 22 or later. Then paste this into your AI's chat, in the project you're working on:

```text
Set up Progressor (https://github.com/racstan/progressor-mcp) for this project:
1. Run `node --version`. If it is older than 22, stop and tell me how to install Node.
2. Run `npm install -g progressor-mcp`.
3. If you are Claude Code, run `progressor-mcp init --yes` in this folder. Otherwise, add
   the "progressor" MCP server to this app's settings as the guide for this app shows
   (https://github.com/racstan/progressor-mcp/blob/main/docs/apps.md), then run
   `progressor-mcp init --yes --no-server` in this folder.
4. Tell me to restart the app, and to approve the "progressor" server if it asks.
   After the restart, call get_status and tell me in plain words that Progressor is
   ready, with the dashboard link.
```

Your AI does the rest. To have Progressor in every project without setting each one up, add it once to your app's settings for all projects ([how, for each app](docs/apps.md)). If you'd rather do it yourself, [Getting started](docs/getting-started.md) walks through it, and [Setup for your app](docs/apps.md) has the exact settings for each app.

## Then just talk to your AI

Tell it what you want to build, as you would anyway: *"Add a login page with Google sign-in."* It plans the work as a goal, shows you the steps, and starts. You don't need to learn any commands. If you ever want to nudge it, these work in most apps' `/` menu:

- **/progressor:next**: carry on where the work was left
- **/progressor:status**: where things stand, in a few lines
- **/progressor:plan**: plan something new together

## Watch it work

Open **http://localhost:4747** while your AI's app is open (your AI gives you the link). You'll see:

- **What the AI is doing**: *AI working · step 3 of 7 · last update 2 min ago*, or *AI stopped* when its chat has closed.
- **The plan as a map**: each step is a stop on a line, ticked off as it's done. When the AI steps off the plan to deal with something, a **side trip** branches off, with the reason.
- **Your goals**: everything planned for the project, with how far along each one is.
- **What's waiting on you**: when the AI needs you, say to try something by hand, the goal turns amber and says *Waiting on you*. Steps handed to helper agents, checked or released show as such, and each goal lists the decisions made along the way.

**One dashboard for all your projects.** You don't need a Progressor per project to see them all. As long as one AI chat is running Progressor, in any project and any app, the same page shows every project you've used it in. Switch between them at the top of the sidebar, or pick **🗂 All projects** to see them side by side. Each project's plan stays in its own folder, so chats in different projects, even in different apps, never get in each other's way.

The page only shows; you change the plan by talking to your AI. More in the [dashboard guide](docs/dashboard.md).

## If something goes wrong

Most problems can be fixed by asking your AI. [Troubleshooting](docs/troubleshooting.md) lists the common ones, each with a line you can paste to your AI. Still stuck? [Report a problem](https://github.com/racstan/progressor-mcp/issues/new?template=bug_report.yml), or use **❓ Help** on the dashboard, which fills in your version and system for you.

## Docs

- [Getting started](docs/getting-started.md): setting up, step by step
- [Setup for your app](docs/apps.md): Claude Code, Claude Desktop, VS Code, Cursor, Windsurf, Codex and others
- [Using Progressor](docs/using.md): goals, steps, side trips, and what to say to your AI
- [The dashboard](docs/dashboard.md): everything on the page
- [Questions](docs/faq.md) and [Troubleshooting](docs/troubleshooting.md)
- [Updating and removing](docs/updating-and-removing.md)
- [Reference](docs/reference.md): commands, the AI's tools, settings and the file format, for the technically curious
- [Contributing](CONTRIBUTING.md): working on Progressor itself

## Feedback

Progressor is young, and what you run into shapes what comes next. [Share an idea or feedback](https://github.com/racstan/progressor-mcp/issues/new?template=idea.yml), even a sentence helps, or [see the open issues](https://github.com/racstan/progressor-mcp/issues).

## Support

Progressor is free and open source. If it helps you, you can [buy me a coffee](https://buymeacoffee.com/rachitasthana); the link is also in the dashboard's ⚙️ Settings.

## License

Copyright (C) 2026 Rachit Asthana

Progressor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
