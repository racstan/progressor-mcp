# Troubleshooting

Each problem below says what's going on and how to fix it, with a line you can paste to your AI so it fixes it for you. If your AI can't reach Progressor at all, it can still run commands and read this page.

## My AI doesn't seem to have Progressor

It never mentions the plan, or says it has no Progressor tools.

1. Restart your AI app in your project's folder, and allow the `progressor` server if the app asks.
2. Check the app's list of MCP servers (in Claude Code, type `/mcp`; elsewhere, look in the app's MCP settings): `progressor` should be there and connected.
3. If it's missing, it wasn't added for this project or app: see [Setup for your app](apps.md).

> **Ask your AI:** *"Check that the Progressor MCP server is set up for this project in this app, following https://github.com/racstan/progressor-mcp/blob/main/docs/apps.md, and fix what's missing."*

## The server shows as failed, or won't start

Usually Node is too old, or the app can't find the `progressor-mcp` command.

> **Ask your AI:** *"Run `node --version` and `progressor-mcp --version` and tell me what they print. Node must be 22 or later; if `progressor-mcp` isn't found, install it with `npm install -g progressor-mcp`."*

- **Node older than 22:** install the LTS version from [nodejs.org](https://nodejs.org), then restart the app.
- **`progressor-mcp: command not found`:** npm's install folder isn't on your computer's search path. `npm prefix -g` prints that folder (on macOS and Linux, its `bin` folder); add it to your `PATH` and restart. Or, in the app's MCP settings, use `npx` with the arguments `-y progressor-mcp` instead, which needs no install.
- **On Windows**, some apps need the command wrapped: `"command": "cmd"`, `"args": ["/c", "progressor-mcp"]`. In Claude Code, run `progressor-mcp init` in the project folder, which does this for you.
- **On a Mac or Linux, with the error `Executable not found in $PATH: cmd`:** the project was set up on Windows with an older Progressor, which put the Windows-only `cmd /c` in `.mcp.json`. Run `progressor-mcp init` in the project folder to replace it, then restart the app.

## "Progressor will not start a plan in …"

Progressor was started outside your project, in your home folder, the top of a drive or the Windows folder, and refuses to put a plan there. This happens with apps whose MCP settings are for every project.

Open your project's folder in the app, or set `PROGRESSOR_ROOT` to your project's folder in the app's MCP settings (see [Claude Desktop](apps.md#claude-desktop-the-chat-app) for an example).

> **Ask your AI:** *"Progressor says it won't start a plan in this folder. Set PROGRESSOR_ROOT for the progressor server in this app's MCP settings to this project's folder, then tell me to restart the app."*

## "… could not be read as a Progressor plan"

One of the plan's files, usually `.progressor/roadmap.md` (your goals) or a goal's file in `.progressor/goals/`, has text in it that Progressor can't make sense of. This happens when it is pasted over or edited by hand. Progressor stops instead of treating it as empty, so that nothing is lost, and it does not change the file.

If the project uses git, restore the file with the command in the message, for example `git checkout -- .progressor/roadmap.md`, or fix the text yourself (a roadmap needs a `## Goals` section, a goal's file a `## Tasks` section). Then ask your AI to try again.

> **Ask your AI:** *"Progressor says a plan file could not be read. Look at that file, tell me what's wrong with it, and don't change it until I say so."*

## The plan is in the wrong folder

Every `get_status` ends with a `Project folder:` line. If it isn't your project, see the previous answer: open the project's folder in the app, or set `PROGRESSOR_ROOT`.

> **Ask your AI:** *"Call get_status and tell me which project folder Progressor is using."*

## My AI ignores the plan, or forgets it

- Check that your project's `AGENTS.md` (or `CLAUDE.md` for Claude Code) has a short *Progressor* section. `progressor-mcp init` adds it; in apps other than Claude Code use `progressor-mcp init --no-server`.
- In Claude Code, the hooks in `.claude/settings.json` hand the AI the plan at the start of every conversation and after its memory is summarised. `progressor-mcp init` adds them; they need Progressor installed with `npm install -g`.
- Anytime, **/progressor:status** puts the plan in front of your AI straight away.

> **Ask your AI:** *"Run `progressor-mcp init --yes` (or `--yes --no-server` if you are not Claude Code) in this project, then call get_status and follow the plan."*

## The dashboard doesn't open

- It runs while an AI app is running Progressor. Open your AI app first.
- The address may not be 4747 if that port was taken. The `Dashboard:` line at the end of `get_status` has the right one.
- Check that `PROGRESSOR_DASHBOARD` isn't set to `off` in the app's MCP settings.

> **Ask your AI:** *"Give me Progressor's dashboard link."* (or **/progressor:dashboard**)

## The dashboard is at 4748 instead of 4747

Something else was using 4747 when your chat started. Most often it's a chat that started before you updated Progressor and still runs the old version, which the new one can't share the dashboard with. Your AI's dashboard link then says so.

Close the chats that started before the update (or stop the old server under **⚙️ Settings → Advanced** on the dashboard). Within a few seconds the dashboard moves back to 4747 by itself; reload the page at the usual address. From this version on, a newer Progressor asks the old one to hand the dashboard over, so this won't happen at the next update.

## A goal still shows as worked on after its chat closed

When a chat closes, Progressor lets go of the goals it was working on. If the app or computer stopped it too suddenly to do that, the goal shows *AI stopped* on the dashboard. The next time any chat in the project looks at the plan, the goal is set back to paused, and any chat can carry on with it. Goals that another open chat is working on are never touched.

## The dashboard says "Reconnecting…" or "Can't reach Progressor"

Progressor has closed, most likely because the AI app or its chat closed. Open the app again; the page reconnects by itself.

## The dashboard says it's served by an older Progressor

A chat started before you updated is still running the old version. Close that chat, or stop the old server under **⚙️ Settings → Advanced** on the dashboard.

## It says "AI waiting" but I think it's working

*AI waiting* means the AI's chat is open, no step is with a helper, and the plan hasn't changed in 15 minutes. (While helpers work, it says *Helpers working* instead.) Long steps can take that long. Check the chat: if the AI is asking you something, answer it; if it's still busy, there's nothing to do.

## "A command takes file @-mentions but no other @-mentions, slash commands, links, or inline formatting"

Claude's app only allows plain words after a command. Send the command on its own, such as **/progressor:plan**, and your AI asks you in the chat, where links, code and pasted text are fine.

## "No project called …" or "… has no Progressor plan"

Your AI tried to record work in another project's plan and named it in a way Progressor doesn't know. It takes the project's name or ID as the dashboard's project list shows them, or the full path of its folder, and only a project that already uses Progressor: a plan is never started in a folder from outside. Paste this to your AI:

> Look at the projects on the Progressor dashboard and use that project's exact name, or the full path of its folder.

If the project doesn't use Progressor yet, open it in your AI app with Progressor first.

## "Goal … is being worked on by an AI chat in that project"

An AI chat in the other project is working on that goal, so it can't be changed from outside. Your AI can still add a note to it, or you can ask that chat to make the change.

## "The plan in … is busy"

Another Progressor was changing the same plan for more than a few seconds. Ask your AI to try again. If it keeps happening, a Progressor may be stuck: stop it under **⚙️ Settings → Advanced** on the dashboard.

## Still stuck?

[Report a problem](https://github.com/racstan/progressor-mcp/issues/new?template=bug_report.yml), or use **❓ Help → Report a problem** on the dashboard, which fills in your version and system. Include what you did, what you expected and what happened.
