import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  type Decision,
  type Detour,
  FINISHED,
  type HelperInfo,
  type StateExtras,
  type HandResult,
  type HandTest,
  type NewTask,
  type Note,
  type PlanFile,
  type Task,
  type TaskChanges,
  type TaskStatus,
  newPlanFile,
  parsePlanFile,
} from "./planFile.js";
import { gitBranches, orphanWarnings } from "./helperWork.js";
import { type Origin } from "./origin.js";
import { ResourceLocks } from "./resources.js";
import { unsafeRoot } from "./root.js";
import { type Claim, type Goal, type Idea, ROADMAP_REF, type Roadmap, type StandingInstruction, helperLimit, parseRoadmap } from "./roadmap.js";
import { type Schedule, computeSchedule } from "./schedule.js";

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
  /**
   * The Session a running Progressor process has announced (see servers.ts), when it is known; a
   * Claim whose pid now runs another Session is stale, because the pid was reused.
   */
  sessionOf?: (pid: number) => string | undefined;
  /**
   * Whether reading the status clears Claims whose Session has ended (on by default). Off for
   * readers that are not a Session, such as the dashboard, which only shows what is in the files.
   */
  clearStaleClaims?: boolean;
  now?: () => Date;
  /** Why a folder is the wrong place to start a progress record, if it is (see unsafeRoot). */
  unsafe?: (root: string) => string | undefined;
  /**
   * Set when this is another project's plan, changed from elsewhere: the name of the project the
   * Agent works in. Every item changed is then marked `updated from` it, nothing is claimed, Goals a
   * running Session holds are left alone (but for notes), and no plan is ever started (see elsewhere.ts).
   */
  from?: string;
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
  /** How long the Goal is expected to take, in minutes, when its Tasks are not estimated one by one. */
  estimate?: number;
}

/**
 * One change in an update_tasks call; `state` is needed for "state", `reason` for "drop" and
 * `estimate` for "estimate". An `estimate` given with any other action is set too.
 */
export interface TaskOperation {
  action: "start" | "complete" | "state" | "drop" | "estimate";
  task: string;
  /** The claimed Goal the Task is in; the call's own Goal when absent. */
  goal?: string;
  state?: Exclude<TaskStatus, "dropped">;
  /** For "state" with a helper: where the helper's work is. */
  helper?: HelperInfo;
  /** For "state" checked: a short note on what was checked. */
  evidence?: string;
  reason?: string;
  /** For "complete": files the Task touched. */
  code?: string[];
  /** For "complete": the Task's final summary. */
  summary?: string;
  /** The Task's new estimate in minutes; null removes it. */
  estimate?: number | null;
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
  /** Everything the Developer is asked to try by hand, with their marks. */
  handTests: HandTest[];
  standingInstructions: StandingInstruction[];
  /** The project's Important context: lasting background, kept by the Agent. */
  context: string;
  /** Every Goal on the Roadmap, so a Session without a Claim can pick one. */
  goals: Goal[];
  /** When the Goal's plan last changed (the Plan File's time, else the Roadmap's), in ms since 1970. */
  updatedAt: number | undefined;
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
  | { kind: "hand test"; ref: string; file: string; line: number; item: HandTest }
  | { kind: "idea"; ref: string; file: string; line: number; item: Idea }
  | { kind: "standing instruction"; ref: string; file: string; line: number; item: StandingInstruction };

/** The longest note the Developer can type on a failed hand test. */
export const MAX_HAND_NOTE = 500;
const handFailureTitle = (test: string): string => {
  const t = test.replace(/[.\s]+$/, "");
  return `Fix: ${t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t}`;
};
const handFailureSummary = (test: string, note: string | undefined): string =>
  `The Developer tried "${test}" by hand and it did not work.${note ? ` Their note: ${note}` : " They left no note."}`;

export const PROGRESSOR_DIR = ".progressor";
export const ROADMAP_FILE = "roadmap.md";
export const CONTEXT_FILE = "context.md";
/** The Important context goes to the Agent in full at every session start, so it stays short. */
export const MAX_CONTEXT_LENGTH = 4000;
const CONTEXT_HEADING = "# Important context";

/**
 * Whether the Session holding a Claim may still be running. It has ended when its process has died,
 * when its pid is this process's but this process is another Session (one process is one Session),
 * or when its pid now runs another Progressor Session; in each case the pid may have been reused.
 * A Claim without a pid, or whose live process Progressor knows nothing more about, may be live.
 */
export function claimMayBeLive(
  claim: Claim,
  options: { isAlive: (pid: number) => boolean; sessionOf?: (pid: number) => string | undefined; self?: SessionIdentity },
): boolean {
  if (claim.pid === undefined) return true;
  if (options.self && claim.pid === options.self.pid) return claim.session === options.self.id;
  if (!options.isAlive(claim.pid)) return false;
  const running = options.sessionOf?.(claim.pid);
  return running === undefined || running === claim.session;
}

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
  private readonly sessionOf: ((pid: number) => string | undefined) | undefined;
  private readonly tidy: boolean;
  readonly now: () => Date;
  private readonly unsafe: (root: string) => string | undefined;
  /** The project the changes come from, when this is another project's plan (see ProjectOptions.from). */
  readonly from: string | undefined;

  constructor(options: ProjectOptions) {
    this.folder = options.root;
    this.session = options.session;
    this.isAlive = options.isAlive ?? processIsAlive;
    this.sessionOf = options.sessionOf;
    this.tidy = options.clearStaleClaims ?? true;
    this.now = options.now ?? (() => new Date());
    this.unsafe =
      options.unsafe ?? ((root) => unsafeRoot(root, { home: homedir(), systemRoot: process.env.SystemRoot, platform: process.platform }));
    this.from = options.from?.trim() || undefined;
  }

  /**
   * Another project's plan, to change from this one: what changes there is marked as coming from
   * `from` (this project's name). The folder must already have a .progressor/ (see resolveProject).
   */
  elsewhere(root: string, from: string): Project {
    return new Project({
      root,
      session: this.session,
      isAlive: this.isAlive,
      sessionOf: this.sessionOf,
      now: this.now,
      unsafe: this.unsafe,
      clearStaleClaims: false,
      from,
    });
  }

  /** The `updated from` mark for a change made now, when this is another project's plan. */
  private origin(): Origin | undefined {
    return this.from ? { project: this.from, at: this.now().toISOString() } : undefined;
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
    if (this.from && !existsSync(join(this.root, PROGRESSOR_DIR)))
      throw new Error(`${this.root} has no Progressor plan, and a plan is never started from another project.`);
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
    let plan: PlanFile;
    if (text !== undefined) plan = parsePlanFile(text, goalId);
    else {
      const goal = this.roadmap().goal(goalId);
      if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
      plan = newPlanFile(goalId, goal.title);
    }
    plan.now = this.now;
    return plan;
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
  private requireClaim(goalId?: string, loaded?: Map<string, PlanFile>): { goal: Goal; plan: PlanFile } {
    if (this.from) {
      const goal = this.changeable(goalId);
      return { goal, plan: loaded?.get(goal.id) ?? this.plan(goal.id) };
    }
    const roadmap = this.roadmap();
    const held = this.claimedGoals(roadmap);
    const planOf = (g: Goal) => loaded?.get(g.id) ?? this.plan(g.id);
    if (goalId !== undefined) {
      const goal = held.find((g) => g.id === goalId);
      if (goal) return { goal, plan: planOf(goal) };
      if (!roadmap.goal(goalId)) throw new Error(`No Goal ${goalId} on the Roadmap.`);
      throw new Error(`Goal ${goalId} is not claimed by this Session; claim it first (claim_goal).`);
    }
    if (held.length === 0) throw new Error("This Session has no Goal; claim a Goal first (claim_goal).");
    if (held.length > 1)
      throw new Error(`This Session holds several Goals (${held.map((g) => g.id).join(", ")}); say which with goal.`);
    return { goal: held[0]!, plan: planOf(held[0]!) };
  }

  /**
   * A Goal of another project's plan that may be changed from here: named, not dropped, not done
   * (unless `done` is allowed) and not held by a Session that may still be running. Nothing is claimed.
   */
  private changeable(goalId: string | undefined, options: { done?: boolean } = {}): Goal {
    if (goalId === undefined) throw new Error("Say which Goal with goal: a change to another project's plan needs the Goal's ID.");
    const goal = this.roadmap().goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    if (goal.status === "dropped") throw new Error(`Goal ${goalId} is dropped; it cannot be changed.`);
    if (goal.status === "done" && !options.done)
      throw new Error(`Goal ${goalId} is finished. To add to it, reopen it from its own project.`);
    if (this.claimIsLive(goal))
      throw new Error(
        `Goal ${goalId} is being worked on by an AI chat in that project (Session ${goal.claim!.session}, still running), so it cannot be changed from here. ` +
          "Add a note to it with add_note instead, or make the change from that project.",
      );
    return goal;
  }

  /** Whether a Claim's Session may still be running (see claimMayBeLive). */
  private claimMayBeLive(claim: Claim): boolean {
    return claimMayBeLive(claim, { isAlive: this.isAlive, sessionOf: this.sessionOf, self: this.session });
  }

  /**
   * The locks on shared resources (see resources.ts). A reader that is not a Session (the
   * dashboard) has no `self`, so a lock held by this very process still shows as held.
   */
  resources(sessionOf: ((pid: number) => string | undefined) | undefined = this.sessionOf): ResourceLocks {
    const self = this.tidy ? this.session : undefined;
    return new ResourceLocks({
      root: this.root,
      ...(self ? { self } : {}),
      mayBeLive: ({ session, pid }) => claimMayBeLive({ session, pid, since: undefined }, { isAlive: this.isAlive, sessionOf, ...(self ? { self } : {}) }),
      now: this.now,
    });
  }

  /** Whether a Goal is held by another Session that may still be running, which alone may change it. */
  heldElsewhere(goal: Goal): boolean {
    return this.claimIsLive(goal);
  }

  /** Whether a Goal is held by another Session that may still be running. A Claim whose Session has ended is stale. */
  private claimIsLive(goal: Goal): boolean {
    const claim = goal.claim;
    if (!claim || claim.session === this.session.id) return false;
    return this.claimMayBeLive(claim);
  }

  /**
   * The Roadmap, with the Claims of Sessions that have ended cleared, so a chat that closed without
   * releasing its Goals stops showing them as held; their Goals are paused. Claims of Sessions that
   * may still be running are left alone. When the Roadmap cannot be written the cleared one is still
   * returned, so reading the status never fails because of this.
   */
  private tidyRoadmap(): Roadmap {
    const roadmap = this.roadmap();
    if (!this.tidy) return roadmap;
    const stale = roadmap.goals.filter((g) => g.claim && g.claim.session !== this.session.id && !this.claimMayBeLive(g.claim));
    if (stale.length === 0) return roadmap;
    for (const g of stale) roadmap.setClaim(g.id, undefined);
    try {
      this.saveRoadmap(roadmap);
    } catch {
      // cleared in what is returned; the next reader tries again
    }
    return roadmap;
  }

  /**
   * Claims a Goal for this Session, which keeps any other Goals it holds. Claiming a done Goal
   * reopens it, so Tasks found in a later review join the same list; its finished Tasks stay done.
   */
  claimGoal(goalId: string, options: { takeover?: boolean } = {}): Goal {
    const roadmap = this.tidyRoadmap();
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
    this.resources().releaseAll();
    const roadmap = this.roadmap();
    const held = this.claimedGoals(roadmap);
    if (held.length === 0) return;
    for (const g of held) roadmap.setClaim(g.id, undefined);
    this.saveRoadmap(roadmap);
  }

  // --- Goals and Tasks -----------------------------------------------------

  /** Marks a claimed Goal done and releases it, once every Task is done, released or dropped and no Detour is open. */
  completeGoal(goalId?: string, options: { unmarkedHandTests?: boolean } = {}): Goal {
    const { goal, plan } = this.requireClaim(goalId);
    const untried = plan.handTests.filter((h) => h.result === "pending");
    if (untried.length > 0 && !options.unmarkedHandTests)
      throw new Error(
        `Goal ${goal.id} still has ${untried.length} hand ${untried.length === 1 ? "test" : "tests"} the Developer has not marked: ${untried.map((h) => `${h.id} ${h.text}`).join("; ")}. ` +
          "Ask the Developer to mark them on the dashboard, or, if they say to finish anyway, call complete_goal again with unmarked_hand_tests_ok: true.",
      );
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
    this.markGoal(roadmap, goal.id);
    this.saveRoadmap(roadmap);
    return roadmap.goal(goal.id)!;
  }

  /** Marks a Goal changed from elsewhere, when this is another project's plan. */
  private markGoal(roadmap: Roadmap, goalId: string): void {
    const origin = this.origin();
    if (origin) roadmap.setGoalOrigin(goalId, origin);
  }

  /** Marks Tasks, decisions or notes changed from elsewhere, when this is another project's plan. */
  private markItems(plan: PlanFile, ids: (string | undefined)[]): void {
    const origin = this.origin();
    if (origin) for (const id of new Set(ids)) if (id) plan.markOrigin(id, origin);
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
    const goal = roadmap.addGoal(title, { id: options.id, outcome: options.outcome, estimate: options.estimate });
    if (options.done) roadmap.setGoalStatus(goal.id, "done");
    this.markGoal(roadmap, goal.id);
    const plan = newPlanFile(goal.id, title);
    plan.now = this.now;
    if (tasks.length > 0) this.markItems(plan, plan.addTasks(tasks).map((t) => t.id));
    this.saveRoadmap(roadmap);
    this.savePlan(plan);
    return roadmap.goal(goal.id)!;
  }

  /** Renames a Goal or changes its Outcome or estimate; its ID, refs and Plan File stay the same. Needs no Claim. */
  updateGoal(goalId: string, changes: { title?: string; outcome?: string; estimate?: number | null }): Goal {
    if (this.from) this.changeable(goalId, { done: true });
    const roadmap = this.roadmap();
    roadmap.updateGoal(goalId, changes);
    this.markGoal(roadmap, goalId);
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
    if (this.from) this.changeable(goalId, { done: true });
    const roadmap = this.roadmap();
    roadmap.moveGoal(goalId, to);
    this.markGoal(roadmap, goalId);
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
    this.markItems(plan, added.map((t) => t.id));
    this.savePlan(plan);
    return added.map((t) => plan.task(t.id!)!);
  }

  /** Puts a Task in the Agent's own hands; only one Task of a Goal can be in progress. */
  startTask(id: string, goalId?: string): Task {
    return this.change(goalId, (plan) => this.start(plan, id));
  }

  /**
   * Moves a Task to any state but dropped (drop_task, which wants a reason). In progress follows
   * start_task's rule; several Tasks may be with a helper, waiting on the Developer or checked.
   */
  setTaskState(id: string, state: Exclude<TaskStatus, "dropped">, goalId?: string, extras: StateExtras = {}): Task {
    return this.change(goalId, (plan) => this.setState(plan, id, state, extras));
  }

  /** Changes a Task's title, summary or files (which replace the old ones). */
  updateTask(id: string, changes: TaskChanges, goalId?: string): Task {
    return this.change(goalId, (plan) => {
      this.taskIn(plan, id);
      plan.updateTask(id, changes);
      return plan.task(id)!;
    });
  }

  /**
   * Marks a Task done, adding the files it touched and, optionally, the summary of what it changed.
   * A released Task stays released.
   */
  completeTask(id: string, code: string[] = [], summary?: string, goalId?: string): Task {
    return this.change(goalId, (plan) => this.complete(plan, id, code, summary));
  }

  dropTask(id: string, reason: string, goalId?: string): Task {
    return this.change(goalId, (plan) => this.drop(plan, id, reason));
  }

  /**
   * Applies several Task changes in order, such as completing two Tasks and starting the next, all
   * or nothing: if one fails, none is saved. Each change can name its own claimed Goal; each Goal's
   * Plan File is written once. Returns the Tasks as they ended up, one per change.
   */
  updateTasks(operations: TaskOperation[], goalId?: string): { goal: string; task: Task }[] {
    if (operations.length === 0) throw new Error("Give at least one operation.");
    const plans = new Map<string, PlanFile>();
    const results = operations.map((op, i) => {
      try {
        const { goal, plan } = this.requireClaim(op.goal ?? goalId, plans);
        plans.set(goal.id, plan);
        return { goal: goal.id, task: this.operate(plan, op) };
      } catch (e) {
        throw new Error(`Operation ${i + 1} (${op.action} ${op.task}): ${(e as Error).message} Nothing was changed.`);
      }
    });
    for (const plan of plans.values()) {
      this.markItems(plan, results.filter((r) => r.goal === plan.goalId).map((r) => r.task.id));
      this.savePlan(plan);
    }
    this.startedFromElsewhere(results.map((r) => r.goal));
    // A Task changed twice is reported as it ended up.
    return results.map((r) => ({ goal: r.goal, task: plans.get(r.goal)!.task(r.task.id!)! }));
  }

  private operate(plan: PlanFile, op: TaskOperation): Task {
    if (op.estimate !== undefined) {
      this.taskIn(plan, op.task);
      plan.updateTask(op.task, { estimate: op.estimate });
    }
    switch (op.action) {
      case "estimate":
        if (op.estimate === undefined) throw new Error("The estimate action needs an estimate.");
        return plan.task(op.task)!;
      case "start":
        return this.start(plan, op.task);
      case "complete":
        return this.complete(plan, op.task, op.code ?? [], op.summary);
      case "state":
        if (!op.state) throw new Error("The state action needs a state.");
        return this.setState(plan, op.task, op.state, { helper: op.helper, evidence: op.evidence });
      case "drop":
        if (!op.reason?.trim()) throw new Error("The drop action needs a reason.");
        return this.drop(plan, op.task, op.reason);
    }
  }

  private start(plan: PlanFile, id: string): Task {
    const task = this.taskIn(plan, id);
    const current = plan.currentTask;
    if (current && current.id !== id)
      throw new Error(`Task ${current.id} is already in progress; complete or drop it first.`);
    if (FINISHED.includes(task.status)) throw new Error(`Task ${id} is already ${task.status}.`);
    plan.setTaskStatus(id, "in progress");
    return plan.task(id)!;
  }

  private setState(plan: PlanFile, id: string, state: Exclude<TaskStatus, "dropped">, extras: StateExtras = {}): Task {
    const hasHelper = !!(extras.helper?.branch?.trim() || extras.helper?.folder?.trim() || extras.helper?.label?.trim());
    if (hasHelper && state !== "with a helper") throw new Error(`Helper info (branch, folder, label) goes with the state "with a helper", not "${state}".`);
    if (extras.evidence?.trim() && state !== "checked") throw new Error(`Evidence goes with the state "checked", not "${state}".`);
    if (state === "in progress") return this.start(plan, id);
    const task = this.taskIn(plan, id);
    if (task.status === "dropped") throw new Error(`Task ${id} is dropped; add a new Task instead.`);
    plan.setTaskStatus(id, state, extras);
    return plan.task(id)!;
  }

  private complete(plan: PlanFile, id: string, code: string[], summary: string | undefined): Task {
    if (this.taskIn(plan, id).status !== "released") plan.setTaskStatus(id, "done");
    if (code.length > 0) plan.addCode(id, code);
    if (summary?.trim()) plan.updateTask(id, { summary });
    return plan.task(id)!;
  }

  private drop(plan: PlanFile, id: string, reason: string): Task {
    this.taskIn(plan, id);
    plan.dropTask(id, { reason });
    return plan.task(id)!;
  }

  /** Runs a change to one Task of a claimed Goal's plan and saves it. */
  private change(goalId: string | undefined, body: (plan: PlanFile) => Task): Task {
    const { goal, plan } = this.requireClaim(goalId);
    const result = body(plan);
    this.markItems(plan, [result.id]);
    this.savePlan(plan);
    if (result.status !== "pending" && result.status !== "dropped") this.startedFromElsewhere([goal.id]);
    return plan.task(result.id!)!;
  }

  /**
   * A Goal not started yet whose Tasks were moved on from another project is started (it reads as
   * paused, since nothing there holds it), so it does not say "not started" with steps done.
   */
  private startedFromElsewhere(goalIds: string[]): void {
    if (!this.from) return;
    const roadmap = this.roadmap();
    const planned = [...new Set(goalIds)].filter((id) => roadmap.goal(id)?.status === "planned");
    if (planned.length === 0) return;
    for (const id of planned) {
      roadmap.setGoalStatus(id, "started");
      this.markGoal(roadmap, id);
    }
    this.saveRoadmap(roadmap);
  }

  /**
   * Moves a Task of a claimed Goal to another Goal: a copy with its title, summary, files and state
   * goes to the end of that Goal's list (or before or after one of its Tasks) under a new ID, with a
   * `moved from` line. The old Task stays as a trace, dropped with the reason `Moved to the goal "<title>" (<ref>)`, so
   * its ref still resolves and Detours that branched from it still point somewhere; its ID is not
   * reused. A Task in progress moves too, unless the other Goal has a Task in progress of its own.
   * The other Goal must not be dropped, done or held by another running Session.
   */
  moveTask(id: string, toGoal: string, to: { before?: string; after?: string } = {}, goalId?: string): Task {
    const { goal, plan } = this.requireClaim(goalId);
    if (toGoal === goal.id) throw new Error(`Task ${id} is already in Goal ${goal.id}; give another Goal to move it to.`);
    const roadmap = this.roadmap();
    const target = roadmap.goal(toGoal);
    if (!target) throw new Error(`No Goal ${toGoal} on the Roadmap.`);
    if (target.status === "dropped") throw new Error(`Goal ${toGoal} is dropped; move the Task to another Goal.`);
    if (target.status === "done") throw new Error(`Goal ${toGoal} is done; claim it with claim_goal to reopen it, then move the Task.`);
    if (this.claimIsLive(target)) throw new Error(`Goal ${toGoal} is claimed by Session ${target.claim!.session}, which is still running.`);
    const task = this.taskIn(plan, id);
    if (task.status === "dropped") throw new Error(`Task ${id} is dropped; there is nothing to move.`);
    const targetPlan = this.plan(toGoal);
    const busy = targetPlan.currentTask;
    if (task.status === "in progress" && busy)
      throw new Error(`Task ${busy.id} is already in progress in Goal ${toGoal}; finish it or set the Task to pending first.`);
    const moved = targetPlan.importTask(task, task.ref!, to);
    plan.dropTask(id, { reason: `Moved to the goal "${target.title}" (${moved.ref})` });
    // The Task is written to its new home first, so a failure in between leaves a copy, not a loss.
    this.savePlan(targetPlan);
    this.savePlan(plan);
    return moved;
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
    this.markItems(plan, [decision.id]);
    this.savePlan(plan);
    return plan.decision(decision.id!)!;
  }

  /** Rewords a decision, or removes it when the text is empty; returns undefined when removed. */
  updateDecision(id: string, text: string, goalId?: string): Decision | undefined {
    const { plan } = this.requireClaim(goalId);
    plan.assignMissingIds();
    let result: Decision | undefined;
    if (text.trim()) {
      this.markItems(plan, [plan.setDecision(id, text).id]);
      result = plan.decision(id);
    } else plan.removeDecision(id);
    this.savePlan(plan);
    return result;
  }

  // --- hand tests -------------------------------------------------------------

  /** Adds something for the Developer to try by hand to a claimed Goal. */
  addHandTest(text: string, goalId?: string, task?: string): HandTest {
    const { plan } = this.requireClaim(goalId);
    const test = plan.addHandTest(text, task);
    this.markItems(plan, [test.id]);
    this.savePlan(plan);
    return plan.handTest(test.id!)!;
  }

  /** Rewords a hand test or changes its Task, or removes it when the text is empty; undefined when removed. */
  updateHandTest(id: string, changes: { text?: string; task?: string }, goalId?: string): HandTest | undefined {
    const { plan } = this.requireClaim(goalId);
    plan.assignMissingIds();
    let result: HandTest | undefined;
    if (changes.text !== undefined && !changes.text.trim()) plan.removeHandTest(id);
    else {
      plan.updateHandTest(id, changes);
      this.markItems(plan, [id]);
      result = plan.handTest(id);
    }
    this.savePlan(plan);
    return result;
  }

  /**
   * Records the Developer's mark on a hand test (this is what the dashboard calls), needing no Claim:
   * the Developer, not the Agent, makes it. "doesn't work" adds a pending Task to the Goal, titled
   * from the test and summarising the note, and reopens a finished Goal so the next Session sees it.
   * Marking again or clearing (`pending`) drops that Task if nobody has started it.
   */
  markHandTest(goalId: string, id: string, result: HandResult, note?: string): HandTest {
    const roadmap = this.roadmap();
    const goal = roadmap.goal(goalId);
    if (!goal) throw new Error(`No Goal ${goalId} on the Roadmap.`);
    if (goal.status === "dropped") throw new Error(`Goal ${goalId} is dropped; its hand tests cannot be marked.`);
    const plan = this.plan(goalId);
    plan.assignMissingIds();
    const test = plan.handTest(id);
    if (!test) throw new Error(`No hand test ${id} in Goal ${goalId}.`);
    const text = note?.trim().slice(0, MAX_HAND_NOTE);
    plan.markHandTest(id, result, text, this.now());
    let reopen = false;
    const added = test.taskAdded ? plan.task(test.taskAdded) : undefined;
    if (result !== "doesn't work") {
      if (added?.id && added.status === "pending")
        plan.dropTask(added.id, { reason: "The hand test was marked again, so this step is not needed." });
      plan.setHandTestTask(id, undefined);
    } else if (added?.id && added.status !== "dropped") {
      plan.updateTask(added.id, { summary: handFailureSummary(test.text, text) });
    } else {
      const [task] = plan.addTasks([{ title: handFailureTitle(test.text), summary: handFailureSummary(test.text, text), fromHandTest: id }]);
      plan.setHandTestTask(id, task!.id);
      reopen = goal.status === "done";
    }
    this.savePlan(plan);
    if (reopen) {
      roadmap.setGoalStatus(goalId, "started");
      this.saveRoadmap(roadmap);
    }
    return plan.handTest(id)!;
  }

  /**
   * Notes that the Agent has been shown the Developer's marks on a claimed Goal, so the next status
   * calls only the later ones new. Nothing is written when there are none.
   */
  acknowledgeHandTests(goalId: string): void {
    const plan = this.plan(goalId);
    if (plan.markHandTestsSeen()) this.savePlan(plan);
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
    const working = this.from ? undefined : this.claimedGoal();
    const note = plan.addNote(text, working && working.id !== goalId ? working.ref : undefined);
    this.markItems(plan, [note.id]);
    this.savePlan(plan);
    return plan.note(note.id!)!;
  }

  /** Rewords or resolves a note, or removes it when the text is empty; returns undefined when removed. */
  updateNote(goalId: string, id: string, changes: { text?: string; resolved?: boolean }): Note | undefined {
    // From another project, only adding a note is allowed on a Goal a running Session holds.
    if (this.from) this.changeable(goalId, { done: true });
    const plan = this.notable(goalId);
    plan.assignMissingIds();
    let result: Note | undefined;
    if (changes.text !== undefined && !changes.text.trim()) plan.removeNote(id);
    else {
      plan.updateNote(id, changes);
      this.markItems(plan, [id]);
      result = plan.note(id);
    }
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

  /** Adds a Standing Instruction; with `helpersAtOnce`, it sets the project's helper limit. */
  addStandingInstruction(text: string, hard = false, helpersAtOnce?: number): StandingInstruction {
    const roadmap = this.roadmap();
    const instruction = roadmap.addStandingInstruction(text, hard, helpersAtOnce);
    this.saveRoadmap(roadmap);
    return instruction;
  }

  /**
   * Rewords a Standing Instruction and/or makes it a hard rule (or a preference again), or removes it
   * when the text is empty; returns undefined when removed.
   */
  updateStandingInstruction(id: string, changes: { text?: string; hard?: boolean; helpersAtOnce?: number }): StandingInstruction | undefined {
    if (changes.text === undefined && changes.hard === undefined && changes.helpersAtOnce === undefined)
      throw new Error("Give the new text or hard, or helpers_at_once.");
    const roadmap = this.roadmap();
    let result: StandingInstruction | undefined;
    if (changes.text !== undefined && !changes.text.trim()) roadmap.removeStandingInstruction(id);
    else result = roadmap.setStandingInstruction(id, changes);
    this.saveRoadmap(roadmap);
    return result;
  }

  // --- estimates, the helper limit and the schedule ------------------------------

  /** Every open Goal with its Tasks, in Roadmap order; a Goal whose Plan File cannot be read has none. */
  private plannedGoals(roadmap: Roadmap): { goal: Goal; tasks: Task[] }[] {
    return roadmap.goals
      .filter((g) => g.status !== "done" && g.status !== "dropped")
      .map((goal) => {
        try {
          return { goal, tasks: this.plan(goal.id).tasks };
        } catch {
          return { goal, tasks: [] };
        }
      });
  }

  /**
   * How many Tasks are with a helper across the project's open Goals, against the helper limit and
   * the Standing Instruction that sets it (none when there is no limit).
   */
  helperLoad(): { busy: number; limit: number | undefined; rule: StandingInstruction | undefined } {
    const roadmap = this.roadmap();
    const busy = this.plannedGoals(roadmap).reduce((n, p) => n + p.tasks.filter((t) => t.status === "with a helper").length, 0);
    const found = helperLimit(roadmap.standingInstructions);
    return { busy, limit: found?.limit, rule: found?.rule };
  }

  /**
   * Warnings about helper work left behind, across every Goal: a finished Task whose helper branch
   * still has unmerged work, and a Task checked for more than a day. Only reads; never throws.
   */
  helperWarnings(): string[] {
    try {
      const candidates = this.roadmap().goals.flatMap((g) => {
        try {
          return this.plan(g.id).tasks.map((task) => ({ goal: g.id, task }));
        } catch {
          return [];
        }
      });
      return orphanWarnings(candidates, () => gitBranches(this.root), this.now());
    } catch {
      return [];
    }
  }

  /** The schedule of the open work, from the estimates, the Roadmap's order and the helper limit (see schedule.ts). */
  schedule(): Schedule {
    const roadmap = this.roadmap();
    return computeSchedule(this.plannedGoals(roadmap), helperLimit(roadmap.standingInstructions)?.limit, this.now());
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
    const handTest = plan.handTest(id);
    if (handTest) return { kind: "hand test", ref, file, line: handTest.line, item: handTest };
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
    const roadmap = this.tidyRoadmap();
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
    const roadmap = this.tidyRoadmap();
    const held = (g: Goal) => g.status === "active" && g.claim !== undefined && this.claimMayBeLive(g.claim);
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
        handTests: [],
        updatedAt: undefined,
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
      handTests: plan.handTests,
      updatedAt: this.changedAt(this.planFilePath(goal.id)) ?? this.changedAt(`${PROGRESSOR_DIR}/${ROADMAP_FILE}`),
      ...common,
    };
  }

  /** When a file of the project (path from the project folder) last changed, in ms since 1970. */
  private changedAt(file: string): number | undefined {
    try {
      return statSync(join(this.root, file)).mtimeMs;
    } catch {
      return undefined;
    }
  }
}
