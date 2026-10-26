# Progressor

Progressor keeps an AI agent and the human it works with focused on the same goal across long sessions, context compression and distractions, by keeping a shared, live record of what is planned, what is done, and what came up along the way.

These are the terms the code, the Agent's tools and the files use. Everything a person reads (the dashboard and the guides) says them in everyday words instead: a Task is a *step*, a Detour a *side trip*, the Roadmap *Your goals*, an Outcome *Finished when*, dropped is *cancelled*, a Task waiting on the Developer is *waiting on you*. The [reference](docs/reference.md) has the full list.

## Language

### People

**Developer**:
The human working on the project alongside the Agent.
_Avoid_: User, human, owner

**Agent**:
The AI coding assistant that keeps the progress record up to date while it works, and makes planning decisions unless the Developer takes them over.
_Avoid_: AI, assistant, bot, model

**Standing Instruction**:
A lasting rule from the Developer about how the Agent should behave, such as "ask me before recalibrating", kept so it survives context compression and new Sessions. One the Developer says must never be broken is a **hard rule**: it is listed first, marked HARD RULE (the dashboard says *Must*), and goes into every helper agent's brief.
_Avoid_: Preference, setting, rule

**Helper limit**:
The most Tasks that may be with a helper at once in a Project, set on one Standing Instruction (such as "at most 2 helpers in parallel"). Handing out one more is not refused, but warned about. Without one there is no limit.
_Avoid_: Concurrency, max parallel, quota

**Important context**:
The one page per Project holding its lasting background (what it is, key facts, choices that hold project-wide), written by the Agent and shown in full with the Standing Instructions at every session start. Not for rules, which are Standing Instructions.
_Avoid_: Notes, memory, project info

**Session**:
One Agent conversation, including any sub-agents it spawns, working on the Goals it has claimed: usually one, several when helper agents work on different Goals.
_Avoid_: Thread, chat, instance, connection

**Claim**:
A Session's exclusive hold on a Goal while it works on it; released when the Session ends, leaving the Goal paused.
_Avoid_: Lock, assignment

### Places

**Project**:
A folder that has been initialized for Progressor, meaning it has its own `.progressor/` holding its Roadmap.
_Avoid_: Repo, app, codebase

**Workspace**:
Any folder Progressor is pointed at, together with every Project found inside it.
_Avoid_: Root, parent folder, monorepo, directory

### Planning

**Roadmap**:
The ordered list of Goals for a project.
_Avoid_: Backlog, plan list

**Goal**:
An outcome being worked toward, such as "Ship OAuth login".
_Avoid_: Objective, epic, project

**Outcome**:
One line saying what done looks like for a Goal, used to judge whether it is finished.
_Avoid_: Acceptance criteria, definition of done, success metric

**Plan File**:
The markdown file that holds one Goal's Tasks, Decisions, Notes and Detours, and the place every one of them can be opened.
_Avoid_: Audit file, progress file, todo file

**Task**:
A planned step toward a Goal, with a short title, the files it touches and a summary of the change it makes. It is pending, in progress (the Agent's own current work, one per Goal), with a helper, waiting on you (the Agent is waiting on the Developer), checked (a helper's work checked, not yet merged), done, released (merged and out) or dropped. A Task that belongs in another Goal can be moved there: it gets a new ID in the other Goal, and the old one stays as a dropped trace saying where it went.
_Avoid_: Todo, item, step, ticket

**Estimate**:
How long a Task, or a Goal as a whole, is expected to take, such as 45m or 2h, set by the Agent when it plans and updated when it learns more. A Goal's estimate is the sum of its open Tasks' unless the Goal has one of its own.
_Avoid_: Points, effort, size

**Time spent**:
How long a Task actually took: clocked from when it is started or handed to a helper until it is done, released or dropped. Time while it is pending again (paused) does not count.
_Avoid_: Actual, duration, logged time

**Schedule**:
A rough plan in time worked out from the Estimates, the Roadmap's order and the Helper limit: what runs now, what comes next, and when each open Goal and the whole Roadmap should be done. Tasks without an Estimate are counted as not estimated, never guessed.
_Avoid_: Timeline, forecast, Gantt

**Decision**:
A choice made along the way for one Goal that is not a lasting project rule, such as "old models get thinking on/off only", kept in the Goal's Plan File so it survives context compression.
_Avoid_: Rule, choice, ADR

**Note**:
Something spotted that belongs to a Goal, often while working on another one, such as a bug found during cleanup that belongs to the Voice Goal; open until it is resolved.
_Avoid_: Todo, comment, issue

**Change from elsewhere**:
A change an Agent working in one Project makes to another Project's Roadmap or Plan Files, through the tools' `project` input. Each item it adds or changes there is marked `updated from` the Project it came from (the dashboard shows *Updated from …*), it never takes a Claim there, and it leaves Goals that a running Session holds alone, but for Notes. That Project's own Session is told about it once.
_Avoid_: Remote update, cross-project write, external change

**Detour**:
A point where the work actually being done splits off from a Goal's planned Tasks, with a Reason explaining why.
_Avoid_: Side quest, distraction, tangent

**Recalibration**:
Ending a Detour by rethinking the rest of the Goal and replacing its remaining Tasks with a new Task list.
_Avoid_: Replan, reset

**Return**:
Ending a Detour by going back to the original Task list, optionally adding the Detour's intended work as new Tasks at the end.
_Avoid_: Revert, rollback, undo

**Merge back**:
Ending a small Detour as done, leaving the planned Tasks unchanged.
_Avoid_: Close, resolve

**Idea**:
A feature or improvement thought of during the work and parked for later rather than done now. Since 0.6 Ideas are no longer added; older Roadmaps keep theirs.
_Avoid_: Backlog item, wishlist, feature request

**Promotion**:
Turning an Idea into a Task or a Goal.
_Avoid_: Conversion, acceptance
