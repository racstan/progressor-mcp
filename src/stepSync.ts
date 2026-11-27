// Keeps steps in step with local git: which steps a live helper chat is working on (it has a worktree
// on the step's branch) and which are finished (their branch has been merged). A pure function; the
// caller (project.ts) reads git, remembers the commits seen, and applies the actions.
import type { LiveSession } from "./liveSessions.js";
import type { HelperInfo, TaskStatus } from "./planFile.js";

/** What a step needs to be synced: its ID, state and the helper info written on it. */
export interface SyncStep {
  id: string;
  status: TaskStatus;
  helper?: HelperInfo;
  /** When work on it began (an ISO time), when known. */
  startedAt?: string;
}

/** What git says about one branch. `ahead` holds the short hashes in HEAD..branch, newest first. */
export interface BranchFacts {
  exists: boolean;
  merged: boolean;
  ahead: string[];
  /** The merge of the branch into HEAD, when git found its merge commit (GitFacts.mergedInto). */
  mergedInto?: { commits: string[]; at: string };
}

export type SyncAction =
  | { task: string; kind: "with a helper"; branch: string; folder: string; label: string }
  | { task: string; kind: "done"; branch: string; commits: string[] };

export interface SyncInput {
  steps: SyncStep[];
  /** The chats working on the project, as liveSessions gives them. */
  sessions: LiveSession[];
  /** This chat's session ID: its own branch never counts as a helper. */
  self: string;
  /** Every local branch name. */
  branches: string[];
  /** Git's facts for the branches a step links to. */
  facts: Record<string, BranchFacts>;
  /** The commits last seen ahead of HEAD for each branch (kept by the caller between runs). */
  seen: Record<string, string[]>;
  /** When the goal was claimed (an ISO time), for a step with no start time of its own. */
  since?: string;
}

/** Whether a branch name holds the step ID as a word of its own: `t3-export`, `feat/t3`, `x_t3`, not `t30`. */
export function branchMatchesStep(branch: string, id: string): boolean {
  const want = id.toLowerCase();
  return branch.toLowerCase().split(/[^a-z0-9]+/).includes(want);
}

/** The branch a step links to: the one recorded on it, else the first branch (in name order) naming it. */
export function linkedBranch(step: Pick<SyncStep, "id" | "helper">, branches: readonly string[]): string | undefined {
  const recorded = step.helper?.branch?.trim();
  if (recorded) return recorded;
  return [...branches].sort().find((b) => branchMatchesStep(b, step.id));
}

/**
 * The commits of a merge nobody saw coming, from the merge commit. A branch linked only by its name must
 * have been merged after the step started (or, without a start, after the goal was claimed), so an old
 * branch that happens to hold the step's ID is not taken for its work; with neither time known it is not used.
 */
function mergeCommits(step: SyncStep, facts: BranchFacts, since: string | undefined): string[] | undefined {
  const merge = facts.mergedInto;
  if (!merge || merge.commits.length === 0) return undefined;
  if (step.helper?.branch?.trim()) return merge.commits;
  const from = Date.parse(step.startedAt ?? since ?? "");
  const at = Date.parse(merge.at);
  return Number.isNaN(from) || Number.isNaN(at) || at <= from ? undefined : merge.commits;
}

const OPEN: readonly TaskStatus[] = ["pending", "in progress", "with a helper", "waiting on you", "waiting on someone", "checked"];
const STARTABLE: readonly TaskStatus[] = ["pending", "in progress"];

/**
 * What to change on the steps of one goal. A step is done when its branch exists, is merged and was
 * seen with work of its own (a branch that only just began is also "merged"). A step is with a helper
 * while another live chat works in a worktree on its branch. Finished steps are never touched.
 */
export function syncSteps(input: SyncInput): SyncAction[] {
  const actions: SyncAction[] = [];
  for (const step of input.steps) {
    if (!OPEN.includes(step.status)) continue;
    const branch = linkedBranch(step, input.branches);
    if (!branch) continue;
    const facts = input.facts[branch];
    let commits = input.seen[branch];
    if (facts?.exists && facts.merged && !(commits && commits.length > 0)) commits = mergeCommits(step, facts, input.since);
    if (facts?.exists && facts.merged && commits && commits.length > 0) {
      actions.push({ task: step.id, kind: "done", branch, commits });
      continue;
    }
    if (!STARTABLE.includes(step.status)) continue;
    const chat = input.sessions.find((s) => s.session !== input.self && s.branch === branch && s.worktree);
    if (chat) actions.push({ task: step.id, kind: "with a helper", branch, folder: chat.worktree!, label: `chat ${chat.session}` });
  }
  return actions;
}
