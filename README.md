# Progressor

Progressor keeps an AI coding Agent and you, the Developer, focused on the same Goal across long sessions, context compression and distractions. It is an [MCP](https://modelcontextprotocol.io) server: your Agent's app starts it, and the Agent uses its tools to keep a live record of what is planned, what is done, and what came up along the way.

The record is plain markdown inside your project, in `.progressor/`, so it is readable, diffable and travels with the repo. See [GLOSSARY.md](GLOSSARY.md) for the words used here and [docs/markdown-format.md](docs/markdown-format.md) for the file format.

## Install

With Claude Code, from your project folder:

```bash
claude mcp add progressor -- npx -y progressor-mcp
```

Any other MCP client can run the same command over stdio: `npx -y progressor-mcp`. Progressor needs Node 22 or later. It keeps its files in the folder the client starts it in; set `PROGRESSOR_ROOT` to use another folder.

## How it works

1. **Goals** live on the Roadmap, `.progressor/roadmap.md`. Each Goal has a **Plan File**, `.progressor/goals/<goal>.md`, with its **Tasks**.
2. Each Agent conversation is a **Session**. A Session **claims** one Goal, so two conversations never work on the same Goal at once. When the conversation ends, the Claim is released and the Goal is paused until a Session claims it again.
3. At the start of a conversation, and after its context has been compressed, the Agent calls `get_status` to see the Goal, the current Task, any open Detour, the next Task and your Standing Instructions.
4. When the Agent has to do something that is not the current Task, it declares a **Detour** with a Reason instead of drifting silently. It ends the Detour in one of three ways:
   - **Merge back**: a small fix, done; the plan is unchanged.
   - **Return**: back to the plan, optionally adding the Detour's intended work as new Tasks at the end.
   - **Recalibration**: the remaining Tasks are dropped and replaced by a new Task list.
5. Features that come up but are not needed now are parked as **Ideas**, and can later be **promoted** to a Task or a Goal.
6. Lasting rules you give the Agent ("ask me before recalibrating") are saved as **Standing Instructions** and shown in every `get_status`, so they survive context compression and new conversations.

You steer by talking to the Agent; it is the only writer of the `.progressor/` files. You can still edit them by hand: Progressor keeps everything it does not recognise and only rewrites the lines it changes.

Every item has a ref such as `progressor://ship-oauth-login/t2` that you can paste into the chat; the Agent looks it up with `get_item`.

## The dashboard

While your Agent's app is running Progressor, open **http://localhost:4747/** in a browser. The Agent also gets the address in every `get_status` (a `Dashboard:` line) and can tell you, and the server prints it to its log. It is served by the same process as the MCP tools, so there is nothing else to install or start.

The dashboard shows the selected Goal as a metro map: Tasks are stops on a line, Detours are orange branches labelled with how they ended (Merge back, Returned, Recalibrated or open), and Tasks dropped by a Recalibration stay on the old line, faded. A banner shows what is happening now: the current Task, or the open Detour and where it branched from. The sidebar lists the Roadmap with each Goal's progress, your Standing Instructions and the parked Ideas. The page updates by itself as the markdown changes.

- **Zoom** with the mouse wheel or the + / − buttons, **pan** by dragging the background, and **fit** the whole map with ⤢. Stops can be dragged; they spring back when you let go.
- Click any stop, Idea or Standing Instruction for **Copy as prompt**: a self-describing text (what it is, its status, its `progressor://` ref, file and line, its Goal, where it branched from, its Reason, its neighbours and the code it touches) to paste into your Agent chat.
- **Open in file** opens the Plan File at the item's line, or the code a Task touches, in your editor.
- The **Detours** switch hides the Detours from the view only; `[` collapses the sidebar; the sun / moon button switches between light and dark.

The dashboard is view-only: you change the plan by talking to the Agent.

### Choosing the editor

"Open in file" uses VS Code by default. Pick another editor from the **Open in** menu in the dashboard (remembered in that browser), or set it for the project with `PROGRESSOR_EDITOR` in the MCP server's environment:

```bash
claude mcp add progressor -e PROGRESSOR_EDITOR=cursor -- npx -y progressor-mcp
```

| `PROGRESSOR_EDITOR`                                                                 | Opens                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `vscode` (default), `vscode-insiders`, `vscodium`, `cursor`, `windsurf`, `zed`       | the file at the line, by its full path     |
| `idea` (or `jetbrains`), `webstorm`, `pycharm`, `phpstorm`, `goland`, `rider`, `rubymine`, `clion`, `rustrover` | the file in the open project, through [JetBrains Toolbox](https://www.jetbrains.com/toolbox-app/) |
| a URL template, such as `myeditor://open?file={path}&line={line}`                   | anything else: `{path}` is the full path, `{relPath}` the path inside the project, `{project}` the folder name and `{line}` the line |

### Ports and several Sessions

The dashboard listens on `127.0.0.1` only, port 4747 by default (`PROGRESSOR_PORT` changes it). When several Agent conversations work on the same project, the first one serves the dashboard and the others point to it; if that one ends, the next `get_status` from another conversation takes over. A port used by another project's dashboard, or by another program, is skipped for the next free one. Set `PROGRESSOR_DASHBOARD=off` to run without the dashboard.

## Example

```markdown
# Ship OAuth login

## Tasks

- [x] Add the /login route ^t1
  - code: `src/routes/login.ts`
- [/] Handle the OAuth callback ^t2
- [ ] Add logout ^t3

## Detour: Fix flaky token refresh ^d1

- branched from: ^t2
- reason: The callback tests fail randomly because token refresh races the cookie write
- status: open
```

## Tools

| Tool                       | What it does                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| `get_status`               | Summary of the claimed Goal, current Task, open Detour, next Task and Standing Instructions. |
| `get_item`                 | Looks up any item by ref, with its file and line.                            |
| `add_goal`                 | Adds a Goal to the Roadmap, with an optional Task list.                      |
| `claim_goal`               | Claims a Goal for this Session (pausing any other it held).                  |
| `release_goal`             | Releases the Claim; the Goal is paused.                                      |
| `complete_goal`            | Marks the claimed Goal done.                                                 |
| `add_tasks`                | Appends Tasks to the claimed Goal.                                           |
| `start_task`               | Marks a Task in progress (one at a time).                                    |
| `complete_task`            | Marks a Task done, recording the code paths it touched.                      |
| `drop_task`                | Drops a Task with a reason.                                                  |
| `start_detour`             | Declares a Detour, with a Reason, branching from the current Task.           |
| `end_detour`               | Ends the open Detour: merge back, return or recalibrate.                     |
| `record_idea`              | Parks an Idea for later.                                                     |
| `promote_idea`             | Turns an Idea into a Task or a Goal.                                         |
| `add_standing_instruction` | Saves a lasting rule from the Developer.                                     |

## Development

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` compiles the server to `dist/` and bundles the dashboard (React, in `src/ui/`) into `dist/ui/`; `node dist/cli.js` starts the server on stdio. To try the dashboard without an MCP client, serve it for a project folder (by default the sample in `test/fixtures/sample-project`):

```bash
node scripts/dashboard.mjs test/fixtures/sample-project
```

`npm run dev:ui` rebuilds the page on every change; reload the browser to see it. The server side of the dashboard is in `src/dashboard/`: the HTTP server and API (`http.ts`), the file watcher (`watch.ts`), and the pure logic shared with the page: the metro map layout (`graph.ts`), the Copy-as-prompt text (`prompt.ts`) and the editor links (`editor.ts`).
