# Progressor markdown format

Progress lives in two kinds of file inside the project (see [ADR 0002](adr/0002-progress-stored-as-markdown.md)):

- `.progressor/roadmap.md`: the Roadmap (Goals), Ideas and Standing Instructions.
- `.progressor/goals/<goal-id>.md`: one Plan File per Goal, holding its Tasks and Detours.

The files are written by the Agent through Progressor's tools, but they are ordinary markdown that a person can read in any viewer and edit by hand. This document is the contract between the two.

## Example: roadmap.md

```markdown
# Roadmap

## Goals

- [/] [Ship OAuth login](goals/ship-oauth-login.md) ^ship-oauth-login
  - claimed by: s-7f3a (pid 18244) since 2026-10-18T15:02:11.000Z
  - outcome: Users can sign in with Google and stay signed in across restarts
- [ ] [Billing](goals/billing.md) ^billing
- [x] [Project setup](goals/project-setup.md) ^project-setup

## Ideas

- Remember-me checkbox on the login form ^i1
- Rate-limit the token endpoint ^i2
  - promoted to: progressor://ship-oauth-login/t6

## Standing Instructions

- Ask me before recalibrating ^s1
- Run the tests before completing a Task ^s2
```

## Example: goals/ship-oauth-login.md

```markdown
# Ship OAuth login

## Tasks

- [x] Add the /login route ^t1
  - summary: Serve the login page and redirect to the provider with the client ID and state.
  - code: `src/routes/login.ts`
- [/] Fix callback redirect loop ^t2
  - summary: Callback re-sets the session cookie on every hit; only set it after token exchange.
  - code: `src/auth/callback.ts`
  - code: `src/auth/session.ts:42`
- [-] Store tokens in cookies ^t3
  - dropped by: ^d1
- [ ] Store tokens server-side ^t4
  - added by: ^d1
- [ ] Add logout ^t5
  - added by: ^d1

## Detour: Fix flaky token refresh ^d1

- branched from: ^t2
- reason: The callback tests fail randomly because token refresh races the cookie write
- status: recalibrated
```

## Items and their IDs

Every item ends its line with an ID marker: a space, a caret and the ID (`^t2`). The caret form is short, survives most markdown renderers as plain text, and is the block-reference syntax some editors (Obsidian) already understand.

| Item                 | Where                                   | ID form            | Ref                              |
| -------------------- | --------------------------------------- | ------------------ | -------------------------------- |
| Goal                 | `## Goals` in roadmap.md                | slug of the title  | `progressor://<goal>`            |
| Task                 | `## Tasks` in a Plan File               | `t1`, `t2`, ...    | `progressor://<goal>/t2`         |
| Detour               | `## Detour: ...` heading in a Plan File | `d1`, `d2`, ...    | `progressor://<goal>/d1`         |
| Idea                 | `## Ideas` in roadmap.md                | `i1`, `i2`, ...    | `progressor://roadmap/i1`        |
| Standing Instruction | `## Standing Instructions`              | `s1`, `s2`, ...    | `progressor://roadmap/s1`        |

IDs are never reused within a file: a new ID is one more than the highest number already in that file (including dropped items). `roadmap` is therefore not allowed as a Goal ID. Inside a file, a reference to another item in the same file is written as `^t2`; anywhere else it is the full `progressor://` ref.

Every item also has a line number: the 1-based line of its item line (for a Detour, its heading). Line numbers are not stored; they come from parsing, so they always point at the right place even after hand edits.

## Tasks: title, files and summary

Every Task has three parts. Its **title** is the item line: a few words, such as "Fix callback redirect loop". Its **files** are its `code` lines. Its **summary** is a `summary` line: one or two sentences on the fix or change it makes. The title is required; files and summary are optional, so a Task typed by hand as a single line is still valid. A summary is kept on one line: line breaks given to the tools become spaces.

When Progressor writes a Task, its known details come first, in this order: `summary`, `code`, `added by`, `dropped by`, `reason`. Unknown details follow in the order they were in.

## Status markers

Tasks and Goals are checklist lines. The character in the brackets is the status:

| Marker | Task        | Goal                                              |
| ------ | ----------- | ------------------------------------------------- |
| `[ ]`  | pending     | planned (not started)                             |
| `[/]`  | in progress | started: active while claimed, paused otherwise   |
| `[x]`  | done        | done                                              |
| `[-]`  | dropped     | dropped                                           |

`[X]` is read as done. At most one Task in a Plan File is in progress; it is the current Task.

## Detail lines

Facts about an item are indented list lines under it, in the form `key: value`:

| Under    | Key            | Meaning                                                                  |
| -------- | -------------- | ------------------------------------------------------------------------ |
| Task     | `summary`      | One or two sentences on the fix or change the Task makes, on one line.   |
| Task     | `code`         | A file the Task touches, in backticks; may end in `:line`. Repeatable.   |
| Task     | `added by`     | The Detour whose Return or Recalibration added this Task (`^d1`).        |
| Task     | `dropped by`   | The Detour whose Recalibration dropped this Task (`^d1`).                |
| Task     | `reason`       | Why the Task was dropped, when dropped directly.                         |
| Goal     | `claimed by`   | The Claim: `<session> (pid <pid>) since <ISO time>`.                     |
| Goal     | `outcome`      | The Outcome: what done looks like, on one line.                          |
| Goal     | `reason`       | Why the Goal was dropped.                                                |
| Idea     | `promoted to`  | The ref of the Task or Goal it was promoted to.                          |
| Idea     | `note`         | Free text recorded with the Idea.                                        |

A Detour's facts are the list lines directly under its heading:

| Key             | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `branched from` | The Task the work split off from (`^t2`), if one was in progress.        |
| `reason`        | The Reason for the Detour.                                               |
| `status`        | `open`, `merged back`, `returned` or `recalibrated`.                     |

## How the Detour endings show up

- **Merge back**: the Detour's status becomes `merged back`. Nothing else changes.
- **Return**: status `returned`. Any Tasks for the Detour's intended work are appended to the end of `## Tasks`, each with `added by: ^dN`.
- **Recalibration**: status `recalibrated`. Every Task that was still pending or in progress becomes `[-]` with `dropped by: ^dN` (it stays in place, so the dropped list is still readable), and the new Task list is appended to the end of `## Tasks` with `added by: ^dN`.

New Detour sections are appended to the end of the Plan File. A Plan File has at most one open Detour.

## Claims

A Claim is a `claimed by` line under a Goal in roadmap.md. The session is the Progressor server process the Agent's app started, so a Claim also records that process's pid: if the pid is no longer running, the Claim is stale and another Session may take the Goal over. Releasing a Claim removes the line and leaves the Goal `[/]`, which reads as paused.

## Hand edits

The parser never rejects a file. It recognises what it can and keeps everything else:

- **Round trip.** Parsing a file and serialising it without changes gives back the same bytes, including line endings (LF or CRLF), blank lines, unknown sections, comments and stray text.
- **Untouched items are copied verbatim.** When the Agent changes one item, only that item's lines are rewritten in the canonical form above; every other line keeps its original spelling (`* [ ]`, `[X]`, extra spaces and so on).
- **Items without an ID** (a Task line typed by hand, say) are recognised and get the next free ID the next time Progressor writes that file.
- **Unknown detail lines** under an item are kept, after the known ones, when that item is rewritten.
- **Unknown sections** (any `##` heading other than the ones above) and anything before the first `##` heading are kept as they are.
- **Missing sections** are created at the end of the file when something needs to go in them.
- Only top-level list lines (no indentation) are items. Indented lines belong to the item above them.
