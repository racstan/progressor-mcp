// Hotfixes: a bug that jumps the queue. It goes at the top of the Roadmap with its report kept word
// for word, every Session is told it is waiting until one claims it, and it is fixed test first.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { promptReminder, sessionStatus } from "../src/hooks.js";
import { Project, hotfixTitle } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

const REPORT = [
  "Checkout fails with a 500 when the cart has a coupon",
  "",
  "Steps from the customer:",
  "- add any item",
  "- apply SAVE10",
  "# then press Pay",
  "```",
  "TypeError: cannot read 'amount' of undefined",
  "```",
].join("\n");

let root: string;
let mine: Project;
let client: Client;

beforeEach(async () => {
  root = tempDir("progressor-hotfix-");
  mine = new Project({ root, session: { id: "s-a", pid: process.pid } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([createServer(mine).connect(b), client.connect(a)]);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
}

/** Another Session in the same project, as a second AI chat would be (its process still running). */
const other = () => new Project({ root, session: { id: "s-b", pid: 4242 }, isAlive: () => true });
/** What a hook sees: no Session of its own, just the files. */
const hook = () => new Project({ root, session: { id: "hook", pid: 1 }, isAlive: () => true }).overview();

describe("a hotfix in the plan", () => {
  it("goes at the top, after older hotfixes, with its report kept word for word", () => {
    mine.addGoal("Login", [{ title: "Form" }]);
    mine.addGoal("Search");
    const first = mine.addHotfix(REPORT);
    const second = mine.addHotfix("Emails go out twice", { title: "Double emails" });
    const goals = mine.roadmap().goals;
    expect(goals.map((g) => [g.id, g.hotfix ?? false])).toEqual([
      [first.id, true],
      [second.id, true],
      ["login", false],
      ["search", false],
    ]);
    expect(first.title).toBe("Checkout fails with a 500 when the cart has a coupon");
    expect(second.title).toBe("Double emails");
    const plan = mine.plan(first.id);
    // The report's own list, heading and code lines stay report, not plan.
    expect(plan.report).toBe(REPORT);
    expect(plan.tasks.map((t) => [t.id, t.title])).toEqual([
      ["t1", "Write a test that shows the bug"],
      ["t2", "Fix the bug"],
    ]);
    expect(readFileSync(join(root, ".progressor", "roadmap.md"), "utf8")).toContain("  - hotfix: yes");
  });

  it("refuses an empty or huge report, and makes a short title from a long first line", () => {
    expect(() => mine.addHotfix("  \n ")).toThrow(/bug report/);
    expect(() => mine.addHotfix("x".repeat(8001))).toThrow(/8000/);
    const title = hotfixTitle(`${"word ".repeat(30)}\nmore`);
    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith("word…")).toBe(true);
  });
});

describe("telling Sessions about a hotfix", () => {
  it("says it first in get_status and after every tool call until a Session claims it", async () => {
    await call("add_goal", { title: "Login", tasks: [{ title: "Form" }], claim: true });
    await call("start_task", { task: "t1" });
    const added = await call("add_hotfix", { report: REPORT });
    expect(added.text).toContain("at the top of the Roadmap. Finish the step you are on, then claim it with claim_goal.");
    const id = mine.roadmap().goals[0]!.id;
    expect(id).toBe("checkout-fails-with-a-500-when-the-cart-has-a-co");
    const status = await call("get_status");
    expect(status.text.split("\n")[0]).toBe(
      `HOTFIX waiting: ${id} "Checkout fails with a 500 when the cart has a coupon". Finish the step you are on, then claim it (claim_goal) and fix it test first: a test that shows the bug, then the fix.`,
    );
    expect((await call("complete_task", { task: "t1" })).text).toContain(`HOTFIX waiting: ${id}`);

    // Claimed, it is this Session's: no more "waiting", and its report is shown with it.
    const claimed = await call("claim_goal", { goal: id });
    expect(claimed.text).not.toContain("HOTFIX waiting");
    const now = await call("get_status");
    // It holds two Goals now (Login and the hotfix); the hotfix is marked and its report quoted.
    expect(now.text).toContain(`HOTFIX ${id}: Checkout fails with a 500 when the cart has a coupon (progressor://${id})`);
    expect(now.text).toContain("> - apply SAVE10");
    // Another Session is not told to take a hotfix someone is fixing.
    expect(other().sessionStatus().goals.find((g) => g.id === id)?.status).toBe("active");
  });

  it("can be claimed straight away", async () => {
    const r = await call("add_hotfix", { report: "Emails go out twice", claim: true });
    expect(r.text).toContain("claimed by this Session. Start with t1: a test that shows the bug.");
    expect(r.text).toContain("Bug report:\n> Emails go out twice");
    expect(r.text).not.toContain("HOTFIX waiting");
  });

  it("is in the hooks' text, even when no Goal is in progress", () => {
    mine.addGoal("Login");
    mine.addHotfix("Emails go out twice");
    const line = `[Progressor] HOTFIX waiting: emails-go-out-twice "Emails go out twice".`;
    expect(promptReminder(hook())).toContain(line);
    expect(sessionStatus(hook())?.split("\n")[0]).toContain(line);
    // Once a Session claims it, the hooks stop saying it.
    other().claimGoal("emails-go-out-twice");
    expect(promptReminder(hook()) ?? "").not.toContain("HOTFIX waiting");
  });
});
