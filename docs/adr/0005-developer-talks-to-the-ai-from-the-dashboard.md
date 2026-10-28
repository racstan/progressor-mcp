# The Developer talks to the AI from the dashboard

The Developer watched the plan on the dashboard but could only talk to the Agent in the chat, and the Agent stopped in the chat whenever it needed a product choice. Now the Developer can write to the Agent about a Goal on the dashboard, and the Agent can ask them there with choices to click. This changes the rule that the Developer only watches (Standing Instruction s6): the Agent still manages the plan, and acts on what the Developer says.

An MCP server cannot start a turn in an AI chat, so this is a mailbox and not a live chat. Messages and questions are kept in a talk file per Goal, `.progressor/talk/<goal>.md`, and not in the Plan File: Plan Files are usually committed (this repository commits its own), and people type things to their AI they would not put in a public git history. Progressor writes `talk/` into `.progressor/.gitignore` the first time it saves a talk file, so every project is covered without setup; the cost is that the talk stays on the computer it was written on. They reach the Agent at its next Progressor call: first in `get_status` and at the end of any other tool's answer for a Goal the Session holds, and in Claude Code also through the prompt hook. Each is shown once, tracked by a `seen` line, as hand-test marks are (ADR 0004).

The writes follow ADR 0004: a `POST` per action (send, take back, answer), only from the dashboard's own page (`x-progressor: talk` plus the page's own `Origin`), only to localhost, capped at 16 KB, written through `Project` while holding the plan's lock. The Developer and the Agent never edit the same lines: the Developer writes a message's text and a question's answer; the Agent writes questions, replies and the `seen` lines.

## Consequences

- Two more tools (`ask_developer`, `reply_to_developer`), kept to two so the tool list stays short.
- Every tool call on this project's plan reads the held Goals' Plan Files once more, to look for news.
- An answer is also added as a decision in the Plan File, so it survives context compression like any other choice and is committed with the plan; the conversation around it is not.
- An open question makes the Goal show *Waiting on you*.
- A message to a Goal nobody holds stays unseen until a Session claims that Goal; `get_status` names such Goals.
