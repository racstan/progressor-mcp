import { describe, expect, it } from "vitest";
import { parsePlanFile } from "../src/planFile.js";

const example = `# Ship OAuth login

## Tasks

- [x] Add the /login route ^t1
  - code: \`src/routes/login.ts\`
- [/] Handle the OAuth callback ^t2
- [-] Store tokens in cookies ^t3
  - dropped by: ^d1
- [ ] Store tokens server-side ^t4
  - added by: ^d1
- [ ] Add logout ^t5
  - added by: ^d1

## Detour: Fix flaky token refresh ^d1

- branched from: ^t2
- reason: The callback tests fail randomly because token refresh races the cookie write
- status: recalibrated
`;

describe("Plan File parsing", () => {
  it("reads the Goal title and every Task with its status, ID, line and details", () => {
    const plan = parsePlanFile(example, "ship-oauth-login");

    expect(plan.title).toBe("Ship OAuth login");
    expect(plan.tasks.map((t) => [t.id, t.status, t.title, t.line])).toEqual([
      ["t1", "done", "Add the /login route", 5],
      ["t2", "in progress", "Handle the OAuth callback", 7],
      ["t3", "dropped", "Store tokens in cookies", 8],
      ["t4", "pending", "Store tokens server-side", 10],
      ["t5", "pending", "Add logout", 12],
    ]);
    expect(plan.tasks[0]!.code).toEqual(["src/routes/login.ts"]);
    expect(plan.tasks[0]!.ref).toBe("progressor://ship-oauth-login/t1");
    expect(plan.tasks[2]!.droppedBy).toBe("d1");
    expect(plan.tasks[3]!.addedBy).toBe("d1");
  });

  it("reads Detours with the Task they branched from, their Reason and how they ended", () => {
    const plan = parsePlanFile(example, "ship-oauth-login");

    expect(plan.detours).toEqual([
      {
        id: "d1",
        ref: "progressor://ship-oauth-login/d1",
        title: "Fix flaky token refresh",
        line: 15,
        branchedFrom: "t2",
        reason: "The callback tests fail randomly because token refresh races the cookie write",
        status: "recalibrated",
      },
    ]);
  });

  it("serialises an unchanged file back to the same text", () => {
    expect(parsePlanFile(example, "ship-oauth-login").toString()).toBe(example);
  });
});

const handEdited = [
  "# Ship OAuth login",
  "Some notes the Developer wrote.",
  "",
  "## Tasks",
  "* [X]   Add the /login route   ^t1",
  "    - code: src/routes/login.ts",
  "    - remember to check the redirect",
  "- [ ] Handle the OAuth callback",
  "- [ ] Add logout ^t4",
  "",
  "## Scratch",
  "```",
  "- [ ] not a task ^t9",
  "```",
  "- loose bullet",
].join("\r\n");

describe("Plan Files edited by hand", () => {
  it("round-trips odd spacing, CRLF, unknown sections, code fences and a missing final newline", () => {
    expect(parsePlanFile(handEdited, "g").toString()).toBe(handEdited);
  });

  it("recognises hand-typed Tasks without an ID and ignores list lines outside the Tasks section", () => {
    const plan = parsePlanFile(handEdited, "g");
    expect(plan.tasks.map((t) => [t.id, t.status, t.title, t.line])).toEqual([
      ["t1", "done", "Add the /login route", 5],
      [undefined, "pending", "Handle the OAuth callback", 8],
      ["t4", "pending", "Add logout", 9],
    ]);
    expect(plan.tasks[0]!.code).toEqual(["src/routes/login.ts"]);
  });

  it("rewrites only the item that changed and gives ID-less Tasks the next free ID", () => {
    const plan = parsePlanFile(handEdited, "g");
    plan.assignMissingIds();
    plan.setTaskStatus("t4", "in progress");

    expect(plan.toString()).toBe(
      handEdited
        .replace("- [ ] Handle the OAuth callback", "- [ ] Handle the OAuth callback ^t5")
        .replace("- [ ] Add logout ^t4", "- [/] Add logout ^t4"),
    );
  });

  it("appends new Tasks after the last Task, before the next section", () => {
    const plan = parsePlanFile(handEdited, "g");
    plan.addTasks([{ title: "Add a session store", code: ["src/session.ts"] }]);

    const lines = plan.toString().split("\r\n");
    expect(lines.slice(8, 12)).toEqual([
      "- [ ] Add logout ^t4",
      "- [ ] Add a session store ^t6",
      "  - code: `src/session.ts`",
      "",
    ]);
    expect(lines[4]).toBe("* [X]   Add the /login route   ^t1");
  });
});

describe("Task summaries", () => {
  const withSummary = `# Ship OAuth login

## Tasks

- [x] Fix callback redirect loop ^t1
  - summary: Callback re-sets the session cookie on every hit; only set it after token exchange.
  - code: \`src/auth/callback.ts\`
  - code: \`src/auth/session.ts:42\`
- [ ] Add logout ^t2
`;

  it("reads a Task's summary alongside its title and files", () => {
    const [fix, logout] = parsePlanFile(withSummary, "g").tasks;
    expect(fix).toMatchObject({
      title: "Fix callback redirect loop",
      summary: "Callback re-sets the session cookie on every hit; only set it after token exchange.",
      code: ["src/auth/callback.ts", "src/auth/session.ts:42"],
    });
    expect(logout!.summary).toBeUndefined();
    expect(parsePlanFile(withSummary, "g").toString()).toBe(withSummary);
  });

  it("writes a new Task's summary under its title, before its files", () => {
    const plan = parsePlanFile(withSummary, "g");
    plan.addTasks([{ title: "Store tokens server-side", summary: "Keep tokens out of cookies.", code: ["src/auth/store.ts"] }]);
    expect(plan.toString().split("\n").slice(9, 12)).toEqual([
      "- [ ] Store tokens server-side ^t3",
      "  - summary: Keep tokens out of cookies.",
      "  - code: `src/auth/store.ts`",
    ]);
  });

  it("updates a Task's title, summary and files, keeping its other details and every other line", () => {
    const handEdited = withSummary.replace("- [ ] Add logout ^t2", "* [ ]  Add logout   ^t2\n  - added by: ^d1\n  - owner: me");
    const plan = parsePlanFile(handEdited, "g");
    plan.updateTask("t2", { title: "Add a logout route", summary: "Clears the session cookie.", code: ["src/routes/logout.ts"] });
    expect(plan.toString()).toBe(
      handEdited.replace(
        "* [ ]  Add logout   ^t2\n  - added by: ^d1\n  - owner: me",
        "- [ ] Add a logout route ^t2\n  - summary: Clears the session cookie.\n  - code: `src/routes/logout.ts`\n  - added by: ^d1\n  - owner: me",
      ),
    );
    plan.updateTask("t1", { summary: "Only set the cookie after token exchange." });
    expect(plan.task("t1")).toMatchObject({
      title: "Fix callback redirect loop",
      summary: "Only set the cookie after token exchange.",
      code: ["src/auth/callback.ts", "src/auth/session.ts:42"],
    });
  });

  it("keeps a summary on one line, however it was given", () => {
    const plan = parsePlanFile(withSummary, "g");
    plan.updateTask("t2", { summary: "  Clears the cookie.\n  Then redirects home.  " });
    expect(plan.task("t2")!.summary).toBe("Clears the cookie. Then redirects home.");
  });
});

describe("side trips that share a title", () => {
  it("keeps each one's fields apart, when read back and when changed", () => {
    const plan = parsePlanFile("# Login\n\n## Tasks\n\n- [/] Callback ^t1\n", "login");
    const first = plan.startDetour("Fix tests", "They fail", "t1");
    plan.setDetourStatus(first.id!, "merged back");
    const second = plan.startDetour("Fix tests", "They fail again", "t1");

    const again = parsePlanFile(plan.toString(), "login");
    expect(again.detours.map((d) => [d.id, d.status, d.reason])).toEqual([
      [first.id, "merged back", "They fail"],
      [second.id, "open", "They fail again"],
    ]);
    expect(again.openDetour?.id).toBe(second.id);

    again.setDetourStatus(second.id!, "returned");
    const last = parsePlanFile(again.toString(), "login");
    expect(last.detours.map((d) => d.status)).toEqual(["merged back", "returned"]);
  });
});

describe("text with line breaks", () => {
  it("keeps a side trip's title and reason, and a drop reason, on one line", () => {
    const plan = parsePlanFile("# Login\n\n## Tasks\n\n- [/] Callback ^t1\n- [ ] Logout ^t2\n", "login");
    plan.startDetour("Fix\nthe build", "It is red\n\nsince this morning", "t1");
    plan.dropTask("t2", { reason: "Not needed\nany more" });
    const again = parsePlanFile(plan.toString(), "login");
    expect(again.detours[0]).toMatchObject({ title: "Fix the build", reason: "It is red since this morning", status: "open" });
    expect(again.task("t2")).toMatchObject({ status: "dropped", reason: "Not needed any more" });
  });
});

describe("the states a Task can be in beyond the checkbox", () => {
  const withStates = `# Voice

## Tasks

- [x] Record the clip ^t1
  - state: released
- [/] Transcribe it ^t2
  - state: with a helper
- [/] Try it on the phone ^t3
  - state: waiting on you
- [/] Wire up the button ^t4
  - state: checked
  - summary: The helper's branch passes the tests.
- [/] Polish the copy ^t5
- [ ] Ship it ^t6
  - state: released
`;

  it("reads them from the state line, which only counts under the checkbox it belongs to", () => {
    const plan = parsePlanFile(withStates, "voice");
    expect(plan.tasks.map((t) => [t.id, t.status])).toEqual([
      ["t1", "released"],
      ["t2", "with a helper"],
      ["t3", "waiting on you"],
      ["t4", "checked"],
      ["t5", "in progress"],
      ["t6", "pending"],
    ]);
    expect(plan.currentTask?.id).toBe("t5");
    expect(plan.nextTask?.id).toBe("t6");
    expect(plan.toString()).toBe(withStates);
  });

  it("writes a state as the checkbox plus a state line first among the details, and removes the line when it no longer applies", () => {
    const plan = parsePlanFile("# Voice\n\n## Tasks\n\n- [ ] Transcribe it ^t1\n  - summary: Use the API.\n- [ ] Ship it ^t2\n", "voice");
    plan.setTaskStatus("t1", "with a helper");
    expect(plan.toString()).toContain("- [/] Transcribe it ^t1\n  - state: with a helper\n  - summary: Use the API.\n");
    plan.setTaskStatus("t1", "checked");
    expect(plan.toString()).toContain("- [/] Transcribe it ^t1\n  - state: checked\n");
    plan.setTaskStatus("t1", "released");
    expect(plan.toString()).toContain("- [x] Transcribe it ^t1\n  - state: released\n");
    plan.setTaskStatus("t1", "done");
    expect(plan.toString()).toContain("- [x] Transcribe it ^t1\n  - summary: Use the API.\n");
    plan.setTaskStatus("t2", "waiting on you");
    plan.dropTask("t2", { reason: "Not needed" });
    expect(plan.toString()).toContain("- [-] Ship it ^t2\n  - reason: Not needed\n");
  });
});

describe("decisions and notes", () => {
  const withNotes = `# Voice

## Tasks

- [/] Transcribe it ^t1

## Decisions

- Old models get thinking on/off only ^c1
- Keep clips under a minute

## Notes

- [ ] The mic stays on after cancelling ^n1
  - from: progressor://cleanup
- [x] Typo on the record button ^n2
- Odd echo on Android

## Detour: Fix the build ^d1

- reason: It is red
- status: merged back
`;

  it("reads decisions and notes, with IDs, lines, whether a note is resolved and where it came from", () => {
    const plan = parsePlanFile(withNotes, "voice");
    expect(plan.decisions).toEqual([
      { id: "c1", ref: "progressor://voice/c1", text: "Old models get thinking on/off only", line: 9 },
      { id: undefined, ref: undefined, text: "Keep clips under a minute", line: 10 },
    ]);
    expect(plan.notes.map((n) => [n.id, n.text, n.resolved, n.from, n.line])).toEqual([
      ["n1", "The mic stays on after cancelling", false, "progressor://cleanup", 14],
      ["n2", "Typo on the record button", true, undefined, 16],
      [undefined, "Odd echo on Android", false, undefined, 17],
    ]);
    expect(plan.toString()).toBe(withNotes);
    plan.assignMissingIds();
    expect(plan.decisions.map((d) => d.id)).toEqual(["c1", "c2"]);
    expect(plan.notes.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("adds them in their own sections, after the Tasks and before any Detour", () => {
    const plan = parsePlanFile("# Voice\n\n## Tasks\n\n- [/] Transcribe it ^t1\n\n## Detour: Fix the build ^d1\n\n- status: open\n", "voice");
    expect(plan.addDecision("Old models get\nthinking on/off only")).toMatchObject({ id: "c1", text: "Old models get thinking on/off only" });
    expect(plan.addNote("The mic stays on", "progressor://cleanup")).toMatchObject({ id: "n1", resolved: false, from: "progressor://cleanup" });
    plan.addNote("Echo on Android");
    expect(plan.toString()).toBe(
      "# Voice\n\n## Tasks\n\n- [/] Transcribe it ^t1\n\n" +
        "## Decisions\n\n- Old models get thinking on/off only ^c1\n\n" +
        "## Notes\n\n- [ ] The mic stays on ^n1\n  - from: progressor://cleanup\n- [ ] Echo on Android ^n2\n\n" +
        "## Detour: Fix the build ^d1\n\n- status: open\n",
    );
  });

  it("rewords, resolves and removes them", () => {
    const plan = parsePlanFile(withNotes, "voice");
    plan.assignMissingIds();
    plan.setDecision("c1", "Old models get thinking on/off, nothing finer");
    plan.removeDecision("c2");
    plan.updateNote("n1", { resolved: true });
    plan.updateNote("n2", { text: "Typo on the stop button", resolved: false });
    plan.removeNote("n3");
    expect(plan.decisions.map((d) => [d.id, d.text])).toEqual([["c1", "Old models get thinking on/off, nothing finer"]]);
    expect(plan.notes.map((n) => [n.id, n.text, n.resolved])).toEqual([
      ["n1", "The mic stays on after cancelling", true],
      ["n2", "Typo on the stop button", false],
    ]);
    expect(plan.addDecision("Another").id).toBe("c2");
    expect(() => plan.setDecision("c9", "x")).toThrow(/No decision c9/);
    expect(() => plan.updateNote("n9", { resolved: true })).toThrow(/No note n9/);
  });
});
