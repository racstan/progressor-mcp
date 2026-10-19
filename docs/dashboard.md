# The dashboard

While your Agent's app is running Progressor, open **http://localhost:4747/** in a browser. It is one dashboard for every project you use Progressor in: pick the project in the sidebar. Each `get_status` ends with a `Dashboard:` line that links straight to that conversation's project (`http://localhost:4747/?project=<id>`), so the Agent can hand it to you; the server prints it to its log too. It is served by the same process as the MCP tools, so there is nothing else to install or start.

The dashboard shows the selected Goal in one of three views, picked in the top bar (⇢ Across, ⇣ Down, ☰ List). The view is remembered by your browser and kept in the address (`&view=vertical`, `&view=checklist`), so a link shows the same thing:

- **Metro, horizontal** (the default): a metro map running left to right. A plan too long for the screen wraps onto rows that turn back and forth like a snake, so the whole Goal fits at a readable size.
- **Metro, vertical**: the same map running top to bottom, so a long plan scrolls down. The mouse wheel scrolls it; Ctrl + wheel (or a pinch) zooms.
- **Checklist**: the Tasks as a list in plan order, each with its files and summary, and each Detour indented under the Task it branched from with how it ended and its Reason.

On the maps, Tasks are stops on a line with their files as small chips (the first file and "+n" on the horizontal map), Detours are orange branches labelled with how they ended (Merge back, Returned, Recalibrated or open), and Tasks dropped by a Recalibration stay on the old line, faded. A banner shows what is happening now: the current Task, or the open Detour and where it branched from. The sidebar has the project switcher (every project's name and folder, those with work in progress first) and the Roadmap with each Goal's progress, under the full path of the project folder it comes from. The **❓ Help** menu in the top bar has links to report a problem or share an idea, your Standing Instructions and the parked Ideas. Only one project is shown at a time, and the page updates by itself as its markdown changes.

- **Search** with the box in the top bar (press `/` or Ctrl+K): as you type it lists the matching projects, Goals, Tasks and Ideas across every project, matching titles, Outcomes, summaries, notes and folders. Arrow keys and Enter, or a click, open a result: a Task opens on its Goal's map with its details. On the overview, the project cards narrow to the ones with results.
- **Zoom** with the mouse wheel or the + / − buttons, **pan** by dragging the background, and **fit** the whole map with ⤢. Stops can be dragged; they spring back when you let go.
- Click any Task, Detour, Idea or Standing Instruction for its details (a Task's summary, a Detour's Reason) and **Copy as prompt**: a self-describing text (what it is, its status, its `progressor://` ref, file and line, its Goal, its summary, where it branched from, its Reason, its neighbours and the files it touches) to paste into your Agent chat.
- **Open in file** opens the Plan File at the item's line, or the code a Task touches, in your editor.
- The **Detours** switch hides the Detours from the view only; `[` collapses the sidebar. The sun / moon button switches between light and dark.
- When a Goal is finished it turns green and gets a green dot in the sidebar until you open it; then it moves to the **Done** group at the bottom. Right-click a Goal to hide it from the list, or to move a finished one to Done without opening it.
- **🖥 Servers** shows how many Progressor processes are running: one per Agent conversation, plus any `progressor-mcp dashboard` command. For each it lists the project and folder, the Goal its Session holds, its memory and when it started, and marks the one serving the dashboard. **Stop** ends one after a confirm; that conversation loses Progressor's tools until it restarts. Stopping the one serving the dashboard hands the dashboard to another running server within a few seconds. Servers from 0.3.0 or older are not listed.
- **⚙️ Settings** sets the view a Goal opens in (Across, Down or List), the theme (light, dark or match the system), the editor for "Open in file", whether finished Goals wait for you or go to Done straight away, and whether hidden Goals are shown. Settings are saved in that browser.

The dashboard is view-only, apart from stopping servers: you change the plan by talking to the Agent. Hiding a Goal or moving it to Done changes only what your browser shows. To add work to a finished Goal, ask the Agent: claiming the Goal again reopens it, and the new Tasks join the same list.

## Choosing the editor

"Open in file" uses VS Code by default. Pick another editor under **Open files in** in the dashboard's ⚙️ Settings (remembered in that browser), or set it for the project with `PROGRESSOR_EDITOR` in the MCP server's environment:

```bash
claude mcp add progressor -e PROGRESSOR_EDITOR=cursor -- npx -y progressor-mcp
```

| `PROGRESSOR_EDITOR`                                                                 | Opens                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `vscode` (default), `vscode-insiders`, `vscodium`, `cursor`, `windsurf`, `zed`       | the file at the line, by its full path     |
| `idea` (or `jetbrains`), `webstorm`, `pycharm`, `phpstorm`, `goland`, `rider`, `rubymine`, `clion`, `rustrover` | the file in the open project, through [JetBrains Toolbox](https://www.jetbrains.com/toolbox-app/) |
| a URL template, such as `myeditor://open?file={path}&line={line}`                   | anything else: `{path}` is the full path, `{relPath}` the path inside the project, `{project}` the folder name and `{line}` the line |

## One dashboard for every project

Every Progressor server adds its project folder to a per-user list, `~/.progressor/projects.json` (`PROGRESSOR_REGISTRY` points it elsewhere). Whichever Progressor process holds the port serves every project on that list, reading each project's `.progressor/` files straight from disk; the others link to it. If that process ends, the next Progressor server to start, or the next `get_status` from one already running, takes over. Projects whose folder or `.progressor/` has gone are not shown. To take a project off the list, delete its entry from the file.

The dashboard listens on the loopback address only (`127.0.0.1`, and `::1` where there is IPv6), port 4747 by default (`PROGRESSOR_PORT` changes it). A port held by another program is skipped for the next free one. Set `PROGRESSOR_DASHBOARD=off` to run without the dashboard.

## Workspaces: every project in a folder

If your projects live under one folder, open the dashboard on it from anywhere, with no Agent running:

```bash
progressor-mcp dashboard C:\Programming
```

Progressor looks through that folder and its subfolders for projects: folders with a `.progressor/roadmap.md`. It skips `node_modules`, `.git`, build output and other hidden or dependency folders, and goes 5 levels deep. Nothing is created or changed; a folder only becomes a project once an Agent adds a Goal in it. The dashboard opens in your browser on an overview of that Workspace, with each project's Goals in progress, how far along they are, and a green note when a Goal has finished since you last looked. Click a project or a Goal to open it.

The folder is remembered as a Workspace in `~/.progressor/workspaces.json`, so the dashboard keeps showing its projects even when it is started by an Agent later. New projects in a Workspace show up within a few minutes, or straight away when you run the command again. `progressor-mcp dashboard --forget <folder>` stops showing a Workspace; `--no-open` prints the address without opening the browser. Without a folder, the command uses the current one.

When the dashboard shows more than one project, its start page is the overview of them all (**🗂 All projects** in the switcher), one card per project, those with work in progress first.
