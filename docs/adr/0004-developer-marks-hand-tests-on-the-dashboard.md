# The Developer marks hand tests on the dashboard

ADR 0001 made the dashboard view-only, so there was never a second writer to keep in sync. Things only the Developer can try by hand ended up in the Agent's chat summary and were lost, and having the Developer tell the Agent each result in chat is the part that gets forgotten. The Developer now crosses them off themselves on the dashboard, so the dashboard has one more write.

The write is narrow on purpose: one `POST` per Goal and hand test that sets a mark (works, doesn't work with a note, won't test, or clear). It is allowed only from the dashboard's own page (a custom header plus the page's own `Origin`, the same protection as stopping a server), only for requests addressed to localhost, and it is capped at 4 KB. It writes through `Project`, the code the Agent's tools use, while holding the plan's lock (`src/lock.ts`), so there is still no second way to write a plan and two writers take turns. The Developer's marks and the Agent's tools never edit the same fields: the Agent adds, rewords and removes hand tests; only the Developer marks them.

## Consequences

- The dashboard hub's version went from 3 to 4, so a Progressor that can take marks replaces an older hub that cannot.
- A failed mark adds a Task to the Goal and reopens a finished Goal, so the next Session finds the follow-up in the plan.
- The Agent learns of marks by reading the plan (`get_status` shows new ones once, tracked by a `seen` line), not through any channel from the dashboard to the Agent.
