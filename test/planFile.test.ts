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
  "## Notes",
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
