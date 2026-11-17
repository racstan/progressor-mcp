// A home for small one-off fixes: add_small_fix records a quick fix made outside any planned goal as a
// finished step of the standing "Small fixes" goal, made the first time, without claiming anything.
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project, SMALL_FIXES_ID } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
const agent = () => new Project({ root, session: { id: "s", pid: process.pid } });

beforeEach(() => {
  root = tempDir("progressor-small-");
});

describe("the Small fixes goal", () => {
  it("is made the first time a small fix is recorded, finished, with the fix as a done step", () => {
    const p = agent();
    p.addGoal("Login", [{ title: "Route" }]);
    p.claimGoal("login");
    const { goal, task } = p.addSmallFix({ title: "Faster dev server start", summary: "Skip the type check on start.", code: ["vite.config.ts"] });
    expect(goal.id).toBe(SMALL_FIXES_ID);
    expect(goal.title).toBe("Small fixes");
    expect(goal.status).toBe("done");
    expect(task.status).toBe("done");
    expect(task.code).toEqual(["vite.config.ts"]);
    // The goal this chat holds is untouched, and Small fixes is not claimed.
    expect(p.claimedGoals().map((g) => g.id)).toEqual(["login"]);
    expect(p.plan("login").tasks).toHaveLength(1);
  });

  it("collects later fixes in the same goal, which stays finished", () => {
    const p = agent();
    p.addSmallFix({ title: "Fix a typo" });
    const { goal, task } = p.addSmallFix({ title: "Tidy the AI's list formatting" });
    expect(goal.status).toBe("done");
    expect(task.id).toBe("t2");
    expect(p.roadmap().goals.filter((g) => g.id === SMALL_FIXES_ID)).toHaveLength(1);
    expect(p.plan(SMALL_FIXES_ID).tasks.map((t) => t.title)).toEqual(["Fix a typo", "Tidy the AI's list formatting"]);
  });

  it("waits on the Developer while a fix has something to try, and finishes when they mark it", () => {
    const p = agent();
    const { goal, handTest } = p.addSmallFix({ title: "Bigger tap targets", handTest: "Open the dashboard on a phone and tap a goal." });
    expect(handTest?.text).toBe("Open the dashboard on a phone and tap a goal.");
    expect(handTest?.task).toBe("t1");
    expect(goal.status).toBe("testing"); // built, waiting on the Developer's hand tests
  });

  it("refuses a fix with no title", () => {
    expect(() => agent().addSmallFix({ title: "   " })).toThrow(/title/);
  });
});

describe("the add_small_fix tool", () => {
  it("records the fix and says where it went, in one call", async () => {
    const p = agent();
    const server = createServer(p, { registryFile: join(tempDir("progressor-reg-"), "registry.json"), settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    const r = (await client.callTool({ name: "add_small_fix", arguments: { title: "Fix a typo", summary: "Readme said 'teh'.", code: ["README.md"] } })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    expect(r.isError).toBeFalsy();
    expect(r.content[0]!.text).toMatch(/Recorded small-fixes\/t1 Fix a typo as done under Small fixes/);
    expect(p.plan(SMALL_FIXES_ID).tasks[0]!.summary).toBe("Readme said 'teh'.");
  });
});
