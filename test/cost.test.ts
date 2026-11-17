// Cost per goal: token use read from Claude Code's transcripts by the hooks, attributed to the goal and
// step the chat was working on (its own Progressor tool calls say which), kept in .progressor/cost.json.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CostBook, collectTranscript, emptyBook, goalCost, money, readBook, tokenWords, totalTokens } from "../src/cost.js";
import { tempDir } from "./tmp.js";

const usage = (input: number, output: number, cacheWrite = 0, cacheRead = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: cacheWrite,
  cache_read_input_tokens: cacheRead,
});
const reply = (id: string, u: ReturnType<typeof usage>, tools: { name: string; input: Record<string, unknown> }[] = []) =>
  JSON.stringify({ type: "assistant", message: { id, usage: u, content: tools.map((t) => ({ type: "tool_use", ...t })) } });
const user = () => JSON.stringify({ type: "user", message: { content: "hi" } });
const tool = (name: string, input: Record<string, unknown>) => ({ name: `mcp__progressor__${name}`, input });

function transcript(lines: string[]): string {
  const file = join(tempDir("progressor-cost-"), "chat.jsonl");
  writeFileSync(file, lines.map((l) => `${l}\n`).join(""));
  return file;
}

describe("reading a transcript", () => {
  it("adds each reply's tokens to the goal and step the chat had started, from its own tool calls", () => {
    const file = transcript([
      user(),
      reply("m1", usage(10, 5), [tool("claim_goal", { goal: "login" })]),
      reply("m2", usage(20, 10), [tool("start_task", { task: "t1" })]),
      reply("m3", usage(1, 1, 100, 1000)),
      reply("m4", usage(2, 2), [tool("complete_task", { task: "t1" })]),
      reply("m5", usage(3, 3)),
    ]);
    const book = emptyBook();
    collectTranscript(book, file);
    // m1 had no goal yet; m2 is the goal's (its start_task counts from the next reply); m3 and m4 are t1's; m5 the goal's again
    expect(book.other).toEqual({ input: 10, output: 5, cacheWrite: 0, cacheRead: 0 });
    expect(book.goals.login!.steps.t1).toEqual({ input: 3, output: 3, cacheWrite: 100, cacheRead: 1000 });
    expect(book.goals.login!.usage).toEqual({ input: 23, output: 13, cacheWrite: 0, cacheRead: 0 });
    expect(totalTokens(goalCost(book, "login"))).toBe(23 + 13 + 6 + 1100);
  });

  it("counts a reply split over several lines once", () => {
    const file = transcript([reply("m1", usage(10, 5), [tool("claim_goal", { goal: "a" })]), reply("m2", usage(7, 7)), reply("m2", usage(7, 7))]);
    const book = emptyBook();
    collectTranscript(book, file);
    expect(book.goals.a!.usage).toEqual({ input: 7, output: 7, cacheWrite: 0, cacheRead: 0 });
  });

  it("follows the goal a tool names, update_tasks starts, and leaves the goal on complete_goal or release_goal", () => {
    const file = transcript([
      reply("m1", usage(1, 0), [tool("claim_goal", { goal: "a" }), tool("claim_goal", { goal: "b" })]),
      reply("m2", usage(1, 0), [tool("start_task", { task: "t2", goal: "a" })]),
      reply("m3", usage(2, 0), [tool("update_tasks", { goal: "b", operations: [{ action: "complete", task: "t1" }, { action: "start", task: "t3" }] })]),
      reply("m4", usage(4, 0), [tool("complete_goal", { goal: "b" })]),
      reply("m5", usage(8, 0)),
    ]);
    const book = emptyBook();
    collectTranscript(book, file);
    expect(book.goals.a!.steps.t2!.input).toBe(2); // m3
    expect(book.goals.b!.steps.t3!.input).toBe(4); // m4
    expect(book.other.input).toBe(1 + 8); // m1 (b claimed last, nothing started), then m5 with no goal
    expect(book.goals.b!.usage.input).toBe(1); // m2: b was the latest claimed until start_task named a
  });

  it("reads only what is new on the next run, and keeps the chat's place", () => {
    const file = transcript([reply("m1", usage(1, 0), [tool("claim_goal", { goal: "a" }), tool("start_task", { task: "t1" })])]);
    const book = emptyBook();
    collectTranscript(book, file);
    appendFileSync(file, `${reply("m2", usage(5, 0))}\n${reply("m3", usage(6, 0)).slice(0, 20)}`); // the last line is still being written
    collectTranscript(book, file);
    expect(book.goals.a!.steps.t1!.input).toBe(5);
    appendFileSync(file, `${reply("m3", usage(6, 0)).slice(20)}\n`);
    collectTranscript(book, file);
    expect(book.goals.a!.steps.t1!.input).toBe(11);
  });

  it("skips lines it cannot read, and a missing transcript", () => {
    const file = transcript(["not json", reply("m1", usage(1, 1))]);
    const book = emptyBook();
    collectTranscript(book, file);
    collectTranscript(book, join(tempDir("progressor-cost-"), "gone.jsonl"));
    expect(book.other).toEqual({ input: 1, output: 1, cacheWrite: 0, cacheRead: 0 });
  });
});

describe("the book on disk", () => {
  it("reads an empty book from a missing or damaged file", () => {
    const dir = tempDir("progressor-cost-book-");
    expect(readBook(join(dir, "cost.json"))).toEqual(emptyBook());
    writeFileSync(join(dir, "cost.json"), "{oops");
    expect(readBook(join(dir, "cost.json"))).toEqual(emptyBook());
    const book: CostBook = emptyBook();
    writeFileSync(join(dir, "cost.json"), JSON.stringify(book));
    expect(JSON.parse(readFileSync(join(dir, "cost.json"), "utf8"))).toEqual(book);
  });
});

describe("in plain words", () => {
  it("says tokens briefly", () => {
    expect(tokenWords(950)).toBe("950 tokens");
    expect(tokenWords(12_400)).toBe("12k tokens");
    expect(tokenWords(3_450_000)).toBe("3.5M tokens");
  });

  it("prices tokens like the API: cache writes at 1.25 times input, cache reads at a tenth", () => {
    const u = { input: 1_000_000, output: 1_000_000, cacheWrite: 1_000_000, cacheRead: 1_000_000 };
    expect(money(u, { input: 3, output: 15 })).toBeCloseTo(3 + 15 + 3.75 + 0.3);
    expect(money(u, { input: 0, output: 0 })).toBeUndefined();
  });
});

describe("the hooks count it", () => {
  it("adds a chat's new token use on each message and at the end of each reply, keeping it out of git", async () => {
    const { Project } = await import("../src/project.js");
    const { runHook } = await import("../src/hooks.js");
    const root = tempDir("progressor-cost-hook-");
    const p = new Project({ root, session: { id: "s", pid: process.pid } });
    p.addGoal("Login", [{ title: "Route" }]);
    const file = transcript([reply("m1", usage(1, 0), [tool("claim_goal", { goal: "login" }), tool("start_task", { task: "t1" })])]);
    const env = { PROGRESSOR_ROOT: root, PROGRESSOR_REGISTRY: join(tempDir("progressor-reg-"), "projects.json") };
    runHook({ event: "prompt", input: JSON.stringify({ transcript_path: file }), env, canRun: () => true });
    appendFileSync(file, `${reply("m2", usage(40, 2))}\n`);
    expect(runHook({ event: "stop", input: JSON.stringify({ transcript_path: file }), env, canRun: () => true })).toBe("");
    expect(p.costBook().goals.login!.steps.t1).toEqual({ input: 40, output: 2, cacheWrite: 0, cacheRead: 0 });
    expect(readFileSync(join(root, ".progressor", ".gitignore"), "utf8")).toMatch(/^cost\/$/m);
  });
});
