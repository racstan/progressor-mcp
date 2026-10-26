import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  type Decision,
  type Detour,
  FINISHED,
  type NewTask,
  type Note,
  type PlanFile,
  type Task,
  type TaskChanges,
  type TaskStatus,
  newPlanFile,
  parsePlanFile,
} from "./planFile.js";
import { unsafeRoot } from "./root.js";
import { type Goal, type Idea, ROADMAP_REF, type Roadmap, type StandingInstruction, parseRoadmap } from "./roadmap.js";

export interface SessionIdentity {
  id: string;
  pid: number;
}

export interface ProjectOptions {
  /** The project folder; progress lives in `<root>/.progressor`. */
  root: string;
  session: SessionIdentity;
  /** Whether a process is still running; used to spot stale Claims. */
  isAlive?: (pid: number) => boolean;
  now?: () => Date;
  /** Why a folder is the wrong place to start a progress record, if it is (see unsafeRoot). */
  unsafe?: (root: string) => string | undefined;
}

export type DetourEnding = "merge back" | "return" | "recalibrate";

export interface NewGoalOptions {
  /** A short ID for the Goal's refs, such as "web-ui"; made from the title when absent. */
  id?: string;
  /** What done looks like. */
  outcome?: string;
  /** Add the Goal even if another one has the same title. */
  allowDuplicate?: boolean;
  /** Record a Goal that is already finished, with its finished Tasks. */
  done?: boolean;
}

export interface Status {
  goal: Goal | undefined;
  planFile: string | undefined;
  currentTask: Task | undefined;
  openDetour: Detour | undefined;
  nextTask: Task | undefined;
  /** Tasks handed to a helper agent. */
  withHelper: Task[];
  /** Tasks the Agent is waiting on the Developer for; while there are any, so is the Goal. */
  waitingOnYou: Task[];
  /** Tasks whose helper's work the Agent has checked, not yet released. */
  checked: Task[];
  /** Done and released Tasks. */
  done: number;
  /** Every Task that is not dropped. */
  total: number;
  decisions: Decision[];
  /** The notes not yet resolved. */
  notes: Note[];
  standingInstructions: StandingInstruction[];
  /** The project's Important context: lasting background, kept by the Agent. */
  context: string;
  /** Every Goal on the Roadmap, so a Session without a Claim can pick one. */
  goals: Goal[];
}

/** Every Goal this Session holds, with what get_status shows besides. */
export interface SessionStatus {
  /** In Roadmap order. */
  held: Status[];
  standingInstructions: StandingInstruction[];
  context: string;
  goals: Goal[];
}

export interface ProjectOverview {
  /** Goals held by a running Session. */
  active: Status[];
  /** Goals started earlier and not held by a running Session. */
  paused: Status[];
  planned: Goal[];
  standingInstructions: StandingInstruction[];
  context: string;
}

export type FoundItem =
  | { kind: "goal"; ref: string; file: string; line: number; item: Goal; planFile: string }
  | { kind: "task"; ref: string; file: string; line: number; item: Task }
  | { kind: "detour"; ref: string; file: string; line: number; item: Detour }
  | { kind: "decision"; ref: string; file: string; line: number; item: Decision }
  | { kind: "note"; ref: string; file: string; line: number; item: Note }
  | { kind: "idea"; ref: string; file: string; line: number; item: Idea }
  | { kind: "standing instruction"; ref: string; file: string; line: number; item: StandingInstruction };

export const PROGRESSOR_DIR = ".progressor";
export const ROADMAP_FILE = "roadmap.md";
export const CONTEXT_FILE = "context.md";
/** The Important context goes to the Agent in full at every session start, so it stays short. */
export const MAX_CONTEXT_LENGTH = 4000;
const CONTEXT_HEADING = "# Important context";

export function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The progress record of one project, as seen by one Session. Every call re-reads the files. */
export class Project {
  private folder: string;
  readonly session: SessionIdentity;
  private readonly isAlive: (pid: number) => boolean;
  private readonly now: () => Date;
  private readonly unsafe: (root: string) => string | undefined;

  constructor(options: ProjectOptions) {
    this.folder = options.root;
    this.session = options.session;
    this.isAlive = options.isAlive ?? processIsAlive;
    this.now = options.now ?? (() => new Date());
    this.unsafe =
      options.unsafe ?? ((root) => unsafeRoot(root, { home: homedir(), systemRoot: process.env.SystemRoot, platform: process.platform }));
  }

  /** The project folder; progress lives in `<root>/.progressor`. */
  get root(): string {
    return this.folder;
  }

  /** Switches to another project folder, once the app has said which folder it has open. */
  moveTo(root: string): void {
    this.folder = root;
  }

  // --- files ---------------------------------------------------------------

  private path(...parts: string[]): string {
    return join(this.root, PROGRESSOR_DIR, ...parts);
  }

  /** Path of a Plan File relative to the project root, using forward slashes. */
  planFilePath(goalId: string): string {
    return `${PROGRESSOR_DIR}/goals/${goalId}.md`;
  }

  private readText(path: string): string | undefined {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  }

  private writeText(path: string, text: string): void {
    if (!existsSync(join(this.root, PROGRESSOR_DIR))) {
      const why = this.unsafe(this.root);
      if (why)
        throw new Error(
          `Progressor will not start a plan in ${this.root}: ${why}, so the app most likely started Progressor outside the project. ` +
            "Open the project's folder in the app, or set PROGRESSOR_ROOT to it in Progressor's MCP settings, then try again.",
        );
    }
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, text);
    try {
      renameSync(tmp, path);
    } catch {
      writeFileSync(path, text);
    }
  }

  roadmap(): Roadmap {
    return parseRoadmap(this.readText(this.path(ROADMAP_FILE)) ?? "");
  }

  plan(goalId: string): PlanFile {
    const text = this.readText(this.path("goals", `${goalId}.md`));
    if (text !== undefined) return parsePlanFile(text, goalId);
    const goal = this.roadmap().goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    return newPlanFile(goalId, goal.title);
  }

  private saveRoadmap(roadmap: Roadmap): void {
    roadmap.assignMissingIds();
    this.writeText(this.path(ROADMAP_FILE), roadmap.toString());
  }

  private savePlan(plan: PlanFile): void {
    plan.assignMissingIds();
    this.writeText(this.path("goals", `${plan.goalId}.md`), plan.toString());
  }

  // --- Claims --------------------------------------------------------------

  /** The Goals this Session has claimed, in Roadmap order. */
  claimedGoals(roadmap = this.roadmap()): Goal[] {
    return roadmap.goals.filter((g) => g.claim?.session === this.session.id && g.status === "active");
  }

  /** The Goal this Session has claimed, when it holds exactly one. */
  claimedGoal(roadmap = this.roadmap()): Goal | undefined {
    const held = this.claimedGoals(roadmap);
    return held.length === 1 ? held[0] : undefined;
  }

  /**
   * The claimed Goal a change is for: the one named, which this Session must hold, or else the only
   * one it holds.
   */
  private requireClaim(goalId?: string): { goal: Goal; plan: PlanFile } {
    const roadmap = this.roadmap();
    const held = this.claimedGoals(roadmap);
    if (goalId !== undefined) {
      const goal = held.find((g) => g.id === goalId);
      if (goal) return { goal, plan: this.plan(goal.id) };
      if (!roadmap.goal(goalId)) throw new Error(`No Goal ${goalId} on the Roadmap.`);
      throw new Error(`Goal ${goalId} is not claimed by this Session; claim it first (claim_goal).`);
    }
    if (held.length === 0) throw new Error("This Session has no Goal; claim a Goal first (claim_goal).");
    if (held.length > 1)
      throw new Error(`This Session holds several Goals (${held.map((g) => g.id).join(", ")}); say which with goal.`);
    return { goal: held[0]!, plan: this.plan(held[0]!.id) };
  }

  /** A Claim is stale when the process that holds it is no longer running. */
  private claimIsLive(goal: Goal): boolean {
    const claim = goal.claim;
    if (!claim || claim.session === this.session.id) return false;
    return claim.pid === undefined || this.isAlive(claim.pid);
  }

  /**
   * Claims a Goal for this Session, which keeps any other Goals it holds. Claiming a done Goal
   * reopens it, so Tasks found in a later review join the same list; its finished Tasks stay done.
   */
  claimGoal(goalId: string, options: { takeover?: boolean } = {}): Goal {
    const roadmap = this.roadmap();
    const goal = roadmap.goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    if (goal.status === "dropped") throw new Error(`Goal ${goalId} is dropped; add a new Goal instead.`);
    if (this.claimIsLive(goal) && !options.takeover)
      throw new Error(
        `Goal ${goalId} is claimed by Session ${goal.claim!.session} (pid ${goal.claim!.pid ?? "unknown"}), which is still running. ` +
          "Pick another Goal, or take it over only if the Developer asks.",
      );
    roadmap.setClaim(goalId, { session: this.session.id, pid: this.session.pid, since: this.now().toISOString() });
    roadmap.setGoalStatus(goalId, "started");
    this.saveRoadmap(roadmap);
    return roadmap.goal(goalId)!;
  }

  /** Releases this Session's Claim on a Goal, leaving it paused. Returns the released Goal, if any. */
  releaseGoal(goalId?: string): Goal | undefined {
    if (goalId === undefined && this.claimedGoals().length === 0) return undefined;
    const { goal } = this.requireClaim(goalId);
    const roadmap = this.roadmap();
    roadmap.setClaim(goal.id, undefined);
    this.saveRoadmap(roadmap);
    return roadmap.goal(goal.id);
  }

  /** Releases every Goal this Session holds, as it ends. */
  releaseAll(): void {
    const roadmap = this.roadmap();
    const held = this.claimedGoals(roadmap);
    if (held.length === 0) return;
    for (const g of held) roadmap.setClaim(g.id, undefined);
    this.saveRoadmap(roadmap);
  }

  // --- Goals and Tasks -----------------------------------------------------

  /** Marks a claimed Goal done and releases it, once every Task is done, released or dropped and no Detour is open. */
  completeGoal(goalId?: string): Goal {
    const { goal, plan } = this.requireClaim(goalId);
    const open = plan.tasks.filter((t) => !FINISHED.includes(t.status));
    if (open.length > 0)
      throw new Error(
        `Goal ${goal.id} is not finished: ${open.map((t) => `${t.id} ${t.title} (${t.status})`).join(", ")}. Complete, release or drop ${open.length === 1 ? "it" : "them"} first.`,
      );
    if (plan.openDetour)
      throw new Error(`Goal ${goal.id} has an open Detour, "${plan.openDetour.title}". End it with end_detour first.`);
    const roadmap = this.roadmap();
    roadmap.setClaim(goal.id, undefined);
    roadmap.setGoalStatus(goal.id, "done");
    this.saveRoadmap(roadmap);
    return roadmap.goal(goal.id)!;
  }

  /**
   * Adds a Goal to the end of the Roadmap. A title some other Goal already has (not counting dropped
   * ones) is refused unless `allowDuplicate`, since it is usually a mistake. `done` records a Goal
   * that was finished before it was recorded; all its Tasks must then be done too.
   */
  addGoal(title: string, tasks: NewTask[] = [], options: NewGoalOptions = {}): Goal {
    const roadmap = this.roadmap();
    const key = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
    const same = roadmap.goals.find((g) => g.status !== "dropped" && key(g.title) === key(title));
    if (same && !options.allowDuplicate)
      throw new Error(
        `There is already a Goal "${same.title}" (${same.id}, ${same.status}). Use that one, or pass allow_duplicate: true to add another.`,
      );
    const unfinished = options.done ? tasks.find((t) => !t.done) : undefined;
    if (unfinished) throw new Error(`Task "${unfinished.title}" is not done, so the Goal cannot be recorded as done.`);
    const goal = roadmap.addGoal(title, { id: options.id, outcome: options.outcome });
    if (options.done) roadmap.setGoalStatus(goal.id, "done");
    const plan = newPlanFile(goal.id, title);
    if (tasks.length > 0) plan.addTasks(tasks);
    this.saveRoadmap(roadmap);
    this.savePlan(plan);
    return roadmap.goal(goal.id)!;
  }

  /** Renames a Goal or changes its Outcome; its ID, refs and Plan File stay the same. Needs no Claim. */
  updateGoal(goalId: string, changes: { title?: string; outcome?: string }): Goal {
    const roadmap = this.roadmap();
    roadmap.updateGoal(goalId, changes);
    this.saveRoadmap(roadmap);
    if (changes.title?.trim()) {
      const plan = this.plan(goalId);
      plan.title = changes.title;
      this.savePlan(plan);
    }
    return roadmap.goal(goalId)!;
  }

  /** Moves a Goal right before or after another, to put the Roadmap in the order the work should happen. */
  moveGoal(goalId: string, to: { before?: string; after?: string }): Goal[] {
    const roadmap = this.roadmap();
    roadmap.moveGoal(goalId, to);
    this.saveRoadmap(roadmap);
    return this.roadmap().goals;
  }

  /** Drops a Goal that will not be done, with the reason; releases this Session's Claim on it. */
  dropGoal(goalId: string, reason: string): Goal {
    const roadmap = this.roadmap();
    const goal = roadmap.goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    if (goal.status === "done" || goal.status === "dropped") throw new Error(`Goal ${goalId} is already ${goal.status}.`);
    if (this.claimIsLive(goal))
      throw new Error(`Goal ${goalId} is claimed by Session ${goal.claim!.session}, which is still running; it cannot be dropped from here.`);
    roadmap.setClaim(goalId, undefined);
    roadmap.setGoalStatus(goalId, "dropped");
    roadmap.setGoalReason(goalId, reason);
    this.saveRoadmap(roadmap);
    return roadmap.goal(goalId)!;
  }

  /** Appends Tasks to the end of a claimed Goal's Task list. */
  addTasks(tasks: NewTask[], goalId?: string): Task[] {
    const { plan } = this.requireClaim(goalId);
    const added = plan.addTasks(tasks);
    this.savePlan(plan);
    return added;
  }

  /** Puts a Task in the Agent's own hands; only one Task of a Goal can be in progress. */
  startTask(id: string, goalId?: string): Task {
    const { plan } = this.requireClaim(goalId);
    const task = this.taskIn(plan, id);
    const current = plan.currentTask;
    if (current && current.id !== id)
      throw new Error(`Task ${current.id} is already in progress; complete or drop it first.`);
    if (FINISHED.includes(task.status)) throw new Error(`Task ${id} is already ${task.status}.`);
    plan.setTaskStatus(id, "in progress");
    this.savePlan(plan);
    return plan.task(id)!;
  }

  /**
   * Moves a Task to any state but dropped (drop_task, which wants a reason). In progress follows
   * start_task's rule; several Tasks may be with a helper, waiting on the Developer or checked.
   */
  setTaskState(id: string, state: Exclude<TaskStatus, "dropped">, goalId?: string): Task {
    if (state === "in progress") return this.startTask(id, goalId);
    const { plan } = this.requireClaim(goalId);
    const task = this.taskIn(plan, id);
    if (task.status === "dropped") throw new Error(`Task ${id} is dropped; add a new Task instead.`);
    plan.setTaskStatus(id, state);
    this.savePlan(plan);
    return plan.task(id)!;
  }

  /** Changes a Task's title, summary or files (which replace the old ones). */
  updateTask(id: string, changes: TaskChanges, goalId?: string): Task {
    const { plan } = this.requireClaim(goalId);
    this.taskIn(plan, id);
    plan.updateTask(id, changes);
    this.savePlan(plan);
    return plan.task(id)!;
  }

  /**
   * Marks a Task done, adding the files it touched and, optionally, the summary of what it changed.
   * A released Task stays released.
   */
  completeTask(id: string, code: string[] = [], summary?: string, goalId?: string): Task {
    const { plan } = this.requireClaim(goalId);
    if (this.taskIn(plan, id).status !== "released") plan.setTaskStatus(id, "done");
    if (code.length > 0) plan.addCode(id, code);
    if (summary?.trim()) plan.updateTask(id, { summary });
    this.savePlan(plan);
    return plan.task(id)!;
  }

  dropTask(id: string, reason: string, goalId?: string): Task {
    const { plan } = this.requireClaim(goalId);
    this.taskIn(plan, id);
    plan.dropTask(id, { reason });
    this.savePlan(plan);
    return plan.task(id)!;
  }

  private taskIn(plan: PlanFile, id: string): Task {
    plan.assignMissingIds();
    const task = plan.task(id);
    if (!task) throw new Error(`No Task ${id} in Goal ${plan.goalId}.`);
    return task;
  }

  // --- Detours -------------------------------------------------------------

  /** Declares that the work is splitting off from the plan, branching from the current Task. */
  startDetour(title: string, reason: string, goalId?: string): Detour {
    const { plan } = this.requireClaim(goalId);
    const open = plan.openDetour;
    if (open) throw new Error(`Detour ${open.id} is still open; end it (end_detour) before starting another.`);
    const detour = plan.startDetour(title, reason, plan.currentTask?.id);
    this.savePlan(plan);
    return detour;
  }

  /**
   * Ends the open Detour. Merge back leaves the Tasks alone; Return appends `tasks` (if any) to the
   * Task list; Recalibration drops every remaining Task and appends `tasks` as the new list.
   */
  endDetour(ending: DetourEnding, tasks: NewTask[] = [], goalId?: string): { detour: Detour; added: Task[]; dropped: Task[] } {
    const { plan } = this.requireClaim(goalId);
    const detour = plan.openDetour;
    if (!detour?.id) throw new Error("No open Detour to end.");
    let added: Task[] = [];
    let dropped: Task[] = [];
    if (ending === "merge back") {
      plan.setDetourStatus(detour.id, "merged back");
    } else if (ending === "return") {
      plan.setDetourStatus(detour.id, "returned");
      if (tasks.length > 0) added = plan.addTasks(tasks, detour.id);
    } else {
      if (tasks.length === 0) throw new Error("A Recalibration needs the new Task list that replaces the remaining Tasks.");
      plan.setDetourStatus(detour.id, "recalibrated");
      dropped = plan.tasks.filter((t) => !FINISHED.includes(t.status));
      for (const t of dropped) plan.dropTask(t.id!, { droppedBy: detour.id });
      added = plan.addTasks(tasks, detour.id);
    }
    this.savePlan(plan);
    return { detour: plan.detour(detour.id)!, added, dropped: dropped.map((t) => plan.task(t.id!)!) };
  }

  // --- decisions and notes ---------------------------------------------------

  /** Records a choice made for a claimed Goal that is not a lasting project rule. */
  addDecision(text: string, goalId?: string): Decision {
    const { plan } = this.requireClaim(goalId);
    const decision = plan.addDecision(text);
    this.savePlan(plan);
    return decision;
  }

  /** Rewords a decision, or removes it when the text is empty; returns undefined when removed. */
  updateDecision(id: string, text: string, goalId?: string): Decision | undefined {
    const { plan } = this.requireClaim(goalId);
    plan.assignMissingIds();
    let result: Decision | undefined;
    if (text.trim()) result = plan.setDecision(id, text);
    else plan.removeDecision(id);
    this.savePlan(plan);
    return result;
  }

  /** A Goal a note can go to: any Goal on the Roadmap that is not dropped, claimed or not. */
  private notable(goalId: string): PlanFile {
    const goal = this.roadmap().goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    if (goal.status === "dropped") throw new Error(`Goal ${goalId} is dropped; put the note on another Goal.`);
    return this.plan(goalId);
  }

  /**
   * Notes something that belongs to a Goal, which may not be the one being worked on; then the
   * note says which Goal that was (when this Session holds just one).
   */
  addNote(goalId: string, text: string): Note {
    const plan = this.notable(goalId);
    const working = this.claimedGoal();
    const note = plan.addNote(text, working && working.id !== goalId ? working.ref : undefined);
    this.savePlan(plan);
    return note;
  }

  /** Rewords or resolves a note, or removes it when the text is empty; returns undefined when removed. */
  updateNote(goalId: string, id: string, changes: { text?: string; resolved?: boolean }): Note | undefined {
    const plan = this.notable(goalId);
    plan.assignMissingIds();
    let result: Note | undefined;
    if (changes.text !== undefined && !changes.text.trim()) plan.removeNote(id);
    else result = plan.updateNote(id, changes);
    this.savePlan(plan);
    return result;
  }

  // --- Ideas and Standing Instructions --------------------------------------

  recordIdea(title: string, note?: string): Idea {
    const roadmap = this.roadmap();
    const idea = roadmap.addIdea(title, note);
    this.saveRoadmap(roadmap);
    return idea;
  }

  /** Turns an Idea into a Task in the claimed Goal, or into a new Goal on the Roadmap. */
  promoteIdea(ideaId: string, to: "task"): Task;
  promoteIdea(ideaId: string, to: "goal"): Goal;
  promoteIdea(ideaId: string, to: "task" | "goal"): Task | Goal;
  promoteIdea(ideaId: string, to: "task" | "goal"): Task | Goal {
    const idea = this.roadmap().idea(ideaId);
    if (!idea) throw new Error(`No Idea ${ideaId} on the Roadmap.`);
    if (idea.promotedTo) throw new Error(`Idea ${ideaId} was already promoted to ${idea.promotedTo}.`);
    let promoted: Task | Goal;
    if (to === "task") {
      const { plan } = this.requireClaim();
      promoted = plan.addTasks([{ title: idea.title }])[0]!;
      this.savePlan(plan);
    } else {
      promoted = this.addGoal(idea.title);
    }
    const roadmap = this.roadmap();
    roadmap.setPromotedTo(ideaId, promoted.ref!);
    this.saveRoadmap(roadmap);
    return promoted;
  }

  addStandingInstruction(text: string): StandingInstruction {
    const roadmap = this.roadmap();
    const instruction = roadmap.addStandingInstruction(text);
    this.saveRoadmap(roadmap);
    return instruction;
  }

  /** Rewords a Standing Instruction, or removes it when the text is empty; returns undefined when removed. */
  updateStandingInstruction(id: string, text: string): StandingInstruction | undefined {
    const roadmap = this.roadmap();
    let result: StandingInstruction | undefined;
    if (text.trim()) result = roadmap.setStandingInstruction(id, text);
    else roadmap.removeStandingInstruction(id);
    this.saveRoadmap(roadmap);
    return result;
  }

  // --- Important context -----------------------------------------------------

  /** The Important context, without the file's heading; empty when there is none. */
  context(): string {
    const text = this.readText(this.path(CONTEXT_FILE)) ?? "";
    return text.replace(/^\s*# Important context[^\S\n]*\n/, "").trim();
  }

  /** Replaces the Important context; empty text clears it. */
  setContext(text: string): string {
    const context = text.trim();
    if (context.length > MAX_CONTEXT_LENGTH)
      throw new Error(
        `The Important context is too long: ${context.length} characters, and the limit is ${MAX_CONTEXT_LENGTH}. ` +
          "Keep only what matters in every conversation, and shorten the rest.",
      );
    this.writeText(this.path(CONTEXT_FILE), context ? `${CONTEXT_HEADING}\n\n${context}\n` : `${CONTEXT_HEADING}\n`);
    return context;
  }

  // --- lookup ----------------------------------------------------------------

  /** Finds any item by its ref, such as `progressor://login/t2` or `progressor://roadmap/i1`. */
  getItem(ref: string): FoundItem {
    const m = /^progressor:\/\/([^/\s]+)(?:\/([^/\s]+))?\/?$/.exec(ref.trim());
    if (!m) throw new Error(`"${ref}" is not a ref; refs look like progressor://<goal>/<item>.`);
    const [, scope, id] = m as unknown as [string, string, string | undefined];
    const roadmapFile = `${PROGRESSOR_DIR}/${ROADMAP_FILE}`;
    const missing = () => new Error(`No item ${ref}.`);

    if (scope === ROADMAP_REF) {
      const roadmap = this.roadmap();
      const idea = id ? roadmap.idea(id) : undefined;
      if (idea) return { kind: "idea", ref, file: roadmapFile, line: idea.line, item: idea };
      const instruction = id ? roadmap.standingInstruction(id) : undefined;
      if (instruction) return { kind: "standing instruction", ref, file: roadmapFile, line: instruction.line, item: instruction };
      throw missing();
    }
    const goal = this.roadmap().goal(scope);
    if (!goal) throw missing();
    if (!id) return { kind: "goal", ref, file: roadmapFile, line: goal.line, item: goal, planFile: this.planFilePath(scope) };
    const plan = this.plan(scope);
    const file = this.planFilePath(scope);
    const task = plan.task(id);
    if (task) return { kind: "task", ref, file, line: task.line, item: task };
    const detour = plan.detour(id);
    if (detour) return { kind: "detour", ref, file, line: detour.line, item: detour };
    const decision = plan.decision(id);
    if (decision) return { kind: "decision", ref, file, line: decision.line, item: decision };
    const note = plan.note(id);
    if (note) return { kind: "note", ref, file, line: note.line, item: note };
    throw missing();
  }

  // --- status --------------------------------------------------------------

  /** The status of a Goal: the one named, else the one this Session holds (the first, if it holds several). */
  status(goalId?: string): Status {
    const roadmap = this.roadmap();
    return this.goalStatus(goalId ? roadmap.goal(goalId) : this.claimedGoals(roadmap)[0], roadmap);
  }

  /** Every Goal this Session holds, for get_status. */
  sessionStatus(): SessionStatus {
    const roadmap = this.roadmap();
    return {
      held: this.claimedGoals(roadmap).map((g) => this.goalStatus(g, roadmap)),
      standingInstructions: roadmap.standingInstructions,
      context: this.context(),
      goals: roadmap.goals,
    };
  }

  /**
   * Every started Goal, split into the ones a running Session holds and the ones left part-way, for
   * readers that are not a Session themselves, such as the Claude Code hooks.
   */
  overview(): ProjectOverview {
    const roadmap = this.roadmap();
    const held = (g: Goal) => g.status === "active" && g.claim !== undefined && (g.claim.pid === undefined || this.isAlive(g.claim.pid));
    const started = roadmap.goals.filter((g) => g.status === "active" || g.status === "paused");
    return {
      active: started.filter(held).map((g) => this.goalStatus(g, roadmap)),
      paused: started.filter((g) => !held(g)).map((g) => this.goalStatus(g, roadmap)),
      planned: roadmap.goals.filter((g) => g.status === "planned"),
      standingInstructions: roadmap.standingInstructions,
      context: this.context(),
    };
  }

  private goalStatus(goal: Goal | undefined, roadmap: Roadmap): Status {
    const common = { standingInstructions: roadmap.standingInstructions, context: this.context(), goals: roadmap.goals };
    if (!goal)
      return {
        goal,
        planFile: undefined,
        currentTask: undefined,
        openDetour: undefined,
        nextTask: undefined,
        withHelper: [],
        waitingOnYou: [],
        checked: [],
        done: 0,
        total: 0,
        decisions: [],
        notes: [],
        ...common,
      };
    const plan = this.plan(goal.id);
    const live = plan.tasks.filter((t) => t.status !== "dropped");
    const inState = (status: TaskStatus) => plan.tasks.filter((t) => t.status === status);
    return {
      goal,
      planFile: this.planFilePath(goal.id),
      currentTask: plan.currentTask,
      openDetour: plan.openDetour,
      nextTask: plan.nextTask,
      withHelper: inState("with a helper"),
      waitingOnYou: inState("waiting on you"),
      checked: inState("checked"),
      done: live.filter((t) => t.status === "done" || t.status === "released").length,
      total: live.length,
      decisions: plan.decisions,
      notes: plan.notes.filter((n) => !n.resolved),
      ...common,
    };
  }
}
