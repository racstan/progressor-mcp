# Changelog

All notable changes to progressor-mcp. Each release is a Goal on Progressor's own plan, which is kept on the maintainer's computer; from 0.2.0 on, one release bundles several finished Goals.

## 1.1.0 · A wishlist for each project

### Wishlist

- **A Wishlist page for each project**, in the sidebar. It's for what you want from the project as a whole, in your own words, apart from goals and steps. Add a wish, reword it, tick it off when you have it (it moves to *You have these*), or remove it.
- **Your AI reads the wishlist but never changes it.** It sees your open wishes every time it checks where the work stands, it's told when you change one, and it may suggest goals from them. The wishes are kept in `.progressor/wishlist.md`.

### Highlights

- **What to look at stands out.** Wherever the dashboard shows your AI's words (things to try, steps, notes, messages), things to click in "quotes", menu paths like Settings › Notifications, file names like `start.ps1` and code are picked out by themselves. In Vibrant each kind has its own colour; Light, Dark and System use bold, a chip and an underline.

### Messages and Needs you

- **The number on Message your AI counts new replies** from your AI that you haven't read, and opening the page clears it. Before, it counted every message your AI hadn't answered, so it could stay up however often you looked.
- **The dashboard's own notices are small lines.** When you change the rules, the project notes or the wishlist, the note your AI gets shows as a short grey line (*You added wish w1 to the wishlist*), not as a message you wrote.
- **Your AI sets the order of Needs you.** Goals that need you follow the order of the plan, in the sidebar and now on Home too, and your AI puts the one to check first at the top.

## 1.0.0 · Work with your AI from the dashboard

The dashboard is no longer only for watching. You can write to your AI and answer its questions, mark what you tried, see its screenshots, and edit the rules it follows, all from the page. It also has a calmer new look, with dates and times on everything. Plans made with earlier versions keep working as they are.

### Private by default

- **A new plan stays out of git.** When Progressor starts a plan in a project, it keeps the whole `.progressor/` folder out of git, so your plan stays on your computer. To share it with git (your team, your other computers), just ask your AI; the [FAQ](docs/faq.md#is-my-plan-private-should-i-commit-the-progressor-folder) says how. Projects that already have a plan are left as they are.

### Statistics

- **A Statistics page for each project**, in the sidebar: steps done, time worked, goals finished and side trips at the top; a bar chart of steps finished each day over the last two weeks; how long steps took against their estimates; how often the work stepped off the plan and how those side trips ended; the longest steps; and a line for each goal. All worked out from the plan, nothing new is recorded.
- **Statistics on Home** add the same up across all your projects, with a line per project that opens its Statistics page.

### Out-of-date warning

- **The dashboard says when the page is out of date.** If Progressor was updated after you opened the page, or the page has been out of touch with Progressor for a minute, a bar at the bottom says so, with a **Refresh** button. It goes away by itself once things are back to normal.

### A new README

- **The README shows the dashboard as it is now**: a new demo video and GIF, and screenshots of every part (steps, the map, Needs you, Conversation, Statistics, Project notes, Home and the themes), from a sample project that `scripts/demo.mjs` records.

### Fixes

- **The Finished group in the sidebar closes again.** While you were looking at a finished goal, clicking Finished did nothing. Now it closes, and stays closed until you open it or look at another finished goal.

### When each step started and finished

- **The Steps list says when a step was finished**, at the end of its row (*Done 14:02*, *Cancelled yesterday 09:00*), and when the step being worked on started (*Working on it · since 13:50*). A step's details and the map say *Started today 13:50 · finished 14:02*; hover for the exact date. Steps finished before this show when they last changed, which is when they were finished. In the plan's files: two lines, `started` and `finished`, written by Progressor.

### Edit the project notes yourself

- **Add, change and remove your AI's rules on the dashboard.** Project notes has **+ Add a rule** (tick **Must never be broken** for a hard rule), and each rule has **Edit** and **Remove** (Remove asks first). **About this project** has **Edit** too, with a character count. Your AI is told about each change at its next step, as a message you can see on Message your AI.

### Handier links on the dashboard

- **Copy for your AI is now short.** It copies a one-line pointer, such as *Step t3 "Login page" (in progress) in goal "Sign-in". Look it up with get_item progressor://sign-in/t3 (.progressor/goals/sign-in.md:12).* Your AI has Progressor, so it looks the rest up itself; paste it and say what you want.
- **Show in folder.** A goal and each step have a **Show in folder** button that opens your file manager where the plan is saved (Explorer and Finder select the file; on Linux its folder opens). Only files inside the project can be shown, and only from the dashboard's own page.
- **What waits on you moves a little.** The Needs you box breathes slowly, its label and the waiting step pulse gently, and Needs you in the sidebar and on Home has a beating dot. Turned off when your computer asks for less motion.

### Dates on everything

- **Every goal, step, decision, note and thing to try now says at what date and time it was added, who added it (your AI or you) and when it last changed.** On the dashboard it shows in the goal's header, in a step's details and on the map, and under each decision, note and thing to try; hover a date to see the exact day and time. Your messages show when they were sent and answered. Plans you already have keep working: they just have no dates until something changes. In the plan's files: two lines, `added` and `updated`, written by Progressor.

### Plans kept safe

- **A damaged plan file is no longer written over.** If your list of goals (or one goal's steps) was pasted over or edited into something Progressor can't read, it used to be treated as empty and the next change replaced it, so other goals could vanish. Now Progressor stops and says which file it could not read, and leaves it as it is. Fix the file (git can restore it) and carry on. A new or empty file works as before.
- **Saving is safer on Windows.** If another program holds a plan file for a moment, Progressor now tries again a few times before saving another way, and no longer leaves a stray `.tmp` file behind.

### Lighter for your AI

- **Short answers for step changes.** Starting, finishing or dropping a step, and ending a side trip, now answer in a line or two and where the work stands, instead of repeating all your rules and background each time. A busy session costs your AI far fewer tokens.
- **A shorter status when no goal is taken.** It lists only goals that are active, paused or planned, and just counts the finished and cancelled ones.
- **Shorter standing guidance for your AI.** The instructions your AI reads at the start are about half the size, with the same rules; the detail now lives in each tool's own description.

### Helpers and checks

- **Where a helper's work is.** When your AI hands a step to a helper, it can record the helper's branch, folder and a label (such as the model). They show on the step in the dashboard and in your AI's status, and are kept after the step is done. If a finished step's branch still holds work that was never merged, or a step has sat in *Checked* for more than a day, your AI's status warns about it. In the plan's files: `helper`, `helper branch`, `helper folder` lines, plus `checked since`.
- **What was checked.** When your AI marks a step *Checked* it can add one short line on what it checked, such as *715 passed, live send OK*. It shows on the step in the dashboard and in your AI's status. In the files: an `evidence` line. The tool descriptions ask your AI to give it.
- **Locks on shared things.** Some things only one AI chat or helper can use at a time, such as a window that lets just one copy run. Your AI can now mark one as *in use* (`claim_resource`, with a reason, and a label for a helper it claims for), see who has what (`list_resources`) and release it (`release_resource`). A second claim is refused with who has it, since when and why, so the second helper does not start and report a pass that tested nothing. A lock frees itself after 30 minutes (up to 4 hours if asked, and claiming again refreshes it) or when the chat that made it ends. Your AI's status lists what is in use, and the dashboard shows it small under your goals: *In use: dev window, by helper: media run, 4 m*. Locks are kept in the computer's temp folder, not in `.progressor/`, so they never show up in the plan or in git.
- Plans from before keep working unchanged.

### Things to try by hand

Some things only you can test. Your AI now keeps them in a list on the goal instead of in its chat summary, where they got lost, and you cross them off yourself on the dashboard.

- **A list on each goal.** Your AI adds what to try, optionally with the step it is about (new tools `add_hand_test` and `update_hand_test`). The dashboard shows it as **Things to try by hand**, under the goal's banner.
- **You mark each one.** **✓ Works**, **✗ Doesn't work** (you type a few words) or **Won't test**, and **Undo** takes a mark back. This is the first thing you can change on the dashboard besides stopping a server: a small `POST` that only the dashboard's own page can send, written through the same code as the tools while holding the plan's lock. The dashboard's hub version is now 4.
- **A failure becomes a step.** *Doesn't work* adds a pending step to the goal, *Fix: …*, with your words in its details, linked both ways (and reopens a finished goal). Undoing the mark cancels that step if your AI hasn't started it.
- **Your AI sees your marks.** `get_status` lists what is still to try and, once, the new marks, failures with your note first; hand tests also show in `get_item` and in Claude Code's session-start status. A goal can't be completed while something is still to try, unless your AI is told to finish anyway (`unmarked_hand_tests_ok`).
- **In the files:** a `## Hand tests` section (`[ ]` not tried, `[x]` works, `[/]` doesn't work, `[-]` won't test) with `task`, `note`, `marked`, `task added` and `seen` lines, and a `from hand test` line on the added step. Plans from before keep working unchanged. See [the format](docs/markdown-format.md#hand-tests).

### Pictures on the dashboard

- **Your AI can show you a screenshot or a short screen recording** instead of naming a file in the chat. It appears as a small picture under the step or the thing to try that it is about, and in a *Pictures* list at the top of the goal's Notes tab. Click one to see it large; press Escape, click outside it or use the close button to go back. Recordings have play controls.
- **Pictures stay on this computer and out of git.** They are copied into `.progressor/pictures/`, and Progressor adds that folder to `.progressor/.gitignore` for you, as it does for your conversations. Your original file is not moved or changed.
- **Limits.** Pictures (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) and recordings (`.webm`, `.mp4`) up to 10 MB each, each with a short caption. Your AI can also take a picture back. In the plan's files: `.progressor/pictures/<goal>/`, with an `index.json` listing them.

### Talk with your AI from the dashboard

You can now write to your AI from the dashboard, and your AI can ask you things there instead of stopping in the chat.

- **Write to your AI.** Each goal has a box under its banner: type what you want and press **Send**. Your AI reads it the next time it updates the plan (every few minutes while it works, or when the next chat starts; nothing can interrupt a chat), does what you asked and replies. You see *sent*, *read by your AI* and the reply under your message, and you can **Take back** a message your AI hasn't read yet.
- **Write to your AI about the whole project.** **Message your AI** in the sidebar is for things no single goal covers, such as "stop everything" or "start on the logo next". Whichever AI chat in the project checks in next reads it, even one not working on a goal, and replies there. It is kept in `.progressor/talk/_project.md`, out of git like the rest.
- **Answer your AI's questions.** When your AI needs you to choose, it asks on the dashboard with a button per answer, plus **Something else…** for your own words, and carries on with other work meanwhile. The goal shows **Waiting on you** until you answer. Your answer reaches your AI at its next update and is kept in the goal's decisions.
- **For your AI:** new tools `ask_developer` and `reply_to_developer` (with `whole_project: true` for a message to the whole project). New messages and answers are shown once, at the top of `get_status` and at the end of any other tool's answer for a goal it holds; in Claude Code the prompt hook also mentions them. `get_status` lists messages not replied to and questions still open.
- **Kept on this computer, out of git.** What you write is saved in `.progressor/talk/`, apart from the plan, and Progressor adds that folder to `.progressor/.gitignore` by itself, so it never lands in your project's history or on GitHub. The box says so: *Kept on this computer only, not saved in git.* Your answers to questions are also saved as decisions in the plan, which is shared with your code.
- **In the files:** one talk file per goal, `.progressor/talk/<goal>.md`, with `## Messages` and `## Questions`. See [the format](docs/markdown-format.md#messages-and-questions) and [ADR 0005](docs/adr/0005-developer-talks-to-the-ai-from-the-dashboard.md). Plans from before keep working unchanged.

### A steadier dashboard

- **Live updates on Linux.** On Linux the dashboard only noticed the first change to each goal and then went quiet until Refresh or its 15-second timer, because Node's folder watcher loses a file once it is saved by replacing it (how every save works). Each folder is now watched on its own, and every change shows at once.

- **Many tabs at once.** Browsers allow only six connections to one address, and each dashboard tab kept up to two live ones open, so with a few tabs open the page could stop loading. A tab now keeps one, and lets go of it while it is in the background; shown again, it reconnects and catches up.
- **No more blank page.** If part of the page fails to draw, you see a short message and a **Reload** button instead of an empty window; a failure in one goal's view leaves the sidebar working, and picking another goal tries again.
- **No old answers.** When the page asked the server twice in a row (a change, the timer, a click), a slow older answer could replace the newer one; now only the newest counts, and the roadmap and the goal are always shown from the same moment.
- **Plainer words.** A lock your AI holds itself reads *by your AI* instead of a session ID, and your AI's status says *1 works, 1 doesn't work*.
- Claude Code's status hooks start faster: they no longer load the whole MCP server to describe the hand tests.

## 0.9.0 · How long things take, and not too much at once

Your AI now says how long it expects each step to take, keeps track of how long it really took, and keeps to a limit on how many helpers work at once, so a big push doesn't overload your computer or leave more work to check and merge than your AI can keep up with.

- **Estimates.** When your AI plans, it gives each step a rough time, such as *45 m* or *2 h*, and can give a whole goal one before its steps are worked out. It updates them when it learns more. In the plan's files each is an `estimate` line.
- **Time taken.** Progressor clocks each step from when your AI starts it or hands it to a helper until it's done, released or cancelled; while a step is set back to *To do* the clock stops. A step's details show both: *Took 1 h 10 m, estimated 45 m*, and your AI sees the same when it finishes a step, to guess better next time. In the files: `time spent` and, while it runs, `timing since`.
- **A limit on helpers.** Tell your AI *"at most 2 helpers at a time"* and it saves a rule that holds the limit (a `helpers at once` line). Your AI sees the limit when it starts and in the rules it passes to its helpers. If it hands out one step too many, the step is still handed out, but your AI gets a warning naming the limit. With no limit set, nothing changes.
- **A rough schedule.** From the estimates, the order of your goals and the limit, the dashboard shows what's running now, what comes next and when each goal should be done: *Now: 2 helpers busy, at most 2 at once · Next: Memory export · Phase 8 done in about 1 h (3 steps not estimated) · all goals done in about 4 h*. Steps without an estimate are counted, never guessed. Each goal's banner shows its estimate and expected finish, and your AI's status has the same in one short line.
- Plans from before keep working unchanged: without estimates or a limit, nothing new shows.

## 0.8.0 · Record work in another project's plan

An AI chat working in one project can now record work it did for another project in that project's plan, without you opening a chat there. Say a chat in your app fixes and releases a library the app uses: it adds *Release 0.7.1*, finished, to the library's plan.

- **The tools take a project.** Your AI can look at another project's plan and add a goal (finished or not) and put it in order, add and move along steps, finish a goal, and add decisions and notes there, naming the project as the dashboard does or by its folder. Only a project that already uses Progressor can be changed: a plan is never started from outside.
- **Clearly marked.** Everything changed from outside carries a pink **Updated from** tag with the project it came from, such as **Updated from kdeaichat**, on the goal, its steps, decisions and notes. Hover it: *This was changed by an AI chat working in another project*. While the latest change to a goal came from elsewhere, its status line says so too. In the plan's files it is an `updated from` line with the project and the time.
- **The other project's AI is told.** The next time the AI in that project looks at the plan, it reads what was changed from elsewhere since it last looked, once.
- **Work in progress is safe.** A goal that a chat in that project is working on can't be changed from outside, only given a note. Nothing is claimed from outside, and chats in both projects take turns writing a plan, so neither overwrites the other's change.

## 0.7.1 · The dashboard keeps up while helpers work

- A goal whose steps are with helper agents now says **Helpers working** in the sidebar and at the top of the goal, with how many steps are with helpers: *Helpers working · 3 of 5 steps with helpers · last update 19 min ago*. Before, it said *AI waiting* once the plan had been quiet for 15 minutes, though helpers were busy for most of an hour. *AI waiting* now means nothing is with a helper and nothing has changed for 15 minutes.
- The AI is told to mark each step as soon as it moves on (checked once it has checked a helper's work, released once it is merged), not all at the end, so the page moves while the work goes on.

## 0.7.0 · Progress that survives, and plans that match how the AI works

Your progress no longer depends on the chat: everything the AI knows about the project is saved where both of you can see it, so a new chat, a compressed memory or a different app picks up exactly where things stopped.

### Important context

- Each project has one **📌 Important context** page: your rules, then the project's background (what it is, key facts, choices that hold for the whole project). The AI keeps it up to date and reads all of it at the start of every chat and after its memory is compressed. Find it in the dashboard's sidebar, above Your goals.
- Rules can be marked as **must never be broken**. They come first everywhere and carry a **Must** label on the page.
- When the AI hands work to a helper agent, it can paste your rules into the helper's instructions in one go.

### Plans that match how the AI really works

- One chat can work on **several goals at once**, for example while helper agents work on two of them.
- Steps have four new states: **With a helper**, **Waiting on you**, **Checked** and **Released**, each with its own mark on the map and the list.
- A goal with a step **waiting on you** turns amber and says so in the sidebar, at the top of the goal and in All projects, so you see at a glance when something needs you.
- Each goal lists the **decisions** made along the way and **notes**, including notes found while working on another goal.
- The AI can move a step to another goal, and update several steps in one go, which uses fewer tokens.
- The reminder the AI gets with each message says how old it is, and warns when it may be out of date.

### Fixes

- A project set up on Windows now works on macOS and Linux too, and the other way round. Before, Progressor failed to start with "Executable not found in $PATH: cmd". At the start of a chat the AI now warns you if Progressor can't start in that folder.
- When a chat closes, however it closes, its goals are freed and the dashboard's address (port 4747) is handed back. Goals left behind by chats that ended are cleared the next time the AI reads the plan. If the dashboard has to use another port, the AI tells you why.

## 0.6.2 · Refresh and hide finished goals

- A **Refresh** button in the top bar loads the latest plan and running servers at once, instead of waiting for the next change.
- **Hide all** under the **Finished** heading hides every finished goal from your list in one click. The plan keeps them, and they're listed under **Hidden**, where you can show them again. Only your browser's list changes.

## 0.6.1 · The Finished group closes

- The **Finished** group in the dashboard's sidebar now opens and closes when you click it. Before, it stayed open while the goal on screen was one of the finished ones.
- The README explains that one running Progressor shows every project on the same dashboard, whichever project or app it was started from, and how to have Progressor in every project.

## 0.6.0 · Simple for anyone, in any app

Progressor is now made for people who don't code as much as for those who do: the AI manages the plan by itself, the dashboard speaks plain English, and the docs cover every MCP app.

### The dashboard

- **Plain words everywhere**: *step*, *side trip*, *Your goals*, *Finished when* and *cancelled*, with no IDs, tool names or file paths unless you ask for them.
- **A status line** says what the AI is doing: *AI working · step 3 of 7 · last update 2 min ago*; *AI waiting* when its chat is open but nothing has changed for 15 minutes; *AI stopped* when its chat has closed.
- **A Show menu** replaces the Detours switch: side trips (on), cancelled steps (off) and file names (off).
- **Fewer things up front**: the Live chip is a green dot with its words on hover, and every control explains itself on hover. Help keeps only the feedback links. The code editor, hidden goals and the running servers move to **⚙️ Settings → Advanced**. The plan's rules and Ideas are no longer shown.
- Empty pages tell you what to say to your AI instead of which tool it should call.
- The top bar fits a phone screen.

### The AI

- **It runs the whole loop by itself**: it plans new work and starts it, carries on with a paused goal, finishes a goal when every step is done, and tells you in a plain sentence, with the dashboard link.
- **It talks plainly**: no tool names, IDs or file names when it tells you what it's doing.
- **It can change or drop a rule** you gave it, with the new `update_standing_instruction` tool.
- **Ideas are gone**: the `record_idea` and `promote_idea` tools and the **/progressor:idea** command are removed, to keep things simple. Ideas already in a plan are kept in the file.
- **/progressor:setup** has the AI run the setup itself instead of asking you to.

### Any MCP app

- **The right project folder in every app**: Progressor asks the app which folder is open (MCP roots), and refuses to start a plan in your home folder, the top of a drive or the Windows folder, saying how to fix it. `get_status` shows the project folder.
- **`init` adds Progressor's note to `AGENTS.md`** as well as `CLAUDE.md`, since most apps other than Claude Code read `AGENTS.md`.

### Fixes

- Two side trips with the same title no longer mix up their details.
- A goal can only be finished once every step is done or cancelled and no side trip is open.
- Titles, reasons and rules given with line breaks are kept on one line, so they no longer break the plan file.

### Docs

- A short README with a setup message to paste into any AI app.
- New guides: [getting started](docs/getting-started.md), [setup for your app](docs/apps.md) (Claude Code, Claude Desktop, VS Code, Cursor, Windsurf, Codex and others), [using Progressor](docs/using.md), [questions](docs/faq.md), [troubleshooting](docs/troubleshooting.md) with a line to paste to your AI for each problem, and [updating and removing](docs/updating-and-removing.md).

## 0.5.2 · The top bar fits narrow windows

- In a browser window about half a screen wide, the dashboard's top bar ran past the right edge, hiding the view buttons, the Detours switch and the theme toggle. The search box now shrinks to make room, and below 820px the logo drops its name, so the whole bar fits down to about 700px.

## 0.5.1 · Commands that work with no text

- **/progressor:plan** and **/progressor:idea** no longer need text after them. Sent on their own, the Agent asks you in the chat what to plan or park, and your answer can hold anything: links, code, pasted text.
  - Some apps allow only plain words after a command. Claude's app refuses links and formatting there with "A command takes file @-mentions but no other @-mentions, slash commands, links, or inline formatting", so nothing was sent.
  - Plain words after the command still work as before.
- Troubleshooting in the README covers that error.

## 0.5.0 · More slash commands

### New commands

- **/progressor:next** picks up where the plan left off: it finishes an open Detour first, carries on with the Task in progress or starts the next one, and claims the paused Goal if no Goal is claimed (or asks which, when there are several).
- **/progressor:idea** parks an idea for later as an Idea, without working on it now.
- **/progressor:dashboard** gives the link to this project's dashboard, and opens it in the app's browser pane where there is one.
- **/progressor:setup** sets up the conversation's folder from the chat: the hooks, the note in `CLAUDE.md` and a Roadmap, after your OK.

### Progressor in every project

- Register Progressor once for your user (`claude mcp add --scope user progressor -- npx -y progressor-mcp`) and it runs in every conversation, whatever its folder; **/progressor:setup** then sets a folder up without a restart. See [docs/setup.md](docs/setup.md#use-progressor-in-every-project).
- `progressor-mcp init --no-server` sets a project up without adding it to `.mcp.json`, for an app that already runs Progressor in every folder.
- The server takes its project folder from `CLAUDE_PROJECT_DIR` when Claude Code sets it, as the hooks already did.

### Docs

- The commands are named as the `/` menu shows them, `/progressor:status (MCP)`, instead of `/mcp__progressor__status`, which only works when typed in full.

## 0.4.1 · Help and a shorter README

### Report a problem from the dashboard

- The ❓ Help menu opens with **Facing a problem?**: **Report a problem** and **Suggest an idea or share feedback** open a GitHub issue form with your Progressor version (and, for a problem, your system and browser) already filled in, next to a link to the open issues.
- The Help menu is there on every page, including before a project has any Goals.
- **Buy me a coffee** moves to the bottom of ⚙️ Settings.
- `progressor-mcp --version` (or `-v`) prints the version, for bug reports.
- New issue forms on GitHub for problems and ideas.

### A shorter README

- The README keeps what a new user needs: a **For AI agents** setup prompt to paste into your Agent's chat, a short install, how it works, the dashboard in brief, **Troubleshooting** for the common setup problems, and **Feedback and help**.
- The details move, unchanged, to [docs/setup.md](docs/setup.md), [docs/dashboard.md](docs/dashboard.md), [docs/reference.md](docs/reference.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## 0.4.0 · Search and long plans

### Search

- A search box in the top bar finds projects, Goals, Tasks and Ideas across every project as you type.
  - It matches titles, Outcomes, Task summaries, Idea notes and folders.
  - Press `/` or Ctrl+K to focus it.
  - Arrow keys and Enter open a result; a Task opens on its Goal's map with its details.
- The overview and the project switcher are one flat list of projects, those with work in progress first.
  - The Workspace headings are gone, and every project shows its full folder instead of a path relative to its Workspace (which showed "." for a Workspace that is itself a project).
  - Workspaces still decide which folders are scanned.
- On the overview, the cards narrow to the projects matching the search.

### Across view for long plans

- A plan too long for the screen wraps onto rows that turn back and forth like a snake, so a 45-Task Goal fits at a readable size.
- Detours branch and rejoin the right way on rows running in either direction.
- Each stop shows one file chip plus "+n", and long file names are shortened, so chips no longer overlap.

### Fixes

- The Servers panel no longer stays on "Loading…" when the dashboard is still served by a Progressor from before 0.3.1. It now says so and how to close that process.
- `/api/info` reports the process ID of the server serving the dashboard.

## 0.3.1 · Running servers

### Running servers in the dashboard

- A **🖥 Servers** button in the top bar shows how many Progressor processes are running.
- Its panel lists each one with its project, folder, Goal, memory and start time, and marks the one serving the dashboard.
- **Stop** ends a server after a confirm.
  - Only the dashboard's own page can stop one, never another website.
  - The server is asked to exit by itself, so no other program can be hit.
- When the server serving the dashboard stops, another running server takes the dashboard over within about 5 seconds.

## 0.3.0 · Setup, slash commands and shaping Goals

### One-command setup

- New `progressor-mcp init [folder]`. It registers the MCP server in `.mcp.json`, adds the status hooks to `.claude/settings.json`, adds a short note for the Agent to `CLAUDE.md` and creates an empty Roadmap.
  - It lists the changes and asks once; `--yes` skips the question.
  - Running it again changes nothing.
  - `--remove` takes it out again and leaves `.progressor/` alone.
- When run through npx, it says that npx adds about 1.5 seconds to every message and suggests a global install. The README's hooks section says the same.

### Slash commands

- Three MCP prompts, which Claude Code shows as `/mcp__progressor__status`, `/mcp__progressor__plan <goal>` and `/mcp__progressor__review [goal]`.

### Shaping Goals

- New tools:
  - `update_goal` renames a Goal or changes its Outcome.
  - `move_goal` reorders the Roadmap.
  - `drop_goal` drops a Goal with a reason.
- A Goal can have an **Outcome**, one line on what done looks like. It is shown in the status, the session-start hook, Copy as prompt and the dashboard banner.
- `add_goal` takes an optional short `id`.
- `add_goal` refuses a second Goal with the same title unless `allow_duplicate` is set.
- Finished work can be recorded in one call: `add_goal` with `done: true` and Tasks marked `done`.
- Clearer tool descriptions.

### Dashboard

- `progressor-mcp dashboard <folder>` now says when it remembers a new folder as a Workspace, and how to forget it.

## 0.2.1

- Dashboard: the Goal on screen stays on screen when it finishes, instead of jumping to the next planned Goal.
- The source is public at [github.com/racstan/progressor-mcp](https://github.com/racstan/progressor-mcp); the npm page links to it, and the README opens with a demo.
- Listed in the official MCP Registry as `io.github.racstan/progressor-mcp` (`mcpName` in package.json, `server.json` in the repository).

## 0.2.0 · Workspaces, Settings and finished Goals

Also includes the status hooks below: 0.1.2 was never published on its own.

### Workspaces

- New `progressor-mcp dashboard [folder]` command: opens the dashboard on a folder from anywhere, with no Agent running. It shows every project inside it, meaning every folder with a `.progressor/roadmap.md`, at any depth. Dependency, build and hidden folders are skipped.
- The folder is remembered as a Workspace in `~/.progressor/workspaces.json`, so its projects keep showing. `--forget` stops showing it; `--no-open` only prints the address.
- The project switcher groups projects by Workspace. When there is more than one project, the start page is an overview of every project's Goals in progress and how far along they are.

### Settings and finished Goals

- A **⚙️ Settings** panel holds:
  - the view a Goal opens in (Across, Down or List)
  - the theme (light, dark or match the system)
  - the editor for "Open in file", moved out of the navbar
  - how finished Goals behave
  - whether hidden Goals are shown

  Settings are saved per browser.
- A finished Goal turns green with a green dot until you open it, then moves to a collapsed **Done** group. A setting moves finished Goals to Done straight away instead.
- Right-click a Goal in the sidebar to hide it from the list, or to move a finished Goal to Done. This changes only what your browser shows.
- `claim_goal` on a done Goal reopens it, so work found after a review joins the same Task list; its finished Tasks stay done. Copy as prompt on a done Goal tells the Agent how.

### Fixes

- The dashboard loads faster. It now also listens on IPv6 loopback (`::1`), because browsers try `localhost` there first and waited up to two seconds for that attempt to fail.
- The dashboard's internal version is now 2, so a running 0.1.x dashboard is not shared. A 0.2.0 server uses the next free port until the old one exits.

## 0.1.2 · Status hooks for Claude Code (not published; shipped in 0.2.0)

- New `progressor-mcp hook <event>` command for Claude Code hooks, so the Agent no longer has to remember to check the plan:
  - `hook session-start` gives the Agent the full status at startup, on resume and after context compaction: the Goal, the current Task and its summary, any open Detour, the next Task and the Standing Instructions.
  - `hook prompt` adds a one-line reminder to every message, and stays silent when no Goal is being worked on.
  - It reads `.progressor/` straight from disk, needs no running server, and never blocks or fails a message. The README shows how to set it up.
- Dashboard: the navbar shows "Progressor" once and no longer shows Session chips. A new **Help** menu holds the Standing Instructions, the parked Ideas and a Buy Me a Coffee link.

## 0.1.1 · Dashboard fixes

- Text in backticks inside Task summaries and Detour Reasons is shown as code, instead of showing the backticks.
- The sidebar heading reads "Roadmap · N Goals", and the Goals sit on one rail, so it's clear they belong to a single Roadmap.

## 0.1.0

First release.

- MCP server for any MCP app, with tools for Goals, Tasks, Detours (Merge back, Return, Recalibration), Ideas and Standing Instructions.
- Progress stored as markdown inside the project: `.progressor/roadmap.md` and one Plan File per Goal.
- One live, view-only dashboard at `localhost:4747` for every project on the machine, with Metro (across and down) and checklist views, Open in file and Copy as prompt.
