# Using Progressor

Once Progressor is set up, you don't operate it: your AI does. You keep talking to your AI as usual, and Progressor makes sure it plans, keeps track and tells you what's going on. This page explains what happens and what you'll see.

## Goals and steps

When you ask for something, your AI turns it into a **goal**, such as *"Contact form"*. A goal has:

- **Finished when**: one sentence on what done looks like, such as *"Visitors can send a message from the home page and it arrives by email."* Your AI checks its work against this before it calls the goal finished.
- **Steps**: the pieces of work in order, such as *"Add the form"*, *"Send the email"*, *"Show a thank-you message"*.

Your AI works through the steps one at a time and ticks each off when it's done. When every step is done and the work matches *Finished when*, it marks the goal finished and tells you in a sentence.

A project can have several goals. **Your goals** on the dashboard lists them all, in the order they'll be done.

## Side trips

Sometimes your AI has to step off the plan: a test was already broken, something needs fixing first, or what it learned changes the plan. Instead of drifting off quietly, it declares a **side trip**, with the reason. On the dashboard it shows as a branch off the line.

A side trip ends in one of three ways:

- **Side trip done**: the AI fixed the thing and carried on with the plan as it was.
- **Back to the plan**: the AI went back to the plan, adding steps for what it found.
- **Plan changed**: what it found changed the plan, so the remaining steps were replaced with new ones. The old steps stay on the map, crossed out, if you choose to show **cancelled steps**.

## When the AI's conversation ends

AI conversations end, get too long, or get summarised to save space, and that's usually when an AI loses track. Progressor keeps the plan in your project, in a folder called `.progressor`, so the next conversation picks up exactly where the last one stopped. To carry on, open a chat and say *"carry on"*, or use **/progressor:next**.

If you close the chat in the middle of a goal, the dashboard says **AI stopped**. The goal waits, paused, until a chat picks it up again.

## What to say to your AI

You can use your own words for all of this:

| You want to… | Say something like… |
| --- | --- |
| Start something new | *"Let's add dark mode."* |
| See where things stand | *"Where are we?"* or **/progressor:status** |
| Carry on after a break | *"Carry on."* or **/progressor:next** |
| Plan without starting yet | *"Plan dark mode, but don't start."* or **/progressor:plan** |
| Change the plan | *"Skip the email step, and add a captcha instead."* |
| Put a goal off | *"Leave the contact form for now; work on dark mode first."* |
| Cancel a goal | *"We don't need the contact form any more."* |
| Check finished work | *"Review the contact form against what we wanted."* or **/progressor:review** |
| Get the dashboard link | *"Where's the dashboard?"* or **/progressor:dashboard** |

## Rules your AI keeps

When you tell your AI how you always want something done, such as *"always ask me before adding a new library"*, it saves that as a lasting rule in the plan. Every new conversation starts with your rules, so you don't have to repeat yourself. To change or drop one, just say so: *"You don't need to ask about libraries any more."*

## Important context

Each project has one **Important context** page. It holds your rules and the project's background: what the project is, key facts, where things live, and choices that hold for the whole project. Your AI writes it, keeps it short and reads all of it at the start of every conversation, so it doesn't have to work these things out again. You can read it on the dashboard. To change something, just tell your AI: *"Note that the dashboard always runs on port 4747."*

## The commands

Most apps list Progressor's commands when you type `/` in the chat. In Claude Code they look like `/progressor:status (MCP)`; other apps name them a little differently. You never need them, since plain words work just as well, but they're handy shortcuts:

| Command | What it does |
| --- | --- |
| **status** | Where things stand, in a few lines. |
| **next** | Carry on where the work was left. |
| **plan** | Plan something new with you, before starting. |
| **review** | Check finished work against what it should do, and say what's missing. |
| **dashboard** | Give you the dashboard link (and open it, in apps that have a browser). |
| **setup** | Set Progressor up in the folder you're in, if it's registered for all your projects. |

Some apps, Claude's among them, only accept plain words after a command: no links or formatting. If you have more to say, send the command on its own, and your AI asks you in the chat.

## Where the plan is kept

The plan is plain text inside your project, in the `.progressor` folder. You can keep it with your code (it shows how the project came together), share it with others, or leave it out. Don't edit those files yourself: your AI keeps them in order, and the dashboard reads them. If you want something changed, ask your AI.
