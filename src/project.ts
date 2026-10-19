import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Detour, type NewTask, type PlanFile, type Task, type TaskChanges, newPlanFile, parsePlanFile } from "./planFile.js";
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
  done: number;
  total: number;
  standingInstructions: StandingInstruction[];
  /** Every Goal on the Roadmap, so a Session without a Claim can pick one. */
  goals: Goal[];
}

export interface ProjectOverview {
  /** Goals held by a running Session. */
  active: Status[];
  /** Goals started earlier and not held by a running Session. */
  paused: Status[];
  planned: Goal[];
  standingInstructions: StandingInstruction[];
}

export type FoundItem =
  | { kind: "goal"; ref: string; file: string; line: number; item: Goal; planFile: string }
  | { kind: "task"; ref: string; file: string; line: number; item: Task }
  | { kind: "detour"; ref: string; file: string; line: number; item: Detour }
  | { kind: "idea"; ref: string; file: string; line: number; item: Idea }
  | { kind: "standing instruction"; ref: string; file: string; line: number; item: StandingInstruction };

export const PROGRESSOR_DIR = ".progressor";
export const ROADMAP_FILE = "roadmap.md";

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
  readonly root: string;
  readonly session: SessionIdentity;
  private readonly isAlive: (pid: number) => boolean;
  private readonly now: () => Date;

  constructor(options: ProjectOptions) {
    this.root = options.root;
    this.session = options.session;
    this.isAlive = options.isAlive ?? processIsAlive;
    this.now = options.now ?? (() => new Date());
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

  /** The Goal this Session has claimed, if any. */
  claimedGoal(roadmap = this.roadmap()): Goal | undefined {
    return roadmap.goals.find((g) => g.claim?.session === this.session.id && g.status === "active");
  }

  private requireClaim(): { goal: Goal; plan: PlanFile } {
    const goal = this.claimedGoal();
    if (!goal) throw new Error("This Session has no Goal; claim a Goal first (claim_goal).");
    return { goal, plan: this.plan(goal.id) };
  }

  /** A Claim is stale when the process that holds it is no longer running. */
  private claimIsLive(goal: Goal): boolean {
    const claim = goal.claim;
    if (!claim || claim.session === this.session.id) return false;
    return claim.pid === undefined || this.isAlive(claim.pid);
  }

  /**
   * Claims a Goal for this Session, releasing (pausing) any Goal it held before. Claiming a done Goal
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
    const previous = this.claimedGoal(roadmap);
    if (previous && previous.id !== goalId) roadmap.setClaim(previous.id, undefined);
    roadmap.setClaim(goalId, { session: this.session.id, pid: this.session.pid, since: this.now().toISOString() });
    roadmap.setGoalStatus(goalId, "started");
    this.saveRoadmap(roadmap);
    return roadmap.goal(goalId)!;
  }

  /** Releases this Session's Claim, leaving the Goal paused. Returns the released Goal, if any. */
  releaseGoal(): Goal | undefined {
    const roadmap = this.roadmap();
    const goal = this.claimedGoal(roadmap);
    if (!goal) return undefined;
    roadmap.setClaim(goal.id, undefined);
    this.saveRoadmap(roadmap);
    return roadmap.goal(goal.id);
  }

  // --- Goals and Tasks -----------------------------------------------------

  /** Marks the claimed Goal done and releases it. */
  completeGoal(): Goal {
    const { goal } = this.requireClaim();
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

  /** Appends Tasks to the end of the claimed Goal's Task list. */
  addTasks(tasks: NewTask[]): Task[] {
    const { plan } = this.requireClaim();
    const added = plan.addTasks(tasks);
    this.savePlan(plan);
    return added;
  }

  startTask(id: string): Task {
    const { plan } = this.requireClaim();
    const task = this.taskIn(plan, id);
    const current = plan.currentTask;
    if (current && current.id !== id)
      throw new Error(`Task ${current.id} is already in progress; complete or drop it first.`);
    if (task.status === "done" || task.status === "dropped") throw new Error(`Task ${id} is already ${task.status}.`);
    plan.setTaskStatus(id, "in progress");
    this.savePlan(plan);
    return plan.task(id)!;
  }

  /** Changes a Task's title, summary or files (which replace the old ones). */
  updateTask(id: string, changes: TaskChanges): Task {
    const { plan } = this.requireClaim();
    this.taskIn(plan, id);
    plan.updateTask(id, changes);
    this.savePlan(plan);
    return plan.task(id)!;
  }

  /** Marks a Task done, adding the files it touched and, optionally, the summary of what it changed. */
  completeTask(id: string, code: string[] = [], summary?: string): Task {
    const { plan } = this.requireClaim();
    this.taskIn(plan, id);
    plan.setTaskStatus(id, "done");
    if (code.length > 0) plan.addCode(id, code);
    if (summary?.trim()) plan.updateTask(id, { summary });
    this.savePlan(plan);
    return plan.task(id)!;
  }

  dropTask(id: string, reason: string): Task {
    const { plan } = this.requireClaim();
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
  startDetour(title: string, reason: string): Detour {
    const { plan } = this.requireClaim();
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
  endDetour(ending: DetourEnding, tasks: NewTask[] = []): { detour: Detour; added: Task[]; dropped: Task[] } {
    const { plan } = this.requireClaim();
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
      dropped = plan.tasks.filter((t) => t.status === "pending" || t.status === "in progress");
      for (const t of dropped) plan.dropTask(t.id!, { droppedBy: detour.id });
      added = plan.addTasks(tasks, detour.id);
    }
    this.savePlan(plan);
    return { detour: plan.detour(detour.id)!, added, dropped: dropped.map((t) => plan.task(t.id!)!) };
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
    throw missing();
  }

  // --- status --------------------------------------------------------------

  status(): Status {
    const roadmap = this.roadmap();
    return this.goalStatus(this.claimedGoal(roadmap), roadmap);
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
    };
  }

  private goalStatus(goal: Goal | undefined, roadmap: Roadmap): Status {
    const common = { standingInstructions: roadmap.standingInstructions, goals: roadmap.goals };
    if (!goal)
      return {
        goal,
        planFile: undefined,
        currentTask: undefined,
        openDetour: undefined,
        nextTask: undefined,
        done: 0,
        total: 0,
        ...common,
      };
    const plan = this.plan(goal.id);
    const live = plan.tasks.filter((t) => t.status !== "dropped");
    return {
      goal,
      planFile: this.planFilePath(goal.id),
      currentTask: plan.currentTask,
      openDetour: plan.openDetour,
      nextTask: plan.nextTask,
      done: live.filter((t) => t.status === "done").length,
      total: live.length,
      ...common,
    };
  }
}
