// Cost per goal: how many tokens each goal and step used. Claude Code gives its hooks the chat's
// transcript (a JSONL file): every AI reply there carries its token use, and the chat's own Progressor
// tool calls (claim_goal, update_tasks...; older chats used start_task and complete_task) say which goal and step it was on. The hooks
// read what is new in the transcript on each message (collectTranscript) and add it up in
// .progressor/cost/tokens.json. Nothing needs setting up; a price in Settings turns tokens into money.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The book is .progressor/cost/tokens.json: a folder, so .progressor/.gitignore can keep it on this computer. */
export const COST_DIR = "cost";
export const COST_FILE = "tokens.json";

export interface Usage {
  input: number;
  output: number;
  /** Tokens written to the prompt cache. */
  cacheWrite: number;
  /** Tokens read from the prompt cache: many, but cheap. */
  cacheRead: number;
}

/** Where one chat's transcript was read up to, and the goal and step it was on there. */
interface ChatPlace {
  offset: number;
  goal?: string;
  task?: string;
  /** The last reply counted: a reply can be split over several lines. */
  lastId?: string;
}

export interface CostBook {
  version: 1;
  chats: Record<string, ChatPlace>;
  goals: Record<string, { usage: Usage; steps: Record<string, Usage> }>;
  /** Tokens used while no goal was claimed. */
  other: Usage;
}

export const noUsage = (): Usage => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
export const emptyBook = (): CostBook => ({ version: 1, chats: {}, goals: {}, other: noUsage() });

const add = (to: Usage, u: Usage) => {
  to.input += u.input;
  to.output += u.output;
  to.cacheWrite += u.cacheWrite;
  to.cacheRead += u.cacheRead;
};
export const sumUsage = (list: Usage[]): Usage => {
  const total = noUsage();
  for (const u of list) add(total, u);
  return total;
};
export const totalTokens = (u: Usage): number => u.input + u.output + u.cacheWrite + u.cacheRead;

/** A goal's whole use: its own and its steps'. */
export function goalCost(book: CostBook, goalId: string): Usage {
  const g = book.goals[goalId];
  return g ? sumUsage([g.usage, ...Object.values(g.steps)]) : noUsage();
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** The Progressor tool a tool call is, such as "start_task" from "mcp__progressor__start_task". */
function progressorTool(name: unknown): string | undefined {
  if (typeof name !== "string" || !name.includes("progressor")) return undefined;
  const at = name.lastIndexOf("__");
  return at >= 0 ? name.slice(at + 2) : undefined;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Moves the chat's place on by one Progressor tool call. */
function follow(place: ChatPlace, tool: string, input: Record<string, unknown>): void {
  const goal = str(input.goal);
  const task = str(input.task);
  const sameGoal = !goal || goal === place.goal;
  switch (tool) {
    case "claim_goal":
    case "add_goal":
      if (goal) {
        place.goal = goal;
        delete place.task;
      }
      return;
    case "start_task":
      if (goal) place.goal = goal;
      if (task) place.task = task;
      return;
    case "complete_task":
    case "drop_task":
      if (sameGoal && task === place.task) delete place.task;
      return;
    case "update_tasks": {
      const ops = Array.isArray(input.operations) ? (input.operations as Record<string, unknown>[]) : [];
      for (const op of ops) {
        const action = str(op.action);
        const opGoal = str(op.goal) ?? goal;
        if (action === "start") follow(place, "start_task", { task: op.task, goal: opGoal });
        else if (action === "complete" || action === "drop") follow(place, "complete_task", { task: op.task, goal: opGoal });
      }
      return;
    }
    case "complete_goal":
    case "release_goal":
      if (sameGoal) {
        delete place.goal;
        delete place.task;
      }
      return;
  }
}

/** Adds one transcript line to the book; lines that are not AI replies, or cannot be read, add nothing. */
/** Where a chat's tokens go while its own tool calls name no goal: a helper's step, or the step its parent chat is on. */
export interface CostFallback {
  goal?: string | undefined;
  task?: string | undefined;
}

function addLine(book: CostBook, place: ChatPlace, line: string, fallback?: CostFallback): void {
  let entry: { type?: unknown; message?: { id?: unknown; usage?: Record<string, unknown>; content?: unknown } };
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (entry?.type !== "assistant" || !entry.message) return;
  const m = entry.message;
  const id = typeof m.id === "string" ? m.id : undefined;
  if (m.usage && (!id || id !== place.lastId)) {
    const u: Usage = {
      input: num(m.usage.input_tokens),
      output: num(m.usage.output_tokens),
      cacheWrite: num(m.usage.cache_creation_input_tokens),
      cacheRead: num(m.usage.cache_read_input_tokens),
    };
    const at = place.goal ? place : fallback?.goal ? fallback : undefined;
    if (at?.goal) {
      const g = (book.goals[at.goal] ??= { usage: noUsage(), steps: {} });
      add(at.task ? (g.steps[at.task] ??= noUsage()) : g.usage, u);
    } else add(book.other, u);
  }
  if (id) place.lastId = id;
  // The reply's own tool calls change where the chat is from the next reply on.
  for (const block of Array.isArray(m.content) ? m.content : []) {
    const b = block as { type?: unknown; name?: unknown; input?: unknown };
    const tool = b?.type === "tool_use" ? progressorTool(b.name) : undefined;
    if (tool) follow(place, tool, (b.input && typeof b.input === "object" ? b.input : {}) as Record<string, unknown>);
  }
}

/** Reads what is new in one chat's transcript since the last time, up to its last whole line. */
export function collectTranscript(book: CostBook, file: string, fallback?: CostFallback): void {
  if (!existsSync(file)) return;
  const place = (book.chats[file] ??= { offset: 0 });
  let fd: number | undefined;
  try {
    fd = openSync(file, "r");
    const size = fstatSync(fd).size;
    if (size < place.offset) place.offset = 0; // a transcript started over
    if (size === place.offset) return;
    const buf = Buffer.alloc(size - place.offset);
    readSync(fd, buf, 0, buf.length, place.offset);
    const end = buf.lastIndexOf(0x0a);
    if (end < 0) return; // no whole line yet
    for (const line of buf.subarray(0, end).toString("utf8").split("\n")) if (line.trim()) addLine(book, place, line, fallback);
    place.offset += end + 1;
  } catch {
    // a transcript that cannot be read adds nothing
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Reads what is new in a chat's transcript and in its sub-agents' (Claude Code keeps those in
 * `<transcript>/subagents/*.jsonl`): a sub-agent's tokens go to the step the chat is on, unless its
 * own Progressor calls say otherwise. `fallback` is where the chat's go while it names no goal itself.
 */
export function collectChat(book: CostBook, file: string, fallback?: CostFallback): void {
  collectTranscript(book, file, fallback);
  const place = book.chats[file];
  const parent: CostFallback = place?.goal ? { goal: place.goal, task: place.task } : (fallback ?? {});
  const dir = join(file.replace(/\.jsonl$/i, ""), "subagents");
  let subs: string[] = [];
  try {
    subs = readdirSync(dir).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return; // no sub-agents
  }
  for (const name of subs) collectTranscript(book, join(dir, name), parent);
}

/** The book in .progressor/cost/tokens.json; an empty one when there is none or it cannot be read. */
export function readBook(file: string): CostBook {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as Partial<CostBook>;
    if (data?.version !== 1 || typeof data.goals !== "object" || typeof data.chats !== "object") return emptyBook();
    return { version: 1, chats: data.chats ?? {}, goals: data.goals ?? {}, other: { ...noUsage(), ...data.other } };
  } catch {
    return emptyBook();
  }
}

export function writeBook(file: string, book: CostBook): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(book)}\n`);
  renameSync(tmp, file);
}

export { type Prices, money, moneyWords, tokenWords, costWords } from "./costWords.js";
