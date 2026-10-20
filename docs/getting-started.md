# Getting started

This page takes you from nothing to watching your AI work, in about five minutes. You don't need to know how to code.

## 1. Install Node.js

Progressor runs on Node.js. To check whether you have it, open a terminal (on Windows: **Terminal** or **PowerShell** from the Start menu; on macOS: **Terminal**) and type:

```bash
node --version
```

If it prints `v22` or a higher number, you're set. If it prints an older version or an error, install the **LTS** version from [nodejs.org](https://nodejs.org), then close and reopen the terminal.

> **Ask your AI:** *"Check whether Node.js 22 or later is installed, and if not, tell me how to install it on my computer."*

## 2. Let your AI set Progressor up

Open your project in your AI app, and paste this into the chat:

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

Your AI may ask your permission to run each command: say yes. If your AI can't run commands or change settings, follow [Setup for your app](apps.md) yourself instead; it takes a minute.

## 3. Restart the app

Close your AI app and open it again in the same project. If it asks whether to allow or trust a server called `progressor`, allow it. Then ask:

> *"Is Progressor working?"*

Your AI calls Progressor and tells you it's ready, with a link to the dashboard.

## 4. Open the dashboard

Open the link your AI gave you, usually **http://localhost:4747**. Keep it beside your AI's window, or in a browser tab. It's empty for now: it fills in as soon as your AI plans something.

## 5. Ask for something

Tell your AI what you want, in your own words:

> *"Add a contact form to the home page that emails me the message."*

Your AI looks at your project, plans the work as a **goal** with a few **steps**, shows you the plan, and starts. On the dashboard you'll see the goal appear, the steps tick off one by one, and a line saying what the AI is doing right now.

That's it. From here, just keep talking to your AI as you normally would. [Using Progressor](using.md) explains what you'll see along the way, and [the dashboard guide](dashboard.md) explains everything on the page.

## If something didn't work

See [Troubleshooting](troubleshooting.md): each problem there has a line you can paste to your AI to fix it.
