# Tool index

Every tool Progressor gives your AI, by what it is for, in one line each. You never call these yourself: your AI does, and the dashboard shows what they changed. For every option of every tool, see the [Reference](reference.md#tools).

Words: a **goal** is *Goal* in the tools, a **step** is *Task*, a **side trip** is *Detour*, and **a rule your AI keeps** is a *Standing Instruction*. A `save_` tool adds something when given no ID, and changes it (or removes it, with an empty text) when given one.

## Where things stand

| Tool | What it does |
| --- | --- |
| `get_status` | Where the work stands and the rules (in full when new or changed); `for_helper`: a helper's rules. |
| `get_item` | Looks up a goal, step, note or decision by its `progressor://` link (`refs`: several). |
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
| `complete_goal` | Marks a goal finished; can add `hand_tests` and claim the `next` goal in the same call. |
| `drop_goal` | Cancels a goal, with a reason. |

## Steps

| Tool | What it does |
| --- | --- |
| `add_tasks` | Adds steps to a goal; can record finished work in the same call. |
| `add_small_fix` | Records a small one-off fix that belongs to no goal. |
| `update_tasks` | Starts, finishes or cancels steps in one call, with hand tests and decisions; sets states. |
| `update_task` | Rewords a step or changes its files or estimate. |
| `set_task_state` | Marks a step with a helper, waiting on you or someone else, checked or released. |
| `move_task` | Moves a step to another goal. |

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
| `save_hand_test` | Adds, rewords or removes something only you can try by hand. |
| `attach_picture` | Shows you a screenshot or short recording. |

## Notes, decisions and risks

| Tool | What it does |
| --- | --- |
| `save_note` | Notes something about a goal to deal with later; resolves or rewords it. |
| `save_decision` | Records a choice made for a goal; rewords or removes it. |
| `save_risk` | Adds a risk to the project's risk list, or changes or closes one. |

## Rules and background

| Tool | What it does |
| --- | --- |
| `save_standing_instruction` | Saves a lasting rule you gave, for this project or every project; changes or removes one. |
| `update_context` | Rewrites the project's background (or the one for every project). |

## Sharing work

| Tool | What it does |
| --- | --- |
| `resource` | Claims, releases or lists something only one can use at a time, such as a dev window. |
| `handoff` | Gathers the facts for a handoff, or saves the one the AI wrote. |

## Tools that were merged

Older versions had more tools. They still work in old history entries, but your AI now uses these:

| Old | Now |
| --- | --- |
| `start_task`, `complete_task`, `drop_task` | `update_tasks` with `action` `start`, `complete` or `drop` |
| `add_decision`, `update_decision` | `save_decision` |
| `add_note`, `update_note` | `save_note` |
| `add_risk`, `update_risk` | `save_risk` |
| `add_hand_test`, `update_hand_test` | `save_hand_test` |
| `add_standing_instruction`, `update_standing_instruction` | `save_standing_instruction` |
| `claim_resource`, `release_resource`, `list_resources` | `resource` with `action` `claim`, `release` or `list` |
| `get_rules` | `get_status` with `for_helper: true` |
| `add_person` | `set_task_state` with `person` and `role` |
