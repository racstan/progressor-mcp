<h1 align="center">Progressor</h1>

<p align="center"><b>Your AI's plan, saved in your project and shown live, so neither you nor your AI ever loses track of the work.</b></p>

<p align="center">
  <a href="https://www.npmjs.com/package/progressor-mcp"><img src="https://img.shields.io/npm/v/progressor-mcp" alt="npm"></a>
  <a href="https://github.com/racstan/progressor-mcp/actions/workflows/test.yml"><img src="https://github.com/racstan/progressor-mcp/actions/workflows/test.yml/badge.svg" alt="Test"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-blue" alt="License: GPL v3"></a>
</p>

**The problem:** AI chats forget. When a long chat gets its memory compressed, or you start a new chat, the AI no longer knows what was planned, what's done or what's left, and you end up explaining it all again.

**What Progressor does:** your AI writes its plan, a **goal** with **steps**, into your project folder and keeps it up to date as it works. After a chat is compressed, or in a new chat, even in a different AI app, say *"use Progressor"* and your AI reads that plan and carries on where the work stopped. And you see the same plan on a page in your browser that updates by itself: what the AI is doing right now, what's done, and what it needs from you.

<p align="center">
  <a href="YOUTUBE_URL"><img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/youtube-thumbnail.png" alt="Watch the 4-minute video on YouTube" width="640"></a>
  <br>
  <sub><a href="YOUTUBE_URL">▶ Watch the 4-minute video on YouTube</a></sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/demo.gif" alt="An AI works through &quot;Shopping list from recipes&quot;: the step it is on is highlighted, steps tick off, a side trip opens and comes back" width="900">
</p>

It works with any app that supports [MCP](https://modelcontextprotocol.io) (the standard way AI apps add tools): Claude Code, Claude Desktop, VS Code with Copilot, Cursor, Windsurf, Codex and others.

<p align="center">
  <a href="YOUTUBE_URL"><img src="https://img.shields.io/badge/video-watch_on_YouTube-111111?style=for-the-badge" alt="Watch the video"></a>
  &nbsp;
  <a href="#set-it-up"><img src="https://img.shields.io/badge/set_it_up-2_minutes-111111?style=for-the-badge" alt="Set it up"></a>
</p>

## What you get

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/goal.png" alt="A goal's steps: three done with their times, the current one highlighted, a side trip under the step it left from">
      <h3>Every step, live</h3>
      What the AI is working on is highlighted and moves; finished steps say when they were done. A <b>side trip</b> shows where the AI stepped off the plan, and why.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/map.png" alt="The plan drawn as a map: stops ticked off along a line, a side trip branching off and a new step joining from it">
      <h3>The plan as a map</h3>
      Each step is a stop on a line. Side trips branch off and rejoin, and steps they add join the route, so you can see how the plan changed.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/needs-you.png" alt="A Needs you box: a step waiting on you, and something to try by hand with Works and Doesn't work buttons">
      <h3>It says when it needs you</h3>
      A question, a step to check, something to try on your phone: it all waits in <b>Needs you</b>, and you answer with a click. Your AI sees your answer at its next step.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/conversation.png" alt="A goal's Conversation: the AI's question and your answer, your message and the AI's reply">
      <h3>Talk to your AI from the page</h3>
      Write to your AI about one goal or the whole project, and its replies show up under your messages. What you write stays on your computer, out of git.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/statistics.png" alt="Statistics: steps done, time worked, goals finished, side trips, and a bar chart of steps finished each day">
      <h3>Statistics</h3>
      How long steps take against their estimates, how often the work drifts, and what got done each day, for each project and for all of them on Home.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/notes.png" alt="Project notes: rules the AI follows, one marked Must, and About this project, each with Edit">
      <h3>Rules your AI keeps</h3>
      <i>"Always ask before adding a dependency."</i> Lasting rules and the project's background live in <b>Project notes</b>. Add, change or remove them there, and your AI is told.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/home.png" alt="Home: a goal that needs you, a goal in progress, the projects and statistics across all of them">
      <h3>Every project on one page</h3>
      <b>Home</b> shows what needs you and what's being worked on across all your projects, in any app, with statistics for all of them.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/vibrant.png" alt="The dashboard in the colourful Vibrant theme">
      <h3>Light, dark or colourful</h3>
      A calm black-and-white look in light or dark, or <b>Vibrant</b> if you like colour. <a href="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/dark.png">See dark</a>.
    </td>
  </tr>
</table>

## Your progress is never lost

AI chats forget. A long chat gets its memory compressed, a new chat starts from nothing, and switching to another app or AI tool usually means explaining your project all over again. With Progressor, none of that costs you your progress:

- **Everything is saved in your project.** The goals, every step and where each one stands, the side trips and why they happened, the decisions made along the way, notes, your rules and the project's background are kept in plain files in your project folder, not in the chat.
- **New chats pick up where the last one stopped.** After a chat's memory is compressed, or in a new chat, say *"use Progressor"* (or *"carry on"*) and your AI reads the plan. Claude Code does this by itself.
- **Switch apps or AI tools freely.** The plan belongs to the project, not to the app. Start in Claude Code, carry on in Cursor or VS Code, and the next AI sees exactly where things stand.
- **Private, and yours.** The plan is plain markdown files on your computer: nothing is sent anywhere, and it's kept out of git unless you ask your AI to share it ([how](docs/faq.md#is-my-plan-private-should-i-commit-the-progressor-folder)). You can read every file, and delete them whenever you like.
- **The same plan for you and the AI.** What you see on the dashboard is what the AI reads, so you always know what's done, what's under way and what's waiting on you.

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

Tell it what you want to build, as you would anyway: *"Add a login page with Google sign-in."* It plans the work as a goal, shows you the steps, and starts. You don't need to learn any commands. If you want to nudge it, these work in most apps' `/` menu:

| Command | What it does |
| --- | --- |
| `/progressor:next` | Carry on where the work was left |
| `/progressor:status` | Where things stand, in a few lines |
| `/progressor:plan` | Plan something new together |
| `/progressor:dashboard` | The dashboard's link |
| `/progressor:review` | Check a goal against what finished looks like, and add steps if something is missing |
| `/progressor:setup` | Set Progressor up in this project |

## On the dashboard

Open **http://localhost:4747** while your AI's app is open (your AI gives you the link).

- **What the AI is doing:** *AI working*, *Waiting on you*, or *AI stopped* when its chat has closed, with how far along each goal is.
- **When things happen:** every goal, step, decision and note says when it was added, by whom, and when it changed. Steps say when they started and finished.
- **How long it will take:** your AI estimates each step, and each goal shows a rough finish: *done in about 2 h*. Tell it *"at most 2 helpers at a time"* and it keeps to that.
- **Pictures:** your AI can attach a screenshot or screen recording to a goal or step, so you see the change instead of reading about it.
- **Copy for your AI** and **Show in folder** on every goal and step, to point your AI at it or open the plan file.
- **Work for one project, recorded in another:** when a chat in one project does work for another, it can record it in that project's plan, tagged *Updated from*.
- **Never out of date:** if Progressor was updated, or the page lost touch with it, a bar says so with a **Refresh** button.

More in the [dashboard guide](docs/dashboard.md).

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

What you run into shapes what comes next. [Share an idea or feedback](https://github.com/racstan/progressor-mcp/issues/new?template=idea.yml), even a sentence helps, or [see the open issues](https://github.com/racstan/progressor-mcp/issues).

<p align="center">
  <a href="https://mcprush.com/to/progressor-mcp?ref=badge"><img src="https://mcprush.com/badge/progressor-mcp/card.svg" alt="Progressor MCP server"></a>
</p>

## Support

Progressor is free and open source. If it helps you, you can [buy me a coffee](https://buymeacoffee.com/rachitasthana); the link is also in the dashboard's ⚙️ Settings.

## License

Copyright (C) 2026 Rachit Asthana

Progressor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
