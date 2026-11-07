<h1 align="center">Progressor</h1>

<p align="center"><b>Your AI's plan, saved in your project and shown live, so neither you nor your AI ever loses track of the work.</b></p>

<p align="center">
  <a href="https://www.npmjs.com/package/progressor-mcp"><img src="https://img.shields.io/npm/v/progressor-mcp" alt="npm"></a>
  <a href="https://github.com/racstan/progressor-mcp/actions/workflows/test.yml"><img src="https://github.com/racstan/progressor-mcp/actions/workflows/test.yml/badge.svg" alt="Test"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue" alt="License: PolyForm Noncommercial 1.0.0"></a>
</p>

**The problem:** AI chats forget. When a long chat gets its memory compressed, or you start a new chat, the AI no longer knows what was planned, what's done or what's left, and you end up explaining it all again.

**What Progressor does:** your AI writes its plan, a **goal** with **steps**, into your project folder and keeps it up to date as it works. After a chat is compressed, or in a new chat, even in a different AI app, say *"use Progressor"* and your AI reads that plan and carries on where the work stopped. And you see the same plan on a page in your browser that updates by itself: what the AI is doing right now, what's done, and what it needs from you.

<p align="center">
  <a href="https://youtu.be/7jDyJZvDMag"><img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/youtube-thumbnail.png" alt="Watch the 4-minute video on YouTube" width="640"></a>
  <br>
  <sub><a href="https://youtu.be/7jDyJZvDMag">▶ Watch the 4-minute video on YouTube</a></sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/demo.gif" alt="An AI works through &quot;Shopping list from recipes&quot;: the step it is on is highlighted, steps tick off, a side trip opens and comes back" width="900">
</p>

It works with any app that supports [MCP](https://modelcontextprotocol.io) (the standard way AI apps add tools): Claude Code, Claude Desktop, VS Code with Copilot, Cursor, Windsurf, Codex and others.

<p align="center">
  <a href="https://youtu.be/7jDyJZvDMag"><img src="https://img.shields.io/badge/video-watch_on_YouTube-111111?style=for-the-badge" alt="Watch the video"></a>
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
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/dashboard.png" alt="The Dashboard page: steps done, time worked, goals finished, side trips, and a bar chart of steps finished each day">
      <h3>A Dashboard of the numbers</h3>
      How long steps take against their estimates (and how the estimates are getting better), how often the work drifts, and what got done each day, for each project and for all of them on Home.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/notes.png" alt="Project notes: rules the AI follows, one marked Must, and About this project, each with Edit">
      <h3>Rules your AI keeps</h3>
      <i>"Always ask before adding a dependency."</i> Lasting rules and the project's background live in <b>Project notes</b>. Add, change or remove them there, and your AI is told.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/home.png" alt="Home: a goal that needs you, a goal in progress, the projects and the numbers across all of them">
      <h3>Every project on one page</h3>
      <b>Home</b> shows what needs you and what's being worked on across all your projects, in any app, with the numbers for all of them.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/vibrant.png" alt="The dashboard in the colourful Vibrant theme">
      <h3>Light, dark or colourful</h3>
      <b>Vibrant</b> by default, with black text, or a calm black-and-white look in light or dark. <a href="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/dark.png">See dark</a>.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/calendar.png" alt="The Calendar: steps finished and goals added on each day of the month, and what comes next">
      <h3>A calendar of the work</h3>
      What your AI finished each day, releases and handoffs, and ahead of today, the steps planned next and when each goal should be done.
    </td>
    <td width="50%" valign="top">
      <img src="https://raw.githubusercontent.com/racstan/progressor-mcp/main/docs/media/settings.png" alt="The Settings page: a menu of sections on the left, and the theme, pop-ups and phone notifications">
      <h3>Settings, all optional</h3>
      The look, pop-ups and phone notifications, and how your AI works, grouped on one page. Your AI runs the plan the same whether you ever open it or not.
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
3. If you are Claude Code or Claude Desktop, run `progressor-mcp init --yes` in this folder. Otherwise, add
   the "progressor" MCP server to this app's settings as the guide for this app shows
   (https://github.com/racstan/progressor-mcp/blob/main/docs/apps.md), then run
   `progressor-mcp init --yes --no-server` in this folder.
4. Tell me to restart the app, and to approve the "progressor" server if it asks.
   After the restart, call get_status and tell me in plain words that Progressor is
   ready, with the dashboard link.
```

Your AI does the rest. For Claude Code and Claude Desktop that one `init` command is the whole setup: it adds the server, the hooks that hand your AI the plan at the start of every conversation, and a short note telling the AI to use Progressor. To have Progressor in every project without setting each one up, add it once to your app's settings for all projects ([how, for each app](docs/apps.md)). If you'd rather do it yourself, [Getting started](docs/getting-started.md) walks through it, and [Setup for your app](docs/apps.md) has the exact settings for each app.

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

Open **http://localhost:4747** while your AI's app is open (your AI gives you the link). Everything on it is optional: your AI runs the plan by itself, and the page lets you watch and step in when you want to.

**Where it runs.** Usually the dashboard runs inside your AI's app and stops when the last one closes. If you'd like it up all the time, choose **Always, in the background** under Settings › Advanced, or run `progressor-mcp daemon install`: a small process starts when you log in and keeps the dashboard up with no AI app open (it uses about 30 MB of memory). Your AI's sessions share it, and `progressor-mcp daemon uninstall` puts things back. Both ways work the same; neither is needed.

**Finding your way**

- **Home** shows every project at once: what needs you, what's being worked on, and the numbers across all of them.
- **Breadcrumbs** at the top of every page say where you are, such as *Home › Bindery › Dashboard*; click Home or the project to go back.
- **Search** in the top bar (press `/`) finds projects, goals and steps across all your projects as you type.
- **Settings** has its own page, from the gear at the top or the sidebar, grouped into Look, Notifications, AI & plan, History & releases and Advanced, with a menu that folds away. Nothing there is required: Progressor works fully with the defaults.
- **A short tour** the first time you open the dashboard: a welcome that says Progressor is free (anyone selling it is not us), then the main parts of the page. Close it with Skip or ×, tick Don't show again, or take it again from ❓ Help or Settings › Look, where **Show the tour when the page opens** turns it on or off. If you're updating from an earlier Progressor, you get What's new instead.
- **Light, Dark, System or Vibrant.** Vibrant, the colourful one with black text, is the default; Light, Dark and System keep to black, white and greys.

**Each goal**

- **What the AI is doing:** *AI working*, *Waiting on you*, or *AI stopped* when its chat has closed, with how far along each goal is. What it's working on right now is highlighted and gently moves.
- **Every step, as a list or a map,** with side trips (where the AI stepped off the plan, and why), decisions and notes. Each says when it was added, by whom, and when it changed.
- **Commits and tests on each step:** a finished step shows the commits made for it and the test run behind it, linked when your project is on GitHub, GitLab or Gitea.
- **How long it will take:** your AI estimates each step and each goal shows a rough finish, *done in about 2 h*. The estimates learn: Progressor compares how long steps really took with the guesses and corrects the finish times.
- **Goals that wait on other goals** say *Waits on …*, even on a goal in another project, and their finish starts after that one's.
- **Needs you:** a question, a step to check or something to try by hand waits in one place, and you answer with a click. **Ways to go** shows 2 to 4 options as cards, with your AI's pick marked; if you don't choose, it goes ahead with its pick, and you can still change course later.
- **Talk to your AI** about one goal, or the whole project from **Message your AI**. Its replies show under your messages, and a number counts the ones you haven't read.
- **Pictures:** your AI can attach a screenshot or recording to a goal or step, so you see the change instead of reading about it.
- **Copy for your AI** and **Show in folder** on every goal and step.

**Each project's pages, in the sidebar** (under the project's name, Dashboard first; each page's heading names its project, such as *Bindery Dashboard*)

- **Hotfixes:** paste a bug report, such as one from a customer, and it goes to the top of your goals. Every AI chat in the project is told; the one that takes it finishes the step it is on, writes a test that shows the bug, then fixes it. You can also just tell your AI: *"Hotfix: checkout fails when the cart has a coupon."*
- **Project notes:** the rules your AI keeps and the project's background, which you can edit, and **Goals that come back**: goals your AI set to repeat, such as a weekly dependency check, which you can pause or stop.
- **Wishlist:** what you want from the project as a whole, in your own words, with files or pictures attached if you like. Your AI reads it and may suggest goals from it, but only you change it.
- **Dashboard:** the numbers worked out from the plan, with every goal in a list you can sort (newest, longest, most over its estimate…) (called Statistics before 1.3.0), with the **Plan check-up** card: what your AI's last look over the plan fixed, and **Check now**.
- **Calendar:** the project by month, week, day or as a list: what your AI finished, releases, hotfixes and handoffs, and ahead of today, the steps planned next and when each goal should be done.
- **History:** every change to the plan, by your AI or by you, with what it changed. **Go back to before this** undoes a change and everything after it, and going back can itself be undone.
- **Handoffs:** write-ups of a stretch of work for whoever picks it up next. Your AI writes one after each release, or when you ask for one between two dates.

**Staying in touch**

- **Phone notifications** through the free [ntfy](https://ntfy.sh) app: a push when your AI asks a question, has something for you to try, finishes a goal, offers ways to go, or a bug report comes in. Turn it on in Settings, then copy the private address Progressor made into the app with one click, or use your own ntfy server.
- **A desktop pop-up when a goal is finished,** from any of your projects, if you turn it on in Settings.
- **Never out of date:** if Progressor was updated, or the page lost touch with it, a bar says so with a **Refresh** button. **What's new** opens by itself the first time after Progressor is updated, with what changed (tick Don't show again to stop that), and is always in ❓ Help.

More in the [dashboard guide](docs/dashboard.md).

## What your AI does by itself

You never have to ask for these, and each one has a section in Settings if you want to change how it works:

- **Keeps the plan tidy.** At the start of each conversation it gives the plan a check-up, repairs what is safe to repair, and lists the rest.
- **Records the work.** Each finished step is linked to its commits, branch and test run, and your AI is warned when a step's files are not saved in git yet.
- **Learns from its estimates.** It sees how far off its guesses have been, so its next ones are better.
- **Writes the changelog.** When it's time for a new version, a release goal gathers the finished goals and commits since the last release, and your AI writes the changelog entry and the new version number from them. It asks you before tagging or publishing anything.
- **Brings routine work back.** A goal can come back every day, week, two weeks, month or on a weekday; a fresh one is added when it's due, never while the last one is still open.
- **Hands over.** It writes a handoff after each release, and whenever you ask.
- **Works across projects.** When a chat in one project does work for another, it records it in that project's plan, tagged *Updated from*.

More in [Using Progressor](docs/using.md#what-your-ai-does-by-itself).

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

Progressor is free for personal and other noncommercial use. If it helps you, you can [buy me a coffee](https://buymeacoffee.com/rachitasthana); the link is also on the dashboard's Settings page, under About.

## License

Copyright (C) 2026 Rachit Asthana

Progressor is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You may use, change and share it for noncommercial purposes as that license defines them: personal use with no commercial application (study, research, hobby projects and the like) and use by charities, schools, public research bodies and government institutions. Any other use, including use by a business, needs a separate license from the author. See [LICENSE.md](LICENSE.md) for the full terms. Versions up to 1.2.2 were released under GPL-3.0-or-later, and copies of those versions keep that license.
