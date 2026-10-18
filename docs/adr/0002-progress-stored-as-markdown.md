# Progress is stored as markdown files inside the project

The progress record lives in the project folder as plain markdown: `.progressor/roadmap.md` holds the Roadmap, Ideas and Standing Instructions, and each Goal has its own Plan File, `.progressor/goals/<goal>.md`, with Tasks as checklist lines and Detours as marked sections. Markdown is the source of truth, not a view generated from something else. The Agent changes it only through Progressor's tools, which rewrite the files, and the dashboard reads them. This keeps the record readable and diffable in git, lets every item link to a real file and line, and replaces the hand-maintained markdown progress file the Developer used before.

## Consequences

- Progressor must parse its own markdown format robustly, and cope with files that someone edited by hand.

## Considered Options

- A JSON file under `.progressor/`: simpler to parse, but not readable by humans and gives "Open in file" nothing useful to open.
- A central store in the Developer's home folder: rejected because the record should travel with the repo.
