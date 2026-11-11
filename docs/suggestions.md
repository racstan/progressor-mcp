# Suggestions for later

Ideas that came up while working on Progressor and were set aside for now. Nothing here is planned yet.

## Use fewer tokens

Measured on 2026-11-11 (1.3.1), at about 4 characters per token:

| What the AI reads | Size | How often |
|---|---|---|
| Server instructions | ~900 tokens, plus the rules for everything (capped) | once per conversation |
| Status in a small project | ~200 tokens | start of a conversation, after compression |
| Status in Progressor's own project | ~1,400 tokens | same |
| Rules block for a helper | ~600 tokens | each helper brief |
| Reminder on each message | 1–2 lines, often nothing | each message |
| Tool definitions (38 tools) | ~11,800 tokens | see 1 below |
| Another project's status | ~2,600 tokens, growing | when the AI looks at another project |

Already lean: a project's own status hides finished goals, the rules for everything are capped in the instructions (every hard rule, 10 others, 600 characters per context part), and the per-message reminder is tiny.

1. **Shorter tool descriptions.** Claude Code loads a tool's definition only when the AI needs it, so this costs little there. Claude Desktop, Cursor and most other apps load all ~11,800 tokens at the start of every conversation. The biggest are `update_tasks` (~890), `add_goal` (~870), `set_task_state` (~690), `ask_developer` (~550), `add_tasks` (~470), `complete_task` (~430), `claim_resource` (~430) and `update_standing_instruction` (~420). Trimming repeated wording could save about a third. Keep every fact the AI needs to call them right, and check with the tests that check tool descriptions.
2. **Another project's status should hide finished goals.** `get_status` with `project` lists every goal the project ever had (over 100 for Progressor), while a project's own status shows only a count of finished ones. Make the other-project view match.

## Tell running AIs when a rule for everything changes

Changing a project's rule on the dashboard messages the AI working there, so it hears at its next step. Changing a rule for everything doesn't yet: a conversation already running only sees the change at its next status check (after compression, or in the next conversation). Send a one-line notice to every project with a conversation running when a rule or context for everything changes.
