# Keeping your plans the same on every computer

If you work on the same projects from more than one computer (say a Windows desktop and a Linux laptop), Progressor can keep every project's plan in one **private GitHub repository** of yours, so each computer shows the same goals and steps.

It is **off until you turn it on**, and nothing else changes when it is off.

## Turn it on

Ask your AI:

> Turn on plan sync for this computer.

It runs one command:

```
npx progressor-mcp sync connect
```

That command uses the [GitHub CLI](https://cli.github.com) (`gh`) to find your private repository called `progressor-plans`, or makes it the first time. If `gh` isn't installed or signed in, it says so: install it and run `gh auth login`, then try again.

Do the same on each of your other computers. There is no step per project: every project on the computer syncs.

Prefer a repository you already have? Give it instead: `npx progressor-mcp sync connect your-name/your-repo` (or its full address).

## How a project is matched between computers

Each project is matched by its GitHub address (the `origin` remote), so the same project in `C:\Work\app` on one computer and `~/code/app` on another shares one plan. A project with no GitHub address is matched by its folder name.

If a project's address differs between your computers, link it by hand from its folder: `npx progressor-mcp sync link github.com/your-name/app`.

## What syncs, and what stays on this computer

| Syncs | Stays on this computer |
| --- | --- |
| Goals, steps, decisions, notes, hand tests, your rules for each project, its Important context and the wishlist | The plan's history (for going back), cost and token counts, the last check-up |
| Your rules for every project | Settings, including your phone-notification token |
| | Messages with your AI and screenshots, **unless** you turn on *Sync messages and screenshots* in Settings › Sync |

## When it syncs

While Progressor or the background dashboard is running, it fetches other computers' changes when it starts and every few minutes, and sends yours a few seconds after the plan changes. With no internet, changes wait and go through once you're back online. Run `npx progressor-mcp sync now` to sync at once.

## When two computers change the same thing

Changes to different goals, or different steps of one goal, are both kept. If the same step was changed on both computers before they synced, the newer change is kept, and the other one is saved under Settings › Sync so nothing is lost.

## Check it or turn it off

- **Settings › Sync** on the dashboard shows whether sync is on, the repository, when it last synced and any problem.
- `npx progressor-mcp sync status` says the same in the terminal, and which plan the current folder is.
- `npx progressor-mcp sync off` turns it off on this computer. Your plans stay in each project as they are.
