# Progressor markdown format

Progress lives in two kinds of file inside the project (see [ADR 0002](adr/0002-progress-stored-as-markdown.md)):

- `.progressor/roadmap.md`: the Roadmap (Goals) and Standing Instructions. Roadmaps from before 0.6 may also hold Ideas, which are still read but no longer added.
- `.progressor/goals/<goal-id>.md`: one Plan File per Goal, holding its Tasks, decisions, notes, hand tests and Detours.
- `.progressor/context.md`: the project's Important context, free-form markdown under a `# Important context` heading (at most 4000 characters). It has no items or IDs; `update_context` replaces it whole.

The files are written by the Agent through Progressor's tools, and they are ordinary markdown that a person can read in any viewer. Changes should go through the tools (ask the Agent), which keep the files consistent; but the parser is forgiving, so a hand edit never breaks a file (see [Hand edits](#hand-edits)). This document is the contract between the files and the tools.

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
- Never commit secrets ^s3
  - hard: yes
- At most 2 helper agents at a time ^s4
  - helpers at once: 2
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
- [/] Try the login on a phone ^t6
  - state: waiting on you
- [x] Publish the auth package ^t7
  - state: released
  - estimate: 45m
  - time spent: 1h 10m
- [/] Add the session store ^t8
  - state: with a helper
  - estimate: 2h
  - time spent: 20m
  - timing since: 2026-10-26T10:00:00.000Z

## Decisions

- Keep the old session cookie name, so existing logins survive ^c1

## Notes

- [ ] The settings page logs the token in the console ^n1
  - from: progressor://billing
- [x] Typo on the login button ^n2

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
| Decision             | `## Decisions` in a Plan File           | `c1`, `c2`, ...    | `progressor://<goal>/c1`         |
| Note                 | `## Notes` in a Plan File               | `n1`, `n2`, ...    | `progressor://<goal>/n1`         |
| Hand test            | `## Hand tests` in a Plan File          | `h1`, `h2`, ...    | `progressor://<goal>/h1`         |
| Idea                 | `## Ideas` in roadmap.md                | `i1`, `i2`, ...    | `progressor://roadmap/i1`        |
| Standing Instruction | `## Standing Instructions`              | `s1`, `s2`, ...    | `progressor://roadmap/s1`        |

IDs are never reused within a file: a new ID is one more than the highest number already in that file (including dropped items). `roadmap` is therefore not allowed as a Goal ID. Inside a file, a reference to another item in the same file is written as `^t2`; anywhere else it is the full `progressor://` ref.

Every item also has a line number: the 1-based line of its item line (for a Detour, its heading). Line numbers are not stored; they come from parsing, so they always point at the right place even after hand edits.

## Tasks: title, files and summary

Every Task has three parts. Its **title** is the item line: a few words, such as "Fix callback redirect loop". Its **files** are its `code` lines. Its **summary** is a `summary` line: one or two sentences on the fix or change it makes. The title is required; files and summary are optional, so a Task typed by hand as a single line is still valid. A summary is kept on one line: line breaks given to the tools become spaces.

When Progressor writes a Task, its known details come first, in this order: `state`, `summary`, `code`, `helper`, `helper branch`, `helper folder`, `evidence`, `checked since`, `estimate`, `time spent`, `timing since`, `moved from`, `added by`, `from hand test`, `dropped by`, `reason`, `updated from`. Unknown details follow in the order they were in.

## Status markers

Tasks and Goals are checklist lines. The character in the brackets is the status:

| Marker | Task        | Goal                                              |
| ------ | ----------- | ------------------------------------------------- |
| `[ ]`  | pending     | planned (not started)                             |
| `[/]`  | in progress | started: active while claimed, paused otherwise   |
| `[x]`  | done        | done                                              |
| `[-]`  | dropped     | dropped                                           |

`[X]` is read as done. At most one Task in a Plan File is in progress; it is the current Task.

### Task states beyond the checkbox

A Task can also be in one of four more states. Each is a `state` line under a checkbox, so the line reads plainly and a reader that does not know the state still sees the Task as started or done:

| Checkbox and line                 | State            | Meaning                                                              |
| --------------------------------- | ---------------- | -------------------------------------------------------------------- |
| `[/]` with `state: with a helper` | with a helper    | Handed to a helper agent that is working on it.                      |
| `[/]` with `state: waiting on you`| waiting on you   | The Agent is waiting on the Developer, such as to test something by hand. |
| `[/]` with `state: checked`       | checked          | The Agent checked a helper's work (tests, review); not merged yet.   |
| `[x]` with `state: released`      | released         | Merged and out: shipped, installed or published.                     |

A `state` line counts only under the checkbox in the table; under any other checkbox, or with any other value, it is ignored (and kept, like any unknown detail), and the checkbox alone gives the state. Several Tasks can be with a helper, waiting on you or checked at once; they are not the current Task. Released counts as done in progress counts. A Goal can be completed once each of its Tasks is done, released or dropped. While any Task is waiting on you, the Goal is waiting on the Developer.

### Helper info and evidence

Handing a Task to a helper can record where its work is, and checking it can record what was checked. All of these lines are optional and extra, so a plan from before them reads as having none, and an older Progressor keeps them as unknown details:

```markdown
- [/] Add the session store ^t8
  - state: checked
  - helper: Sonnet
  - helper branch: feat/session-store
  - helper folder: /home/me/wt-session-store
  - evidence: 715 passed, live send OK
  - checked since: 2026-10-27T09:30:00.000Z
```

The helper lines are written when the Task is set to "with a helper" and are **kept** after that, through checked, done, released and dropped: they are how a branch left behind is found (see [the orphan warning](reference.md#helper-work-left-behind)). Giving them again replaces only the parts given. `evidence` is written with "checked" and kept through done and released, but removed if the Task goes back to a helper, to waiting on you, to in progress or to pending, since the check no longer holds. `checked since` is added when the Task becomes checked and removed when it stops being checked. Values are kept on one line.

## Detail lines

Facts about an item are indented list lines under it, in the form `key: value`:

| Under    | Key            | Meaning                                                                  |
| -------- | -------------- | ------------------------------------------------------------------------ |
| Task     | `state`        | One of the [states beyond the checkbox](#task-states-beyond-the-checkbox). |
| Task     | `summary`      | One or two sentences on the fix or change the Task makes, on one line.   |
| Task     | `code`         | A file the Task touches, in backticks; may end in `:line`. Repeatable.   |
| Task     | `helper`       | A label for the helper agent working on the Task, such as the model (`Sonnet`). Optional; written with `state: with a helper`. |
| Task     | `helper branch` | The git branch the helper works on (`feat/export`). Optional; written with `state: with a helper`. |
| Task     | `helper folder` | The helper's worktree folder (a path). Optional; written with `state: with a helper`. |
| Task     | `evidence`     | One short line on what was checked (`715 passed, live send OK`). Optional; written with `state: checked`. |
| Task     | `checked since` | The ISO time the Task became checked, while it is; written by the tools. |
| Task     | `estimate`     | How long the Task should take: `45m`, `2h`, `1h 30m`. A value that is not a time is ignored (and kept). |
| Task     | `time spent`   | Time worked on it in earlier stretches, in the same form; written by the tools. |
| Task     | `timing since` | The ISO time the stretch still running started, while the Task is in progress, with a helper, waiting on you or checked; written by the tools. |
| Task     | `moved from`   | The ref of the Task in another Goal this one was moved from (`progressor://billing/t4`). |
| Task     | `added by`     | The Detour whose Return or Recalibration added this Task (`^d1`).        |
| Task     | `from hand test` | The hand test whose failure added this Task (`^h2`).                   |
| Task     | `dropped by`   | The Detour whose Recalibration dropped this Task (`^d1`).                |
| Task     | `reason`       | Why the Task was dropped, when dropped directly.                         |
| Goal     | `claimed by`   | The Claim: `<session> (pid <pid>) since <ISO time>`.                     |
| Goal     | `outcome`      | The Outcome: what done looks like, on one line.                          |
| Goal     | `reason`       | Why the Goal was dropped.                                                |
| Goal     | `estimate`     | How long the Goal should take; it covers its open Tasks that have no estimate. Without it, the Goal's estimate is the sum of its open Tasks'. |
| Standing Instruction | `hard`  | `yes` (or `true`) for a hard rule that must never be broken; absent for a preference. |
| Standing Instruction | `helpers at once` | The project's helper limit, a whole number from 1: the most Tasks that may be with a helper at once. One rule holds it; the tools move it rather than add a second. Any other value is ignored. |
| Idea     | `promoted to`  | The ref of the Task or Goal it was promoted to.                          |
| Idea     | `note`         | Free text recorded with the Idea.                                        |
| Note     | `from`         | The ref of the Goal being worked on when the note was made, if another one. |
| Hand test | `task`        | The Task the test is about (`^t3`), if the Agent said.                   |
| Hand test | `note`        | What the Developer typed when it did not work, on one line.              |
| Hand test | `marked`      | The ISO time the Developer marked it.                                    |
| Hand test | `task added`  | The Task a failed result added (`^t7`); written by the tools.            |
| Hand test | `seen`        | `yes` once the Agent has been shown the mark in a status; written by the tools. |
| Goal, Task, decision, note, hand test | `updated from` | The project an Agent working elsewhere changed it from, and when: `<project name> at <ISO time>` (see [below](#changes-from-another-project)). |

A Detour's facts are the list lines directly under its heading:

| Key             | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `branched from` | The Task the work split off from (`^t2`), if one was in progress.        |
| `reason`        | The Reason for the Detour.                                               |
| `status`        | `open`, `merged back`, `returned` or `recalibrated`.                     |

## Decisions and notes

`## Decisions` holds choices made along the way for this Goal that are not lasting project rules (those are Standing Instructions), one plain list line each, such as `- Keep the old session cookie name ^c1`.

`## Notes` holds things spotted that belong to this Goal, often while working on another one: a checklist line each, `[ ]` while open and `[x]` once resolved. A plain list line with no checkbox reads as open. A note made while the Agent was working on a different Goal says which, with a `from` line.

Both sections are created when their first item is added, after the Tasks and before any Detour. Lines are reworded in place; a removed decision or note is deleted from the file.

## Hand tests

`## Hand tests` holds the things only the Developer can try by hand, such as "OpenCode may ask permission to read an attached file: allow it and check the reply". The Agent adds them; the Developer marks each one on the dashboard. One checklist line each, and the checkbox is the result:

| Checkbox | Result         | Meaning                                                    |
| -------- | -------------- | ---------------------------------------------------------- |
| `[ ]`    | not tried yet  | Nobody has marked it (a plain list line reads the same).   |
| `[x]`    | works          | The Developer tried it and it works.                       |
| `[/]`    | doesn't work   | It failed; the `note` line says how, and a Task was added. |
| `[-]`    | won't test     | The Developer chose not to test it.                        |

```markdown
## Hand tests

- [x] Sign in on a phone and stay signed in after a restart ^h1
  - task: ^t6
  - marked: 2026-10-28T09:12:00.000Z
  - seen: yes
- [/] Allow the permission prompt and check the page greets you by name ^h2
  - note: it asked twice, then froze
  - marked: 2026-10-28T09:14:00.000Z
  - task added: ^t9
- [ ] Log out and check the cookie is gone ^h3
```

The section is created after the Notes (or the Tasks) and before any Detour. A failed result adds a pending Task to the Goal, titled `Fix: <the test>` with a summary that holds the note, a `from hand test: ^h2` line and, on the test, the `task added` line that links back. Marking again or clearing drops that Task when nobody has started it. A hand test the Agent has not seen yet (no `seen` line) is shown to it once by `get_status`, which then adds `seen: yes`. A Goal cannot be completed while a hand test is not tried yet, unless the Agent passes `unmarked_hand_tests_ok`. Files from before this section read as having no hand tests; an older Progressor keeps the section as an unknown one.

## Hard rules

A Standing Instruction is a preference unless it has a `hard: yes` line, which makes it a hard rule: one that must never be broken. Any other value, or no line, reads as a preference, so Roadmaps from before the flag keep working and an older Progressor keeps the line as an unknown detail. Progressor lists hard rules first, marked `HARD RULE`, in `get_status`, at session start and in the rules block of `get_rules`, and the dashboard marks them with a **Must** label. Their order in the file is not changed.

## Estimates and time spent

`estimate` lines on Tasks and Goals and the `helpers at once` line on a Standing Instruction are optional, and only written when the Agent sets them. The tools time a Task by themselves: entering one of the timed states (in progress, with a helper, waiting on you, checked) adds a `timing since` line, unless one is there; leaving them (done, released, dropped, or pending, which pauses it) removes it and adds the stretch to `time spent`, rounded to the minute. A plan from before these lines reads as having no estimates, no time spent and no limit, and reading it changes nothing. A moved Task takes its estimate, time spent and running clock with it. See the [reference](reference.md#estimates-the-helper-limit-and-the-schedule) for how the schedule uses them.

## Moving a Task between Goals

`move_task` copies a Task into another Goal's Plan File, at the end of its `## Tasks` or right before or after one of its Tasks, with a new ID (one more than the highest in that file). The copy has the same checkbox and `state`, title, `summary` and `code` lines, plus `moved from: progressor://<old goal>/<old id>`. The old Task stays in its Plan File as `[-]` with `reason: Moved to the goal "<title>" (progressor://<new goal>/<new id>)` (the dashboard leaves out the bracketed ref), so its ID is never reused, `progressor://` refs to it still resolve, and any Detour that `branched from` it or Task it `added by` still points at a line that exists. Nothing is deleted: the Goal's counts leave the old Task out, as for any dropped Task.

## Changes from another project

An Agent working in another project can change this project's plan through the tools' `project` input. Each Goal, Task, decision or note it adds or changes gets an `updated from` line naming the project it worked in (the folder name) and when:

```markdown
- [x] [Release 0.7.1](goals/v0-7-1.md) ^v0-7-1
  - updated from: rachitkdeaichat at 2026-10-26T12:00:00.000Z
```

A later change from elsewhere replaces the line; a change made in the project itself leaves it. A value without ` at <time>` (written by hand) still names the project. The line is read by the dashboard (the **Updated from** tag) and by the project's own Session, which is told about changes newer than the last time it looked.

## How the Detour endings show up

- **Merge back**: the Detour's status becomes `merged back`. Nothing else changes.
- **Return**: status `returned`. Any Tasks for the Detour's intended work are appended to the end of `## Tasks`, each with `added by: ^dN`.
- **Recalibration**: status `recalibrated`. Every Task that was not yet done, released or dropped becomes `[-]` with `dropped by: ^dN` (it stays in place, so the dropped list is still readable), and the new Task list is appended to the end of `## Tasks` with `added by: ^dN`.

New Detour sections are appended to the end of the Plan File. A Plan File has at most one open Detour.

## Claims

A Claim is a `claimed by` line under a Goal in roadmap.md. One Session can hold several Goals at once. The session is the Progressor server process the Agent's app started, so a Claim also records that process's pid: if the pid is no longer running, the Claim is stale and another Session may take the Goal over. Releasing a Claim removes the line and leaves the Goal `[/]`, which reads as paused.

## Hand edits

The tools are the way to change the plan, but a file edited by hand, or merged by git, still works. The parser never rejects a file. It recognises what it can and keeps everything else:

- **Round trip.** Parsing a file and serialising it without changes gives back the same bytes, including line endings (LF or CRLF), blank lines, unknown sections, comments and stray text.
- **Untouched items are copied verbatim.** When the Agent changes one item, only that item's lines are rewritten in the canonical form above; every other line keeps its original spelling (`* [ ]`, `[X]`, extra spaces and so on).
- **Items without an ID** (a Task line typed by hand, say) are recognised and get the next free ID the next time Progressor writes that file.
- **Unknown detail lines** under an item are kept, after the known ones, when that item is rewritten.
- **Unknown sections** (any `##` heading other than the ones above; in a Plan File, `## Tasks`, `## Decisions`, `## Notes`, `## Hand tests` and `## Detour: ...` are known) and anything before the first `##` heading are kept as they are.
- **Missing sections** are created at the end of the file when something needs to go in them.
- Only top-level list lines (no indentation) are items. Indented lines belong to the item above them.
