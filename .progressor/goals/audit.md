# Audit Progressor end to end

## Tasks

- [x] Dashboard: what a person sees ^t1
  - summary: Measured every main screen: a goal page shows 400-600 words, 22-36 buttons and 8-10 font sizes at once, raw AI notes, a mostly empty map by default, many unrelated colours and emoji. All projects is the calmest page.
  - code: `src/ui/`
  - estimate: 1h
  - time spent: 1m
- [x] AI side: tools, instructions, status ^t2
  - summary: How many tools and how long their descriptions and instructions are, how big get_status gets on a real plan, overlaps, and what an AI actually needs.
  - code: `src/server.ts`
  - code: `src/hooks.ts`
  - code: `src/prompts.ts`
  - helper: Sonnet (read-only audit)
  - evidence: Re-checked: 34 tools, instructions 6594 chars; start_task answers with the full status; a damaged roadmap.md plus add_goal rewrites the list with only the new goal (reproduced on a copy).
  - estimate: 1h
  - time spent: 2m
- [x] Code, reliability and docs ^t3
  - summary: Size and shape of the code (App.tsx is 1000+ lines), weak spots in saving and locking, Windows, setup, README and docs a newcomer meets.
  - code: `src/`
  - code: `docs/`
  - code: `README.md`
  - helper: Sonnet (read-only audit)
  - evidence: Re-checked on current main: writeText falls back to a plain write and leaves .tmp files; lock busy-waits and runs unlocked if the temp folder fails; CSS has 41 colour literals, 13 font sizes, 7 gradients, ~25 emoji; App.tsx 1077 lines. Helper's test count/missing files were from an older tree.
  - estimate: 1h
  - time spent: 2m
- [x] Write the audit and a redesign direction ^t4
  - summary: Audit written in chat: worst problems first for the dashboard, the AI side and reliability, with a calmer redesign direction for the Developer to approve.
  - estimate: 1h
