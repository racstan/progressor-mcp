import {
  type HeadingBlock,
  type ItemBlock,
  type Marker,
  type MarkdownDoc,
  addDetail,
  appendSection,
  appendToSection,
  appendUnder,
  findSection,
  getDetail,
  insertSectionBefore,
  getDetails,
  itemsIn,
  itemsUnder,
  newHeading,
  newItem,
  nextId,
  parseMarkdown,
  serialiseMarkdown,
  setDetail,
} from "./markdown.js";
import { ORIGIN_KEY, type Origin, formatOrigin, parseOrigin } from "./origin.js";

export type TaskStatus =
  | "pending"
  | "in progress"
  | "with a helper"
  | "waiting on you"
  | "checked"
  | "done"
  | "released"
  | "dropped";
export type DetourStatus = "open" | "merged back" | "returned" | "recalibrated";

export interface Task {
  id: string | undefined;
  ref: string | undefined;
  title: string;
  status: TaskStatus;
  line: number;
  /** One or two sentences on the fix or change the Task makes. */
  summary: string | undefined;
  /** The files the Task touches, each optionally with `:line`. */
  code: string[];
  /** The ref of the Task this one was moved from, when it came from another Goal. */
  movedFrom: string | undefined;
  addedBy: string | undefined;
  droppedBy: string | undefined;
  reason: string | undefined;
  /** Set when the Task was last added or changed from another project. */
  updatedFrom?: Origin;
}

export interface Detour {
  id: string | undefined;
  ref: string | undefined;
  title: string;
  line: number;
  branchedFrom: string | undefined;
  reason: string | undefined;
  status: DetourStatus;
}

/** A choice made along the way for one Goal that is not a lasting project rule. */
export interface Decision {
  id: string | undefined;
  ref: string | undefined;
  text: string;
  line: number;
  /** Set when the decision was last added or changed from another project. */
  updatedFrom?: Origin;
}

/** Something spotted that belongs to a Goal, possibly while working on another one. */
export interface Note {
  id: string | undefined;
  ref: string | undefined;
  text: string;
  line: number;
  resolved: boolean;
  /** The Goal that was being worked on when the note was made, if another one. */
  from: string | undefined;
  /** Set when the note was last added or changed from another project. */
  updatedFrom?: Origin;
}

export const TASKS = "Tasks";
export const DECISIONS = "Decisions";
export const NOTES = "Notes";
const DETOUR_PREFIX = "Detour: ";

const TASK_STATUS: Record<Marker, TaskStatus> = {
  " ": "pending",
  "/": "in progress",
  x: "done",
  "-": "dropped",
};
/**
 * The checkbox of every state. The states beyond the four checkboxes are a `state` line under a
 * `[/]` or `[x]` Task, so older readers still see them as started or done.
 */
export const TASK_MARKER: Record<TaskStatus, Marker> = {
  pending: " ",
  "in progress": "/",
  "with a helper": "/",
  "waiting on you": "/",
  checked: "/",
  done: "x",
  released: "x",
  dropped: "-",
};
const STATE_LINE: TaskStatus[] = ["with a helper", "waiting on you", "checked", "released"];
/** Tasks in these states are over: a Goal can be completed once all its Tasks are. */
export const FINISHED: readonly TaskStatus[] = ["done", "released", "dropped"];
/** Started, but in other hands than the Agent's: a helper's, or the Developer's. */
export const ELSEWHERE: readonly TaskStatus[] = ["with a helper", "waiting on you", "checked"];

function taskStatus(b: ItemBlock): TaskStatus {
  const marked = TASK_STATUS[b.marker!];
  const state = getDetail(b, "state") as TaskStatus | undefined;
  return state && STATE_LINE.includes(state) && TASK_MARKER[state] === b.marker ? state : marked;
}
const DETOUR_STATUSES: DetourStatus[] = ["open", "merged back", "returned", "recalibrated"];

/** The `updatedFrom` of an item, left out when the item has no `updated from` line. */
function withOrigin(b: ItemBlock): { updatedFrom?: Origin } {
  const origin = parseOrigin(getDetail(b, ORIGIN_KEY));
  return origin ? { updatedFrom: origin } : {};
}

const stripRef = (v: string | undefined) => v?.replace(/^\^/, "").trim();
const stripTicks = (v: string) => v.replace(/^`(.*)`$/, "$1");

export interface NewTask {
  title: string;
  summary?: string;
  code?: string[];
  /** Added already done, for work that happened before it was recorded. */
  done?: boolean;
}

export interface TaskChanges {
  title?: string;
  /** An empty summary removes it. */
  summary?: string;
  /** Replaces the Task's files. */
  code?: string[];
}

/** Known Task details come first, in this order, when a Task is rewritten; unknown ones follow as they were. */
const DETAIL_ORDER = ["state", "summary", "code", "moved from", "added by", "dropped by", "reason", ORIGIN_KEY];
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function sortDetails(b: ItemBlock): void {
  const rank = (c: ItemBlock["children"][number]) => {
    const i = "key" in c ? DETAIL_ORDER.indexOf(c.key) : -1;
    return i < 0 ? DETAIL_ORDER.length : i;
  };
  b.children = b.children
    .map((c, i) => ({ c, i }))
    .sort((x, y) => rank(x.c) - rank(y.c) || x.i - y.i)
    .map((x) => x.c);
}

/** One Goal's Plan File: its Tasks and Detours. */
export class PlanFile {
  constructor(
    readonly goalId: string,
    private readonly doc: MarkdownDoc,
  ) {}

  ref(id: string | undefined): string | undefined {
    return id ? `progressor://${this.goalId}/${id}` : undefined;
  }

  get title(): string {
    const h = this.doc.blocks.find((b): b is HeadingBlock => b.type === "heading" && b.level === 1);
    return h?.text ?? this.goalId;
  }

  set title(title: string) {
    const h = this.doc.blocks.find((b): b is HeadingBlock => b.type === "heading" && b.level === 1);
    if (h) h.text = oneLine(title);
    else this.doc.blocks.unshift(newHeading(1, oneLine(title)), { type: "text", text: "" });
  }

  private taskBlocks(): ItemBlock[] {
    return itemsIn(this.doc, TASKS).filter((b) => b.marker !== undefined);
  }

  get tasks(): Task[] {
    return this.taskBlocks().map((b) => ({
      id: b.id,
      ref: this.ref(b.id),
      title: b.text,
      status: taskStatus(b),
      line: b.line,
      summary: getDetail(b, "summary"),
      code: getDetails(b, "code").map(stripTicks),
      movedFrom: getDetail(b, "moved from"),
      addedBy: stripRef(getDetail(b, "added by")),
      droppedBy: stripRef(getDetail(b, "dropped by")),
      reason: getDetail(b, "reason"),
      ...withOrigin(b),
    }));
  }

  private detourHeadings(): HeadingBlock[] {
    return this.doc.blocks.filter(
      (b): b is HeadingBlock => b.type === "heading" && b.level === 2 && b.text.startsWith(DETOUR_PREFIX),
    );
  }

  private detourField(h: HeadingBlock, key: string): ItemBlock | undefined {
    return itemsUnder(this.doc, h).find((b) => b.marker === undefined && b.text.startsWith(`${key}:`));
  }

  private detourValue(h: HeadingBlock, key: string): string | undefined {
    const field = this.detourField(h, key);
    if (!field) return undefined;
    // A value that ends in a reference ("branched from: ^t2") parses as an ID marker; put it back.
    const text = field.id ? `${field.text} ^${field.id}` : field.text;
    return text.slice(key.length + 1).trim();
  }

  get detours(): Detour[] {
    return this.detourHeadings().map((h) => {
      const status = this.detourValue(h, "status") as DetourStatus | undefined;
      return {
        id: h.id,
        ref: this.ref(h.id),
        title: h.text.slice(DETOUR_PREFIX.length).trim(),
        line: h.line,
        branchedFrom: stripRef(this.detourValue(h, "branched from")),
        reason: this.detourValue(h, "reason"),
        status: status && DETOUR_STATUSES.includes(status) ? status : "open",
      };
    });
  }

  task(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  detour(id: string): Detour | undefined {
    return this.detours.find((d) => d.id === id);
  }

  get openDetour(): Detour | undefined {
    return this.detours.find((d) => d.status === "open");
  }

  get currentTask(): Task | undefined {
    return this.tasks.find((t) => t.status === "in progress");
  }

  get nextTask(): Task | undefined {
    return this.tasks.find((t) => t.status === "pending");
  }

  private taskBlock(id: string): ItemBlock {
    const b = this.taskBlocks().find((t) => t.id === id);
    if (!b) throw new Error(`No Task ${id} in Goal ${this.goalId}.`);
    return b;
  }

  private allIds(): (string | undefined)[] {
    return [
      ...this.taskBlocks().map((b) => b.id),
      ...this.detourHeadings().map((h) => h.id),
      ...itemsIn(this.doc, DECISIONS).map((b) => b.id),
      ...itemsIn(this.doc, NOTES).map((b) => b.id),
    ];
  }

  /** Gives every Task, Detour, decision and note that has no ID (typed by hand) the next free one. */
  assignMissingIds(): void {
    for (const b of this.taskBlocks()) if (!b.id) b.id = nextId(this.allIds(), "t");
    for (const h of this.detourHeadings()) if (!h.id) h.id = nextId(this.allIds(), "d");
    for (const b of itemsIn(this.doc, DECISIONS)) if (!b.id) b.id = nextId(this.allIds(), "c");
    for (const b of itemsIn(this.doc, NOTES)) if (!b.id) b.id = nextId(this.allIds(), "n");
  }

  addTasks(tasks: NewTask[], addedBy?: string): Task[] {
    this.assignMissingIds();
    const ids: string[] = [];
    const blocks = tasks.map((t) => {
      const id = nextId([...this.allIds(), ...ids], "t");
      ids.push(id);
      const b = newItem({ marker: t.done ? "x" : " ", text: oneLine(t.title), id });
      if (t.summary?.trim()) addDetail(b, "summary", oneLine(t.summary));
      for (const c of t.code ?? []) addDetail(b, "code", `\`${c}\``);
      if (addedBy) addDetail(b, "added by", `^${addedBy}`);
      return b;
    });
    appendToSection(this.doc, TASKS, blocks);
    return ids.map((id) => this.task(id)!);
  }

  /**
   * Adds a copy of a Task from another Goal, with its status, summary and files, and a `moved from`
   * line saying where it came from. It goes to the end of the list, or right before or after another Task.
   */
  importTask(from: Task, movedFrom: string, to: { before?: string; after?: string } = {}): Task {
    if (to.before && to.after) throw new Error("Say before or after, not both.");
    const target = to.before ?? to.after;
    const anchor = target ? this.taskBlock(target) : undefined;
    this.assignMissingIds();
    const id = nextId(this.allIds(), "t");
    const b = newItem({ marker: TASK_MARKER[from.status], text: from.title, id });
    if (STATE_LINE.includes(from.status)) addDetail(b, "state", from.status);
    if (from.summary) addDetail(b, "summary", from.summary);
    for (const c of from.code) addDetail(b, "code", `\`${c}\``);
    addDetail(b, "moved from", movedFrom);
    appendToSection(this.doc, TASKS, [b]);
    if (anchor) {
      this.doc.blocks.splice(this.doc.blocks.indexOf(b), 1);
      this.doc.blocks.splice(this.doc.blocks.indexOf(anchor) + (to.after ? 1 : 0), 0, b);
    }
    return this.task(id)!;
  }

  /** Sets a Task's checkbox, and its `state` line for the states that need one. */
  setTaskStatus(id: string, status: TaskStatus): void {
    const b = this.taskBlock(id);
    b.marker = TASK_MARKER[status];
    setDetail(b, "state", STATE_LINE.includes(status) ? status : undefined);
    sortDetails(b);
  }

  /** Changes a Task's title, summary or files; everything else about it stays. */
  updateTask(id: string, changes: TaskChanges): void {
    const b = this.taskBlock(id);
    if (changes.title?.trim()) b.text = oneLine(changes.title);
    if (changes.summary !== undefined) setDetail(b, "summary", changes.summary.trim() ? oneLine(changes.summary) : undefined);
    if (changes.code) {
      b.children = b.children.filter((c) => !("key" in c && c.key === "code"));
      for (const c of changes.code) addDetail(b, "code", `\`${c}\``);
    }
    sortDetails(b);
  }

  addCode(id: string, code: string[]): void {
    const b = this.taskBlock(id);
    const existing = getDetails(b, "code").map(stripTicks);
    for (const c of code) if (!existing.includes(c)) addDetail(b, "code", `\`${c}\``);
  }

  dropTask(id: string, why: { reason?: string; droppedBy?: string }): void {
    this.setTaskStatus(id, "dropped");
    const b = this.taskBlock(id);
    if (why.droppedBy) setDetail(b, "dropped by", `^${why.droppedBy}`);
    if (why.reason?.trim()) setDetail(b, "reason", oneLine(why.reason));
  }

  startDetour(title: string, reason: string, branchedFrom: string | undefined): Detour {
    this.assignMissingIds();
    const id = nextId(this.allIds(), "d");
    const heading = newHeading(2, `${DETOUR_PREFIX}${oneLine(title)}`, id);
    const fields = [
      ...(branchedFrom ? [`branched from: ^${branchedFrom}`] : []),
      `reason: ${oneLine(reason)}`,
      "status: open",
    ].map((text) => {
      const b = newItem({ marker: undefined, text, id: undefined });
      b.section = heading.text;
      return b;
    });
    appendSection(this.doc, heading, fields);
    return this.detour(id)!;
  }

  setDetourStatus(id: string, status: DetourStatus): void {
    const h = this.detourHeadings().find((d) => d.id === id);
    if (!h) throw new Error(`No Detour ${id} in Goal ${this.goalId}.`);
    const field = this.detourField(h, "status");
    if (field) {
      field.text = `status: ${status}`;
    } else {
      const b = newItem({ marker: undefined, text: `status: ${status}`, id: undefined });
      appendUnder(this.doc, h, [b]);
    }
  }

  // --- decisions and notes ------------------------------------------------------

  get decisions(): Decision[] {
    return itemsIn(this.doc, DECISIONS).map((b) => ({ id: b.id, ref: this.ref(b.id), text: b.text, line: b.line, ...withOrigin(b) }));
  }

  get notes(): Note[] {
    return itemsIn(this.doc, NOTES).map((b) => ({
      id: b.id,
      ref: this.ref(b.id),
      text: b.text,
      line: b.line,
      resolved: b.marker === "x",
      from: getDetail(b, "from"),
      ...withOrigin(b),
    }));
  }

  decision(id: string): Decision | undefined {
    return this.decisions.find((d) => d.id === id);
  }

  note(id: string): Note | undefined {
    return this.notes.find((n) => n.id === id);
  }

  /**
   * Appends items to a section, creating it after the Tasks (before any Detour) when it is missing,
   * so a Plan File reads Tasks, Decisions, Notes, then the Detours as they happened.
   */
  private addToSection(name: string, item: ItemBlock): void {
    const firstDetour = this.detourHeadings()[0];
    if (findSection(this.doc, name) >= 0 || !firstDetour) appendToSection(this.doc, name, [item]);
    else insertSectionBefore(this.doc, firstDetour, newHeading(2, name), [item]);
  }

  private entryBlock(section: string, what: string, id: string): ItemBlock {
    const b = itemsIn(this.doc, section).find((i) => i.id === id);
    if (!b) throw new Error(`No ${what} ${id} in Goal ${this.goalId}.`);
    return b;
  }

  private removeBlock(b: ItemBlock): void {
    this.doc.blocks.splice(this.doc.blocks.indexOf(b), 1);
  }

  addDecision(text: string): Decision {
    this.assignMissingIds();
    const id = nextId(this.allIds(), "c");
    this.addToSection(DECISIONS, newItem({ marker: undefined, text: oneLine(text), id }));
    return this.decision(id)!;
  }

  setDecision(id: string, text: string): Decision {
    this.entryBlock(DECISIONS, "decision", id).text = oneLine(text);
    return this.decision(id)!;
  }

  removeDecision(id: string): void {
    this.removeBlock(this.entryBlock(DECISIONS, "decision", id));
  }

  /** Adds an open note; `from` is the ref of the Goal being worked on when it was spotted. */
  addNote(text: string, from?: string): Note {
    this.assignMissingIds();
    const id = nextId(this.allIds(), "n");
    const b = newItem({ marker: " ", text: oneLine(text), id });
    if (from) addDetail(b, "from", from);
    this.addToSection(NOTES, b);
    return this.note(id)!;
  }

  updateNote(id: string, changes: { text?: string; resolved?: boolean }): Note {
    const b = this.entryBlock(NOTES, "note", id);
    if (changes.text?.trim()) b.text = oneLine(changes.text);
    if (changes.resolved !== undefined) b.marker = changes.resolved ? "x" : " ";
    return this.note(id)!;
  }

  removeNote(id: string): void {
    this.removeBlock(this.entryBlock(NOTES, "note", id));
  }

  /** Marks a Task, decision or note as last changed from another project (an `updated from` line). */
  markOrigin(id: string, origin: Origin): void {
    const b =
      this.taskBlocks().find((t) => t.id === id) ??
      itemsIn(this.doc, DECISIONS).find((d) => d.id === id) ??
      itemsIn(this.doc, NOTES).find((n) => n.id === id);
    if (!b) throw new Error(`No Task, decision or note ${id} in Goal ${this.goalId}.`);
    setDetail(b, ORIGIN_KEY, formatOrigin(origin));
    if (this.taskBlocks().includes(b)) sortDetails(b);
  }

  toString(): string {
    return serialiseMarkdown(this.doc);
  }
}

export function parsePlanFile(source: string, goalId: string): PlanFile {
  return new PlanFile(goalId, parseMarkdown(source));
}

export function newPlanFile(goalId: string, title: string): PlanFile {
  return parsePlanFile(`# ${title}\n\n## ${TASKS}\n`, goalId);
}
