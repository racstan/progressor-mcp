# Talk to your AI from the dashboard

## Tasks

- [x] Messages and questions in the plan files ^t1
  - summary: New '## Messages' and '## Questions' sections in a goal's file: a message has sent/seen/reply lines; a question has choice lines, an answer, answered and seen lines. Old plans keep working.
  - code: `src/planFile.ts`
  - code: `test/talk.test.ts`
  - estimate: 1h 30m
  - time spent: 2m
- [x] Send, reply, ask and answer ^t2
  - summary: Project methods: the Developer sends a message or answers a question (no Claim needed, like hand tests); the AI replies or asks; an answer is recorded as a decision; marks what the AI has been shown.
  - code: `src/project.ts`
  - code: `test/talk.test.ts`
  - estimate: 1h 30m
  - code: `src/dashboard/http.ts`
- [x] AI tools and delivery ^t3
  - summary: New tools ask_developer and reply_to_developer; new messages and answers are shown once in get_status, at the end of any tool reply for a held goal, and in Claude Code's prompt hook; instructions tell the AI to act on them.
  - code: `src/server.ts`
  - code: `src/talkText.ts`
  - code: `src/hooks.ts`
  - code: `test/talk.test.ts`
  - estimate: 2h
  - time spent: 2m
  - code: `src/project.ts`
  - code: `test/server.test.ts`
- [x] Dashboard endpoints ^t4
  - summary: POST endpoints to send a message, delete one the AI has not seen, and answer a question; same own-page guard, size limit and plan lock as hand-test marks.
  - code: `src/dashboard/http.ts`
  - code: `test/talk.test.ts`
  - estimate: 1h
  - time spent: 1m
- [x] Talk panel on the dashboard ^t5
  - summary: Per goal: a box to write to your AI, your messages with Sent / Seen by your AI / reply, and its questions with a button per choice plus 'Something else'. A goal with an open question shows as Waiting on you.
  - code: `src/ui/Talk.tsx`
  - code: `src/ui/App.tsx`
  - code: `src/ui/data.ts`
  - code: `src/ui/words.ts`
  - code: `src/ui/styles.css`
  - estimate: 2h
  - time spent: 5m
  - code: `src/dashboard/watch.ts`
  - code: `test/words.test.ts`
  - code: `test/watch.test.ts`
- [x] Docs, ADR and changelog ^t6
  - summary: Describe the new sections, tools and panel, and why the dashboard now writes messages (ADR 0005).
  - code: `docs/markdown-format.md`
  - code: `docs/reference.md`
  - code: `docs/dashboard.md`
  - code: `docs/adr/0005-developer-talks-to-the-ai-from-the-dashboard.md`
  - code: `CHANGELOG.md`
  - code: `GLOSSARY.md`
  - estimate: 45m
- [x] Browser check and your local test ^t7
  - summary: Drive it in headless Chrome, then hand it to the Developer to try locally. Not pushed to GitHub.
  - estimate: 45m
  - time spent: 3h 14m
  - updated: 2026-10-28T12:01:40.373Z by AI
- [x] Keep the talk out of git ^t8
  - summary: Messages and questions move from the goal's plan file to .progressor/talk/<goal>.md, and Progressor writes .progressor/.gitignore with talk/ so they are never committed. Answers still become decisions in the plan.
  - code: `src/project.ts`
  - code: `src/planFile.ts`
  - code: `test/talk.test.ts`
  - estimate: 1h
  - time spent: 2m
  - code: `src/server.ts`
  - code: `src/dashboard/http.ts`
- [x] Say it next to the message box ^t9
  - summary: A quiet line under the box: kept on this computer only, not saved in git.
  - code: `src/ui/Talk.tsx`
  - code: `src/ui/styles.css`
  - estimate: 15m
- [x] Docs for the private talk files ^t10
  - summary: Describe where the talk is kept and why it stays out of git.
  - code: `docs/markdown-format.md`
  - code: `docs/reference.md`
  - code: `docs/dashboard.md`
  - code: `docs/adr/0005-developer-talks-to-the-ai-from-the-dashboard.md`
  - code: `CHANGELOG.md`
  - estimate: 20m
- [x] Project-wide message box ^t11
  - summary: Messages to the whole project, kept in .progressor/talk/_project.md; any AI chat in the project is shown them once at its next Progressor call or prompt (even without a goal), lists them until replied, and replies with reply_to_developer whole_project: true. The dashboard has a 'Message your AI' page in the sidebar.
  - code: `src/project.ts`
  - code: `src/server.ts`
  - code: `src/talkText.ts`
  - code: `src/hooks.ts`
  - code: `src/dashboard/http.ts`
  - code: `src/ui/App.tsx`
  - code: `test/talk.test.ts`
  - estimate: 2h
  - time spent: 3m
  - code: `src/ui/Talk.tsx`
  - code: `src/ui/context.ts`
  - code: `CHANGELOG.md`
  - code: `docs/reference.md`

## Decisions

- Messages and questions live on a goal (its plan file), not project-wide. The AI sees a new one once: in get_status, at the end of any tool reply for a goal it holds, and in the Claude Code prompt hook (which shows but does not mark seen). Two new tools only (ask_developer, reply_to_developer) to keep the tool count low. An answered question becomes a decision. An open question makes the goal 'Waiting on you'. ^c1
- Developer chose a project-wide message box too (q1). Project messages live in .progressor/talk/_project.md; the first AI chat in the project to make a Progressor call is shown each one (it need not hold a goal), and it stays listed in every chat's status until replied to. Messages only, no project-wide questions. ^c2

## Hand tests

- [x] Next time your AI asks you something, it shows in the "Needs you" box at the top of the goal. Click one of the answers: it should move to the Conversation tab, and the goal should stop saying Waiting on you. ^h1
  - task: ^t7
  - marked: 2026-10-28T10:55:08.834Z
  - seen: yes
- [x] On a goal, open the Conversation tab, write any message and press Send, then type anything in the chat. Your AI's reply should appear under your message without reloading the page. ^h2
  - task: ^t7
  - marked: 2026-10-28T11:51:25.007Z
  - seen: yes
  - updated: 2026-10-28T11:51:25.007Z by Developer
- [x] Send a second message and press Take back before telling me. It should disappear. ^h3
  - task: ^t7
  - marked: 2026-10-28T11:51:26.296Z
  - seen: yes
  - updated: 2026-10-28T11:51:26.296Z by Developer
- [x] After restarting your AI chat, open the dashboard, click "Message your AI" in the sidebar, send "What are you working on?", then type anything in the chat. Your AI should answer on that page without you pressing anything. ^h4
  - task: ^t11
  - marked: 2026-10-28T11:51:27.167Z
  - seen: yes
  - updated: 2026-10-28T11:51:27.167Z by Developer

## Detour: Fix the dashboard missing plan changes on Linux ^d1

- branched from: ^t5
- reason: Browser check found the dashboard stops updating live after the first save of a goal file: Node 24's recursive fs.watch on Linux loses a file once it is replaced by rename (how every save works). Pre-existing since the dashboard began; the page only caught up on the 15 s timer or Refresh.
- status: merged back
