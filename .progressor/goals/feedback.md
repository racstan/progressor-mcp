# Onboarding docs and feedback

## Tasks

- [x] Issue link builder ^t1
  - summary: Pure function that builds a prefilled GitHub new-issue URL with the Progressor version, OS and browser, tested first.
  - code: `src/ui/feedback.ts`
  - code: `test/feedback.test.ts`
- [x] Report a problem in Help ^t2
  - summary: Help menu opens with a 'Facing a problem?' section (report a problem, suggest an idea, open issues, version) and shows on every page; added `progressor-mcp --version` for bug reports.
  - code: `src/ui/App.tsx`
  - code: `src/ui/styles.css`
  - code: `src/cli.ts`
- [x] GitHub issue templates ^t3
  - summary: Bug and idea forms so reports arrive with version, OS, client and steps.
  - code: `.github/ISSUE_TEMPLATE/bug_report.yml`
  - code: `.github/ISSUE_TEMPLATE/idea.yml`
  - code: `.github/ISSUE_TEMPLATE/config.yml`
- [x] README: For AI agents and help ^t4
  - summary: README opens with a For AI agents section (a copy-paste setup prompt and steps for Agents reading it), and gains Troubleshooting for the common setup failures and Feedback and help linking the issue forms.
  - code: `README.md`
- [x] Buy me a coffee in Settings ^t5
  - summary: The support link moves from the Help menu to the bottom of Settings.
  - code: `src/ui/App.tsx`
  - code: `README.md`
- [x] Say where the dashboard lives ^t6
  - summary: The demo caption and intro say the dashboard is an optional browser tab beside your editor, and that the Agent's work happens in the chat.
  - code: `README.md`
