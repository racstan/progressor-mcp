# The dashboard

The dashboard is a page in your browser that shows what your AI is doing, live. Open **http://localhost:4747** while your AI's app is open: your AI gives you the exact link when it starts, or ask it *"Where's the dashboard?"*. Keep it beside your AI's window, or in a tab. It updates by itself; you never need to refresh.

The dashboard only shows. To change anything in the plan, tell your AI.

## At the top of a goal

A banner says, in one glance:

- **What the AI is working on**: *Contact form: working on "Send the email"*.
- **Finished when**: what done looks like for this goal.
- **The status line**, with a coloured dot:
  - 🟢 **AI working** · step 3 of 7 · last update 2 min ago: your AI is on it.
  - 🟠 **AI waiting**: your AI's chat is open, but nothing has changed for 15 minutes. It's most likely waiting for you: check the chat.
  - 🟠 **AI stopped**: the chat that was working on this has closed. Open a chat and say *"carry on"*.
  - **Paused**: no AI is working on this goal right now.
  - **Not started**, **Finished** or **Cancelled**.

When the AI is on a side trip, the banner turns orange and says what it's doing and why.

**Copy for your AI** copies a description of the goal that you can paste into any AI chat, to ask about it or change it.

## The map

Each step is a stop on a line, left to right. A filled stop with a tick is done; the pulsing one is being worked on now; empty ones are still to do. Long plans wrap onto several rows.

**Click any stop** to see what the step does, and to copy it for your AI. Scroll to zoom, drag the background to move around, and use **⤢** to fit the whole map on screen.

Three buttons at the top switch how you see it:

- **⇢ Across**: the map, left to right (the default).
- **⇣ Down**: the map, top to bottom, for long plans.
- **☰ List**: the steps as a plain list, with what each one does.

## The Show menu

**Show ▾** at the top chooses what you see besides the plan's steps:

- **Side trips** (on): times the AI stepped off the plan, as orange branches with how each ended.
- **Cancelled steps** (off): steps the AI decided not to do, crossed out. Click one to see why.
- **File names** (off): the files each step changes, with buttons to open them in your code editor.

Your choices are remembered in your browser.

## Your goals

The sidebar lists **Your goals** for the project, in the order they'll be done, each with a progress bar and its status. Click one to see its map.

A goal that finishes turns green and gets a green dot until you've looked at it; then it moves to **Finished** at the bottom. Right-click a goal to hide it from the list (the plan keeps it), or to move a finished one along without opening it.

If you use Progressor in several projects, click the project name at the top of the sidebar to switch, or pick **🗂 All projects** for an overview of every project at once.

## Search

The search box at the top (press `/` to jump to it) finds projects, goals and steps across all your projects. Click a result to open it.

## Help and Settings

- **❓ Help**: report a problem or suggest an idea. Both open a form on GitHub with your Progressor version and system already filled in.
- **⚙️ Settings**: the view a goal opens in, light or dark, and whether finished goals wait for you to look. Under **Advanced**: the code editor files open in, showing hidden goals, and the Progressor servers running on your computer. Settings are saved in your browser.
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

### The dashboard without an AI running

To open the dashboard on all the projects in a folder, with no AI app open:

```bash
progressor-mcp dashboard C:\Projects
```

Progressor looks through that folder and its subfolders (5 levels deep, skipping `node_modules`, `.git`, build output and hidden folders) for projects with a plan, and opens an overview of them. Nothing is created or changed. The folder is remembered in `~/.progressor/workspaces.json`, so its projects keep showing later; `progressor-mcp dashboard --forget <folder>` stops that, and `--no-open` prints the address without opening the browser.

### Running servers

**⚙️ Settings → Advanced** lists the Progressor servers running on your computer: one per open AI chat, plus any `progressor-mcp dashboard`. For each it shows the project, the goal it's working on, its memory and when it started. **Stop** ends one after you confirm; that chat loses Progressor until it starts again. Stopping the one serving the dashboard hands it to another within a few seconds.
