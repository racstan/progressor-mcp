import {
  type ItemBlock,
  type Marker,
  type MarkdownDoc,
  addDetail,
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

/** What the checkbox says; whether a started Goal is active or paused depends on its Claim. */
export type GoalMarker = "planned" | "started" | "done" | "dropped";
export type GoalStatus = "planned" | "active" | "paused" | "done" | "dropped";

export interface Claim {
  session: string;
  pid: number | undefined;
  since: string | undefined;
}

export interface Goal {
  id: string;
  ref: string;
  title: string;
  status: GoalStatus;
  line: number;
  claim: Claim | undefined;
}

export interface Idea {
  id: string | undefined;
  ref: string | undefined;
  title: string;
  line: number;
  notes: string[];
  promotedTo: string | undefined;
}

export interface StandingInstruction {
  id: string | undefined;
  ref: string | undefined;
  text: string;
  line: number;
}

export const GOALS = "Goals";
export const IDEAS = "Ideas";
export const STANDING_INSTRUCTIONS = "Standing Instructions";
export const ROADMAP_REF = "roadmap";

const GOAL_MARKER: Record<GoalMarker, Marker> = { planned: " ", started: "/", done: "x", dropped: "-" };
const LINK = /^\[(.*)\]\((.*)\)$/;
const CLAIM = /^(\S+)(?:\s+\(pid (\d+)\))?(?:\s+since\s+(\S+))?/;

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "goal";
}

function parseClaim(value: string | undefined): Claim | undefined {
  const m = value ? CLAIM.exec(value.trim()) : null;
  if (!m) return undefined;
  return { session: m[1]!, pid: m[2] ? Number(m[2]) : undefined, since: m[3] };
}

function formatClaim(c: Claim): string {
  return `${c.session}${c.pid !== undefined ? ` (pid ${c.pid})` : ""}${c.since ? ` since ${c.since}` : ""}`;
}

/** roadmap.md: the Goals, Ideas and Standing Instructions of a project. */
export class Roadmap {
  constructor(private readonly doc: MarkdownDoc) {}

  private goalBlocks(): ItemBlock[] {
    return itemsIn(this.doc, GOALS).filter((b) => b.marker !== undefined && b.id);
  }

  private ideaBlocks(): ItemBlock[] {
    return itemsIn(this.doc, IDEAS);
  }

  private instructionBlocks(): ItemBlock[] {
    return itemsIn(this.doc, STANDING_INSTRUCTIONS);
  }

  get goals(): Goal[] {
    return this.goalBlocks().map((b) => {
      const claim = parseClaim(getDetail(b, "claimed by"));
      const link = LINK.exec(b.text);
      const status: GoalStatus =
        b.marker === "x" ? "done" : b.marker === "-" ? "dropped" : claim ? "active" : b.marker === "/" ? "paused" : "planned";
      return {
        id: b.id!,
        ref: `progressor://${b.id}`,
        title: link ? link[1]! : b.text,
        status,
        line: b.line,
        claim,
      };
    });
  }

  get ideas(): Idea[] {
    return this.ideaBlocks().map((b) => ({
      id: b.id,
      ref: b.id ? `progressor://${ROADMAP_REF}/${b.id}` : undefined,
      title: b.text,
      line: b.line,
      notes: getDetails(b, "note"),
      promotedTo: getDetail(b, "promoted to"),
    }));
  }

  get standingInstructions(): StandingInstruction[] {
    return this.instructionBlocks().map((b) => ({
      id: b.id,
      ref: b.id ? `progressor://${ROADMAP_REF}/${b.id}` : undefined,
      text: b.text,
      line: b.line,
    }));
  }

  goal(id: string): Goal | undefined {
    return this.goals.find((g) => g.id === id);
  }

  idea(id: string): Idea | undefined {
    return this.ideas.find((i) => i.id === id);
  }

  standingInstruction(id: string): StandingInstruction | undefined {
    return this.standingInstructions.find((s) => s.id === id);
  }

  private goalBlock(id: string): ItemBlock {
    const b = this.goalBlocks().find((g) => g.id === id);
    if (!b) throw new Error(`No Goal ${id} on the Roadmap.`);
    return b;
  }

  /** Gives every Idea and Standing Instruction typed by hand without an ID the next free one. */
  assignMissingIds(): void {
    for (const b of itemsIn(this.doc, GOALS)) if (b.marker !== undefined && !b.id) b.id = this.freeGoalId(b.text);
    for (const b of this.ideaBlocks()) if (!b.id) b.id = nextId(this.ideaBlocks().map((i) => i.id), "i");
    for (const b of this.instructionBlocks())
      if (!b.id) b.id = nextId(this.instructionBlocks().map((i) => i.id), "s");
  }

  private ensureTitle(): void {
    if (this.doc.blocks.length === 0) {
      this.doc.blocks.push(newHeading(1, "Roadmap"));
      this.doc.finalNewline = true;
    }
  }

  private freeGoalId(title: string): string {
    const base = slugify(LINK.exec(title)?.[1] ?? title);
    const taken = new Set([ROADMAP_REF, ...itemsIn(this.doc, GOALS).map((b) => b.id)]);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  addGoal(title: string): Goal {
    this.ensureTitle();
    this.assignMissingIds();
    const id = this.freeGoalId(title);
    appendToSection(this.doc, GOALS, [newItem({ marker: " ", text: `[${title}](goals/${id}.md)`, id })]);
    return this.goal(id)!;
  }

  setGoalStatus(id: string, status: GoalMarker): void {
    this.goalBlock(id).marker = GOAL_MARKER[status];
  }

  setClaim(id: string, claim: Claim | undefined): void {
    setDetail(this.goalBlock(id), "claimed by", claim && formatClaim(claim));
  }

  addIdea(title: string, note?: string): Idea {
    this.ensureTitle();
    this.assignMissingIds();
    const id = nextId(this.ideaBlocks().map((i) => i.id), "i");
    const b = newItem({ marker: undefined, text: title, id });
    if (note) addDetail(b, "note", note);
    appendToSection(this.doc, IDEAS, [b]);
    return this.idea(id)!;
  }

  setPromotedTo(ideaId: string, ref: string): void {
    const b = this.ideaBlocks().find((i) => i.id === ideaId);
    if (!b) throw new Error(`No Idea ${ideaId} on the Roadmap.`);
    setDetail(b, "promoted to", ref);
  }

  addStandingInstruction(text: string): StandingInstruction {
    this.ensureTitle();
    this.assignMissingIds();
    const id = nextId(this.instructionBlocks().map((i) => i.id), "s");
    appendToSection(this.doc, STANDING_INSTRUCTIONS, [newItem({ marker: undefined, text, id })]);
    return this.standingInstruction(id)!;
  }

  toString(): string {
    return serialiseMarkdown(this.doc);
  }
}

export function parseRoadmap(source: string): Roadmap {
  return new Roadmap(parseMarkdown(source));
}
