# The dashboard

The dashboard is a page in your browser that shows what your AI is doing, live. Open **http://localhost:4747** while your AI's app is open: your AI gives you the exact link when it starts, or ask it *"Where's the dashboard?"*. Keep it beside your AI's window, or in a tab. It updates by itself; you never need to refresh.

The dashboard shows the plan. The one thing you do on it yourself is mark the things your AI asks you to try by hand (see [Things to try by hand](#things-to-try-by-hand)); to change anything else in the plan, tell your AI.

## At the top of a goal

A banner says, in one glance:

- **What the AI is working on**: *Contact form: working on "Send the email"*. If a step is waiting on you, that comes first (see below).
- **Finished when**: what done looks like for this goal.
- **⏱ How long**: *Estimated 4 h 30 m · done in about 1 h (3 steps not estimated)*: what your AI expects the goal's open steps to take, and when, by the schedule, it should be done. It shows once your AI has estimated some steps.
- **The status line**, with a coloured dot:
  - 🟡 **Waiting on you**: a step needs you, for example to try something out by hand. It comes before every other status. See *Waiting on you* below.
  - 🟢 **AI working** · step 3 of 7 · last update 2 min ago: your AI is on it.
  - 🟢 **Helpers working** · 3 of 5 steps with helpers · last update 19 min ago: your AI handed steps to helper agents, which can take most of an hour. It stays this way, however long the plan stays unchanged, until each step comes back.
  - 🟠 **AI waiting**: your AI's chat is open, but nothing has changed for 15 minutes and no step is with a helper. It's most likely waiting for you: check the chat.
  - 🟠 **AI stopped**: the chat that was working on this has closed. Open a chat and say *"carry on"*.
  - **Paused**: no AI is working on this goal right now.
  - **Not started**, **Finished** or **Cancelled**.

When the AI is on a side trip, the banner turns orange and says what it's doing and why.

If the latest change to the goal came from an AI chat working in another project, the status line ends with *updated from* and that project's name. See *Updated from another project* below.

**Copy for your AI** copies a description of the goal that you can paste into any AI chat, to ask about it or change it.

## The map

Each step is a stop on a line, left to right. A filled stop with a tick is done; the pulsing one is being worked on now; empty ones are still to do. Long plans wrap onto several rows.

Besides *to do*, *working on it*, *done* and *cancelled*, a step can be in one of four more states. Each has its own colour and mark, in the map, the list and the legend under the map (the ❓ Help panel lists them all):

| Looks like | Means |
| --- | --- |
| 🔵 A half-filled blue ring, **With a helper** | The AI handed this step to a helper, another AI that works on it on the side. Several steps can be with helpers at once. |
| 🟡 A filled amber **!**, **Waiting on you** | The AI needs you for this step, for example to try something out by hand. |
| 🟢 A teal ring with a tick, **Checked** | The AI looked over the helper's work and it holds up. It isn't merged or released yet. |
| ✅ A filled tick with an outer ring, **Released** | Done and out: merged, shipped, installed or published. It counts as done in a goal's progress. |

Click a stop and its details say in a sentence what its state means.

**Click any stop** to see what the step does, and to copy it for your AI. Scroll to zoom, drag the background to move around, and use **⤢** to fit the whole map on screen.

Three buttons at the top switch how you see it:

- **⇢ Across**: the map, left to right (the default).
- **⇣ Down**: the map, top to bottom, for long plans.
- **☰ List**: the steps as a plain list, with what each one does.

## Waiting on you

When any step of a goal is waiting on you, the whole goal says so, so you can see at a glance that something needs you:

- In the sidebar, the goal turns amber with a pulsing dot and says **Waiting on you** instead of *AI working*. Hover it to see how many steps are waiting.
- At the top of the goal, the banner turns amber and lists the step or steps waiting on you. Click one to see its details.
- On the map the step has an amber **!** and **WAITING ON YOU** above it; in the list its row is highlighted.
- In **All projects**, the goal says **Waiting on you** and its project shows the same note and comes first in the list.

A question from your AI makes the goal wait on you in the same way; answer it in the [talk box](#talk-with-your-ai).

Once you've done what the step needed, tell your AI in the chat: it moves the step along, and the goal goes back to normal by itself.

## Talk with your AI

Under the goal's banner there is a box to write to your AI: type what you want ("use the blue logo", "skip the export step for now") and press **Send**. Your message is kept with the goal's plan. Your AI reads it the next time it updates the plan, which while it works is every few minutes, and does what you asked. It can't read it any sooner: nothing on this page can interrupt or wake up an AI chat. If the chat is closed, your message waits for the next one. Under your message you see where it stands: *sent; your AI reads it at its next update*, *read by your AI*, then your AI's reply. Changed your mind before your AI read it? Press **Take back**.

When your AI needs you to choose something, it asks here instead of stopping in the chat. The question shows at the top of the box under **Your AI asks**, with a button for each answer, plus **Something else…** to answer in your own words. Click one and your AI gets your answer at its next update. Your AI keeps working on other steps meanwhile, and your answer is also kept in the goal's decisions. While a question waits, the goal says **Waiting on you**, like a step waiting on you.

What you've said before stays below, newest first: your messages with your AI's replies, and the answers you gave.

What you write here is **kept on this computer only**. It is saved in your project's `.progressor/talk/` folder, which Progressor keeps out of git, so it doesn't end up in your project's history or on GitHub. Your answers to your AI's questions are the exception: each one is also saved as a decision in the goal's plan, which goes into git if you share the plan ([how](faq.md#is-my-plan-private-should-i-commit-the-progressor-folder)).

## Things to try by hand

Some things only you can test: a permission prompt to allow, a screen to look at. Instead of burying them in its chat summary, your AI adds them to the goal, and they show in a **Things to try by hand** box under the goal's banner, with *2 to try · 1 works · 1 doesn't work* beside the title. The box is open while something is still to try, and folds away once you've marked everything. Each one says what to try, and the step it is about when your AI gave one.

You cross each one off yourself, with its buttons:

- **✓ Works**: it does what it should.
- **✗ Doesn't work**: asks *What went wrong?*. Type a few words (your AI reads them) and press **Doesn't work, add a step**. The goal gets a new step to do, titled *Fix: …* with your words in its details, and the item says *Added a step for your AI*. If the goal was finished, it's open again.
- **Won't test**: you'd rather skip it.

Press **Undo** on a marked item to take the mark back. If it had added a step that your AI hasn't started, that step is cancelled. Your AI sees your marks the next time it looks at the plan, with the new ones that failed first, and it can't finish the goal while something is still to try, unless you tell it to finish anyway.

## Decisions and notes

Under the map, or under the list, a goal shows what your AI decided and what it noticed while working. Both are read-only: your AI writes them as it goes, and you can ask it to change one.

- **Decisions**: choices made along the way that are worth remembering, such as *"Use email links, not codes, for password resets."*
- **Notes**: things spotted that need dealing with, such as a bug found nearby. A note found while working on a different goal says so: *"Found while working on Let people sign in."* When a note has been dealt with it's crossed out and folded into *notes dealt with*.

A goal with neither shows nothing there. Under the map you can fold the section away by clicking its heading.

## Updated from another project

An AI chat working in one project can record work in another project's plan, for example when it released that other project. Everything it adds or changes there carries a pink **Updated from** tag with the project it came from, such as **Updated from kdeaichat**: on the goal (at the top, and in the sidebar's hover), on each step in the list and its details, and under decisions and notes. Hover the tag: *This was changed by an AI chat working in another project*, and when.

The AI working in this project is told about such changes the next time it looks at the plan. A goal that an AI chat in this project is working on can't be changed from outside, except for adding a note.

## The Show menu

**Show ▾** at the top chooses what you see besides the plan's steps:

- **Side trips** (on): times the AI stepped off the plan, as orange branches with how each ended.
- **Cancelled steps** (off): steps the AI decided not to do, crossed out. Click one to see why.
- **File names** (off): the files each step changes, with buttons to open them in your code editor.

Your choices are remembered in your browser.

## Your goals

The sidebar lists **Your goals** for the project, in the order they'll be done, each with a progress bar and its status. Click one to see its map. Your AI can have several goals in progress at once, and each shows its own status.

Above the list, once your AI has estimated some steps or you've set a helper limit, a **⏱ schedule** line says what's going on and how long it should take: *Now: 2 helpers busy, at most 2 at once · Next: Memory export, then Translations · Phase 8 done in about 1 h (3 steps not estimated) · all goals done in about 4 h*. It's a rough guide, worked out from the AI's estimates, the order of your goals and how many steps may run at once (your helper limit, or else as many as run now). Steps without an estimate are left out of the times and counted instead. A step's details show its estimate next to how long it took.

A step your AI handed to a helper can also show *Helper: Sonnet · branch feat/export · folder …*, and a step marked Checked can show *Checked: 715 passed, live send OK*: what your AI looked at before calling it checked. Both appear under the step's summary in the list and in its details.

A goal that finishes turns green and gets a green dot until you've looked at it; then it moves to **Finished** at the bottom. Right-click a goal to hide it from the list (the plan keeps it), or to move a finished one along without opening it.

If you use Progressor in several projects, click the project name at the top of the sidebar to switch, or pick **🗂 All projects** for an overview of every project at once.

## Important context

**📌 Important context**, above Your goals, opens the project's one page of rules and background: the rules you've given your AI, then what the project is, key facts and choices that hold for the whole project. Your AI writes it and reads all of it at the start of every conversation. Rules you've said must never be broken come first, each marked with a **Must** label. The rule that holds your helper limit says so: *At most 2 helpers at once*. You can change it yourself: **+ Add a rule**, **Edit** and **Remove** on each rule, and **Edit** on About this project. Your AI is told about each change at its next step.

## Highlights

Wherever the dashboard shows your AI's words, such as things to try by hand, steps, notes and messages, it picks out what to look at: things to click or type in "quotes" (a chip, like a button), menu paths such as Settings › Notifications (underlined), file names such as start.ps1 (in a typewriter font) and code in `backticks`. It finds them by itself, so nothing changes in how your AI writes. In the Vibrant theme each kind has its own colour; Light, Dark and System keep to black and grey. Hover one to see what kind it is.

## Wishlist

**Wishlist** in the sidebar is for what you want from the project as a whole, in your own words: not goals or steps, just wishes, such as *People can use it on their phone*. Type one in the box at the top and press **Add wish**. Each wish has **Edit** and **Remove**, and a tick box for when you have what you wished for; ticked-off wishes move down to **You have these**, and unticking puts one back. Only you change the wishlist. Your AI reads it at every status check, is told about each change, and may suggest goals from it, but it never edits it.

## Statistics

**Statistics** in the sidebar works out a few numbers from the project's plan:

- **At the top:** steps done, the time worked on them, goals finished and side trips.
- **Finished each day:** a bar for each of the last two weeks; hover a bar for its day and count. Today's bar is striped.
- **Estimates:** how long finished steps took against what your AI estimated, such as *Steps took about 1.4× as long as estimated. 8 of 12 were done within their estimate.*
- **Side trips:** how often the work stepped off the plan, how those side trips ended, and how many steps were added after one or cancelled.
- **Longest steps** and **Each goal**, newest first; click one to open its goal.

**Home** has the same numbers added up across all your projects, with a line per project; its **Statistics** link opens that project's page.

Steps finished before Progressor kept finish times count on the day they last changed, and steps without a time or an estimate are left out of the comparison, never guessed.

## Search

The search box at the top (press `/` to jump to it) finds projects, goals and steps across all your projects. Click a result to open it.

## Help and Settings

- **❓ Help**: report a problem or suggest an idea. Both open a form on GitHub with your Progressor version and system already filled in.
- **⚙️ Settings**: the view a goal opens in, light or dark, and whether finished goals wait for you to look. Under **Advanced**: the code editor files open in, showing hidden goals, and the Progressor servers running on your computer. Settings are saved in your browser.
- **If the page is out of date**, a bar at the bottom says so, with a **Refresh** button: when Progressor was updated after you opened the page, or when the page has been out of touch with Progressor for a minute. It goes away by itself once things are back to normal.
- **The green dot** at the top means the page is live. If it turns orange and says *Reconnecting…*, Progressor has closed (it runs while your AI's app is open); it comes back by itself when the app is open again.

---

## For the technically curious

### Choosing the code editor

With **File names** on, clicking a file opens it in VS Code by default. Pick another under **⚙️ Settings → Advanced → Open files in**, or set it for a project with `PROGRESSOR_EDITOR` in the MCP server's environment:

| `PROGRESSOR_EDITOR` | Opens |
| --- | --- |
| `vscode` (default), `vscode-insiders`, `vscodium`, `cursor`, `windsurf`, `zed` | the file at the line, by its full path |
| `idea` (or `jetbrains`), `webstorm`, `pycharm`, `phpstorm`, `goland`, `rider`, `rubymine`, `clion`, `rustrover` | the file in the open project, through [JetBrains Toolbox](https://www.jetbrains.com/toolbox-app/) |
| a URL template, such as `myeditor://open?file={path}&line={line}` | anything else: `{path}` is the full path, `{relPath}` the path inside the project, `{project}` the folder name and `{line}` the line |

### One dashboard for every project

Every Progressor server adds its project folder to a list for your user, `~/.progressor/projects.json` (`PROGRESSOR_REGISTRY` points it elsewhere). Whichever Progressor holds the port serves every project on that list; if it ends, the next one to start takes over. Projects whose folder has gone are not shown. To take a project off the list, delete its entry from the file.

The dashboard listens only on your own computer (`127.0.0.1`, and `::1` where there is IPv6), on port 4747 (`PROGRESSOR_PORT` changes it). If that port is taken it uses the next free one; the `Dashboard:` line at the end of `get_status` always has the right address. `PROGRESSOR_DASHBOARD=off` runs Progressor without it.

### What the dashboard can change

Only a few things, all from the dashboard's own page: stopping a Progressor server, marking a hand test, talking with your AI (sending or taking back a message, answering a question), editing the project notes (adding, rewording or removing a rule, and rewriting About this project), and changing the wishlist (adding, rewording, ticking off or removing a wish); your AI is told about each change. Each is a `POST` that needs a custom header and the page's own `Origin`, which another website cannot send, and the dashboard answers only requests addressed to localhost. A mark, message, answer or note is written through the same code as your AI's tools, while holding the plan's lock, so it can't collide with your AI writing at the same time. The request format is in the [reference](reference.md#the-dashboards-write-endpoint).

### The dashboard without an AI running

To open the dashboard on all the projects in a folder, with no AI app open:

```bash
progressor-mcp dashboard C:\Projects
```

Progressor looks through that folder and its subfolders (5 levels deep, skipping `node_modules`, `.git`, build output and hidden folders) for projects with a plan, and opens an overview of them. Nothing is created or changed. The folder is remembered in `~/.progressor/workspaces.json`, so its projects keep showing later; `progressor-mcp dashboard --forget <folder>` stops that, and `--no-open` prints the address without opening the browser.

### Running servers

**⚙️ Settings → Advanced** lists the Progressor servers running on your computer: one per open AI chat, plus any `progressor-mcp dashboard`. For each it shows the project, the goals it's working on (a chat can work on several at once), its memory and when it started. **Stop** ends one after you confirm; that chat loses Progressor until it starts again. Stopping the one serving the dashboard hands it to another within a few seconds.
