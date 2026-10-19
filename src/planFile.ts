import {
  type HeadingBlock,
  type ItemBlock,
  type Marker,
  type MarkdownDoc,
  addDetail,
  appendSection,
  appendToSection,
  getDetail,
  getDetails,
  itemsIn,
  newHeading,
  newItem,
  nextId,
  parseMarkdown,
  serialiseMarkdown,
  setDetail,
} from "./markdown.js";

export type TaskStatus = "pending" | "in progress" | "done" | "dropped";
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
  addedBy: string | undefined;
  droppedBy: string | undefined;
  reason: string | undefined;
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

export const TASKS = "Tasks";
const DETOUR_PREFIX = "Detour: ";

const TASK_STATUS: Record<Marker, TaskStatus> = {
  " ": "pending",
  "/": "in progress",
  x: "done",
  "-": "dropped",
};
const TASK_MARKER: Record<TaskStatus, Marker> = {
  pending: " ",
  "in progress": "/",
  done: "x",
  dropped: "-",
};
const DETOUR_STATUSES: DetourStatus[] = ["open", "merged back", "returned", "recalibrated"];

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
const DETAIL_ORDER = ["summary", "code", "added by", "dropped by", "reason"];
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
      status: TASK_STATUS[b.marker!],
      line: b.line,
      summary: getDetail(b, "summary"),
      code: getDetails(b, "code").map(stripTicks),
      addedBy: stripRef(getDetail(b, "added by")),
      droppedBy: stripRef(getDetail(b, "dropped by")),
      reason: getDetail(b, "reason"),
    }));
  }

  private detourHeadings(): HeadingBlock[] {
    return this.doc.blocks.filter(
      (b): b is HeadingBlock => b.type === "heading" && b.level === 2 && b.text.startsWith(DETOUR_PREFIX),
    );
  }

  private detourField(h: HeadingBlock, key: string): ItemBlock | undefined {
    return itemsIn(this.doc, h.text).find((b) => b.marker === undefined && b.text.startsWith(`${key}:`));
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
    return [...this.taskBlocks().map((b) => b.id), ...this.detourHeadings().map((h) => h.id)];
  }

  /** Gives every Task and Detour that has no ID (typed by hand) the next free one. */
  assignMissingIds(): void {
    for (const b of this.taskBlocks()) if (!b.id) b.id = nextId(this.allIds(), "t");
    for (const h of this.detourHeadings()) if (!h.id) h.id = nextId(this.allIds(), "d");
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

  setTaskStatus(id: string, status: TaskStatus): void {
    this.taskBlock(id).marker = TASK_MARKER[status];
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
    const b = this.taskBlock(id);
    b.marker = TASK_MARKER.dropped;
    if (why.droppedBy) setDetail(b, "dropped by", `^${why.droppedBy}`);
    if (why.reason) setDetail(b, "reason", why.reason);
  }

  startDetour(title: string, reason: string, branchedFrom: string | undefined): Detour {
    this.assignMissingIds();
    const id = nextId(this.allIds(), "d");
    const heading = newHeading(2, `${DETOUR_PREFIX}${title}`, id);
    const fields = [
      ...(branchedFrom ? [`branched from: ^${branchedFrom}`] : []),
      `reason: ${reason}`,
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
      appendToSection(this.doc, h.text, [b]);
    }
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
