# Progressor

Progressor keeps an AI agent and the human it works with focused on the same goal across long sessions, context compression and distractions, by keeping a shared, live record of what is planned, what is done, and what came up along the way.

These are the terms the code, the Agent's tools and the files use. Everything a person reads (the dashboard and the guides) says them in everyday words instead: a Task is a *step*, a Detour a *side trip*, the Roadmap *Your goals*, an Outcome *Finished when*, dropped is *cancelled*. The [reference](docs/reference.md) has the full list.

## Language

### People

**Developer**:
The human working on the project alongside the Agent.
_Avoid_: User, human, owner

**Agent**:
The AI coding assistant that keeps the progress record up to date while it works, and makes planning decisions unless the Developer takes them over.
_Avoid_: AI, assistant, bot, model

**Standing Instruction**:
A lasting rule from the Developer about how the Agent should behave, such as "ask me before recalibrating", kept so it survives context compression and new Sessions.
_Avoid_: Preference, setting, rule

**Important context**:
The one page per Project holding its lasting background (what it is, key facts, choices that hold project-wide), written by the Agent and shown in full with the Standing Instructions at every session start. Not for rules, which are Standing Instructions.
_Avoid_: Notes, memory, project info

**Session**:
One Agent conversation, including any sub-agents it spawns, working on one claimed Goal.
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
The markdown file that holds one Goal's Tasks and Detours, and the place every one of them can be opened.
_Avoid_: Audit file, progress file, todo file

**Task**:
A planned step toward a Goal, with a short title, the files it touches and a summary of the change it makes.
_Avoid_: Todo, item, step, ticket

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
