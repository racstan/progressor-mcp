// The helper limit counts the chats really at work in a project (an orchestrating chat plus its helper
// is one helper), and a rule for every project can carry the limit.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addGlobalRule, globalFileFor, readGlobal, updateGlobalRule } from "../src/globalRules.js";
import { runHook } from "../src/hooks.js";
import { Project } from "../src/project.js";
import { defaultServersDir, type ServerRecord } from "../src/servers.js";
import { tempDir } from "./tmp.js";

const NOW = new Date("2026-11-27T10:00:00Z");
let root: string;
let registry: string;

const record = (pid: number, session: string, over: Partial<ServerRecord> = {}): ServerRecord => ({
  pid,
  kind: "session",
  root,
  session,
  version: "1.4.0",
  startedAt: "2026-11-27T09:00:00Z",
  beatAt: "2026-11-27T09:59:50Z",
  memory: 1,
  ...over,
});

beforeEach(() => {
  root = tempDir("progressor-limit-");
  registry = join(tempDir("progressor-reg-"), "projects.json");
});

describe("counting helpers from the chats at work", () => {
  it("counts every chat but one as a helper, even with no step marked", () => {
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addGoal("Login", [{ title: "A" }]);
    expect(p.helperLoad({ chats: [{ session: "s-a" }] }).busy).toBe(0);
    expect(p.helperLoad({ chats: [{ session: "s-a" }, { session: "s-h", worktree: "/w/t1" }] }).busy).toBe(1);
    expect(p.helperLoad({ chats: [{ session: "s-a" }, { session: "s-h" }, { session: "s-i" }] }).busy).toBe(2);
  });

  it("still counts helpers marked on steps when they are not chats Progressor can see", () => {
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addGoal("Login", [{ title: "A" }, { title: "B" }]);
    p.claimGoal("login");
    p.setTaskState("t1", "with a helper", "login", { helper: { branch: "a" } });
    p.setTaskState("t2", "with a helper", "login", { helper: { branch: "b" } });
    expect(p.helperLoad({ chats: [{ session: "s-a" }, { session: "s-h" }] }).busy).toBe(2);
    expect(p.helperLoad().busy).toBe(2);
  });

  it("takes the limit from a rule for every project, the lowest one winning", () => {
    const file = globalFileFor(registry);
    const g = addGlobalRule(file, "Only one helper session may work at a time", true, 1);
    expect(g).toMatchObject({ id: "g1", helpersAtOnce: 1 });
    expect(readGlobal(file).rules[0]).toMatchObject({ id: "g1", hard: true, helpersAtOnce: 1 });
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addStandingInstruction("Two helpers at most", false, 2);
    const load = p.helperLoad({ global: readGlobal(file).rules });
    expect(load.limit).toBe(1);
    expect(load.rule?.id).toBe("g1");
    // The limit can be set on a rule already there, and taken off with 0.
    expect(updateGlobalRule(file, "g1", { helpersAtOnce: 3 })).toMatchObject({ helpersAtOnce: 3 });
    expect(updateGlobalRule(file, "g1", { helpersAtOnce: 0 })?.helpersAtOnce).toBeUndefined();
  });
});

describe("the per-message warning", () => {
  it("says so while more chats are at work than the limit allows", () => {
    const p = new Project({ root, session: { id: "s-a", pid: process.pid } });
    p.addGoal("Login", [{ title: "A" }]);
    p.claimGoal("login");
    addGlobalRule(globalFileFor(registry), "Only one helper session may work at a time", true, 1);
    const dir = defaultServersDir(registry);
    mkdirSync(dir, { recursive: true });
    const put = (r: ServerRecord) => writeFileSync(join(dir, `${r.pid}.json`), JSON.stringify(r));
    const prompt = () =>
      runHook({
        event: "prompt",
        input: JSON.stringify({ cwd: root, hook_event_name: "UserPromptSubmit" }),
        env: { PROGRESSOR_REGISTRY: registry },
        isAlive: () => true,
        now: () => NOW,
      });
    put(record(11, "s-a"));
    put(record(12, "s-h", { worktree: join(dirname(root), "w1"), branch: "t1-x" }));
    expect(prompt()).not.toMatch(/helper limit/);
    put(record(13, "s-i", { worktree: join(dirname(root), "w2"), branch: "t2-y" }));
    expect(prompt()).toMatch(/2 helpers are at work \(3 chats in this project\), over the helper limit of 1 \(g1\): hand out no more until one comes back\./);
  });
});
