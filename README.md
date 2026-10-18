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

`npm run build` compiles to `dist/`; `node dist/cli.js` starts the server on stdio. The web dashboard described in [ADR 0001](docs/adr/0001-mcp-server-hosts-the-dashboard.md) is not built yet.
