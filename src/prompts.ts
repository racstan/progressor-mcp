// The slash commands: MCP prompts the Developer picks from the chat's / menu. Each one is a message
// to the Agent that says which tools to use, with the record filled in where it saves a lookup.
import type { Project } from "./project.js";

/** Where things stand, for the Agent to sum up in a few lines. */
export function statusPrompt(statusText: string): string {
  return [
    "Summarise where we are with Progressor in a few lines: the Goal and its Outcome, the current Task, any open Detour, and what comes next.",
    "If no Goal is claimed, list the Goals with their status and ask me which one to work on. Do not start any work yet.",
    "",
    statusText,
  ].join("\n");
}

/** Turning a piece of work the Developer describes into a Goal, with the Developer's OK first. */
export function planPrompt(goal: string): string {
  return [
    `Plan this as a Progressor Goal: ${goal}`,
    "",
    "1. Look at the code you need to understand the work. Do not change anything yet.",
    "2. Propose:",
    "   - a title of a few words and a short ID for its refs, such as \"web-ui\";",
    "   - an Outcome: one sentence on what done looks like, so we both know when to complete the Goal;",
    "   - the Tasks in order, each with a short title, the files it touches and a one-line summary of the change.",
    "3. Show me the plan and wait for my OK. Change it if I ask.",
    "4. Then call add_goal with the title, id, outcome and tasks, and claim_goal to start.",
    "",
    "If a Goal like this is already on the Roadmap, say so and use it instead of adding another (call get_status to see the Goals).",
  ].join("\n");
}

/** Going through a Goal with the Developer: what was done, what is missing, and reopening it if needed. */
export function reviewPrompt(project: Project, goalId: string | undefined): string {
  const roadmap = project.roadmap();
  const goal = goalId ? roadmap.goal(goalId) : project.claimedGoal(roadmap);
  if (!goal)
    return goalId
      ? `There is no Goal "${goalId}" on the Progressor Roadmap. Call get_status, list the Goals, and ask me which one to review.`
      : "Call get_status, list the Goals, and ask me which one to review.";
  const plan = project.plan(goal.id);
  const marker = { pending: " ", "in progress": "/", done: "x", dropped: "-" } as const;
  const tasks = plan.tasks.map((t) => `- [${marker[t.status]}] ${t.id} ${t.title}${t.summary ? `: ${t.summary}` : ""}`);
  return [
    `Review the Progressor Goal "${goal.title}" (${goal.ref}, ${goal.status}) with me.`,
    goal.outcome ? `Outcome: ${goal.outcome}` : "It has no Outcome yet; propose one and set it with update_goal once I agree.",
    `Plan File: ${project.planFilePath(goal.id)}`,
    "",
    "Tasks:",
    ...(tasks.length > 0 ? tasks : ["(none)"]),
    "",
    "1. For each done Task, check that its change is really in the code, and tell me in a line or two.",
    "2. Compare the work with the Outcome and tell me what is missing or worth fixing.",
    "3. If more work is needed and I agree: claim_goal to claim it (a done Goal is reopened, its finished Tasks stay done), then add_tasks for the new work.",
    "4. If everything is there and the Goal is not done yet, ask me before calling complete_goal.",
  ].join("\n");
}
