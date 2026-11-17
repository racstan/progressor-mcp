# Tool index

Every tool Progressor gives your AI, by what it is for, in one line each. You never call these yourself: your AI does, and the dashboard shows what they changed. For every option of every tool, see the [Reference](reference.md#tools).

Words: a **goal** is *Goal* in the tools, a **step** is *Task*, a **side trip** is *Detour*, and **a rule your AI keeps** is a *Standing Instruction*.

## Where things stand

| Tool | What it does |
| --- | --- |
| `get_status` | Where the work stands and the rules to follow. The AI calls it first in every chat. |
| `get_item` | Looks up one goal, step, note or decision by its `progressor://` link. |
| `get_rules` | The rules as a block to paste into a helper agent's brief. |
| `launch_readiness` | Answers "are we ready to launch?": what is left, for whom. |
| `plan_history` | The plan's last changes, or going back to before one. |

## Goals

| Tool | What it does |
| --- | --- |
| `add_goal` | Plans a new goal with its steps; can claim it at once. |
| `add_hotfix` | Turns a bug report into an urgent goal at the top. |
| `update_goal` | Renames a goal or changes what finished looks like, its estimate or what it waits on. |
| `move_goal` | Moves a goal before or after another. |
| `claim_goal` | Takes a goal to work on (reopens a finished one). |
| `release_goal` | Lets go of a goal; it is paused. |
| `complete_goal` | Marks a goal finished once its steps are done. |
| `drop_goal` | Cancels a goal, with a reason. |

## Steps

| Tool | What it does |
| --- | --- |
| `add_tasks` | Adds steps to a goal; can record finished work in the same call. |
| `add_small_fix` | Records a small one-off fix that belongs to no goal. |
| `start_task` | Marks a step in progress. |
| `complete_task` | Marks a step done, with the files it touched. |
| `update_tasks` | Changes several steps in one call (start, finish, drop, estimate). |
| `update_task` | Rewords a step or changes its files or estimate. |
| `set_task_state` | Marks a step with a helper, waiting on you or someone else, checked or released. |
| `move_task` | Moves a step to another goal. |
| `drop_task` | Cancels a step, with a reason. |

## Side trips

| Tool | What it does |
| --- | --- |
| `start_detour` | Says the AI is stepping off the current step, and why. |
| `end_detour` | Ends the side trip: back to the plan, or the plan changed. |

## Talking with you

| Tool | What it does |
| --- | --- |
| `ask_developer` | Asks you a question on the dashboard, with choices or alternatives. |
| `reply_to_developer` | Answers a message you wrote on the dashboard. |
| `add_hand_test` | Adds something only you can try by hand. |
| `update_hand_test` | Rewords or removes something to try. |
| `attach_picture` | Shows you a screenshot or short recording. |

## Notes, decisions and risks

| Tool | What it does |
| --- | --- |
| `add_note` | Notes something about a goal to deal with later. |
| `update_note` | Resolves, rewords or removes a note. |
| `add_decision` | Records a choice made for a goal. |
| `update_decision` | Rewords or removes a decision. |
| `add_risk` | Adds a risk to the project's risk list. |
| `update_risk` | Changes or closes a risk. |
| `add_person` | Adds someone steps can wait on, such as a lawyer or designer. |

## Rules and background

| Tool | What it does |
| --- | --- |
| `add_standing_instruction` | Saves a lasting rule you gave, for this project or for every project. |
| `update_standing_instruction` | Rewords or removes a rule. |
| `update_context` | Rewrites the project's background (or the one for every project). |

## Sharing work

| Tool | What it does |
| --- | --- |
| `claim_resource` | Takes something only one can use at a time, such as a dev window. |
| `release_resource` | Gives it back. |
| `list_resources` | Who holds what. |
| `handoff` | Gathers the facts for a handoff, or saves the one the AI wrote. |
