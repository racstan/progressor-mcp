# Questions

## Do I have to learn anything to use it?

No. You talk to your AI as you normally would. Progressor gives your AI the tools to plan and keep track, and the dashboard shows you what it's doing. There are a few [commands](using.md#the-commands) if you want shortcuts, but plain words work just as well.

## Which AI apps does it work with?

Any app that supports MCP servers: Claude Code (in a terminal, an editor or the Claude desktop app's Code tab), Claude Desktop, VS Code with GitHub Copilot, Cursor, Windsurf, Codex and many others. See [Setup for your app](apps.md).

## Does it cost anything, or send my code anywhere?

Progressor is free and open source. It runs on your computer and keeps the plan in your project's `.progressor` folder. It doesn't send anything anywhere: the dashboard is served from your own computer and can't be reached from others. Your AI app works as it always does.

## Does it slow my AI down?

Barely. Your AI makes a quick call to Progressor when it starts or finishes a step. In Claude Code, a one-line reminder of the current step is added to each message.

## What's the difference between a goal and a step?

A **goal** is something you want, such as *"Contact form"*, with a sentence saying what finished looks like. **Steps** are the pieces of work your AI does to get there, in order. See [Using Progressor](using.md).

## What's a side trip?

When your AI has to do something that isn't the current step, such as fixing a broken test first, it says so and gives a reason, instead of drifting off quietly. That's a side trip. See [Side trips](using.md#side-trips).

## Can I edit the plan myself?

Ask your AI to change it: *"Add a step to send a copy to the customer."* The plan files are plain text, so you can read them, but leave the editing to your AI: it keeps them in the right shape, and the dashboard reads them.

## Should I commit the `.progressor` folder?

That's up to you. Committing it keeps the history of how the project was built, and lets everyone working on it (people and AIs) see the same plan. If you'd rather not, add `.progressor/` to your `.gitignore`.

## Can two AI chats work on the same project?

Yes, on different goals. Each chat works on one goal at a time, and Progressor stops two chats from working on the same goal at once.

## What happens when my AI's conversation runs out of room?

When an AI's conversation gets long, the app summarises it, and the AI forgets details. Progressor keeps the plan outside the conversation, so the AI picks up the plan again after the summary (in Claude Code, automatically). A new conversation picks it up too: say *"carry on"*.

## I closed the chat halfway. Is the work lost?

No. The goal is paused, with every finished step still ticked. Open a chat in the same project and say *"carry on"*.

## Can I see all my projects at once?

Yes. The dashboard lists every project you've used Progressor in: pick **🗂 All projects** at the top of the sidebar. See [The dashboard](dashboard.md).

## How do I update or remove it?

See [Updating and removing](updating-and-removing.md).
