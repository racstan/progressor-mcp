// The slash commands: MCP prompts the Developer picks from the chat's / menu. Each one is a message
// to the Agent that says which tools to use, with the record filled in where it saves a lookup.
import { type Launch, planInit } from "./init.js";
import type { Project, Status } from "./project.js";

/**
 * Setting the conversation's folder up, from the chat. The command only exists where Progressor is
 * already running, so .mcp.json is left alone (init --no-server): this adds the hooks, the note in
 * CLAUDE.md and the Roadmap, after the Developer's OK.
 */
export function setupPrompt(root: string, launch: Launch): string {
  let changes;
  try {
    changes = planInit(root, launch, { server: false });
  } catch (e) {
    return `Progressor cannot set up ${root}: ${(e as Error).message} Tell me so, and what to fix.`;
  }
  if (changes.length === 0)
    return `Progressor is already set up in ${root}. Tell me so in a line, and suggest /progressor:plan to plan a Goal or /progressor:next to pick up the work.`;
  const command = `${launch.hook.replace(/ hook$/, "")} init "${root}" --yes --no-server`;
  return [
    `Set up Progressor in this project, ${root}. It would:`,
    ...changes.map((c) => `- ${c.file}: ${c.what}`),
    "",
    "Show me this list and wait for my OK. Then run this command in a terminal and tell me what it printed:",
    "",
    `    ${command}`,
    "",
    "Progressor's tools work straight away; the hooks and the note in CLAUDE.md take effect from the next conversation.",
  ].join("\n");
}

/** Where things stand, for the Agent to sum up in a few lines. */
export function statusPrompt(statusText: string): string {
  return [
    "Summarise where we are with Progressor in a few lines: the Goal and its Outcome, the current Task, any open Detour, and what comes next.",
    "If no Goal is claimed, list the Goals with their status and ask me which one to work on. Do not start any work yet.",
    "",
    statusText,
  ].join("\n");
}

/**
 * What to say when a command came without its text. Some apps take only plain words after a command
 * (Claude's app refuses links and formatting there), so the Developer can always answer in the chat.
 */
const askInChat = (what: string) =>
  `Ask me what ${what}. I will answer in my next message, which can hold anything: several lines, links, code or pasted text. Once I have, follow these steps:`;

/** Turning a piece of work the Developer describes into a Goal, with the Developer's OK first. */
export function planPrompt(goal: string | undefined): string {
  return [
    goal ? `Plan this as a Progressor Goal: ${goal}` : askInChat("I want to plan as a Progressor Goal"),
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

/** Picking the work up where it was left: the open Detour, the Task in progress, the next Task, or a Goal to claim. */
export function nextPrompt(status: Status, statusText: string): string {
  const task = (t: { id: string | undefined; title: string }) => (t.id ? `${t.id} ${t.title}` : `"${t.title}"`);
  const { goal } = status;
  let steps: string[];
  if (goal && status.openDetour) {
    steps = [
      `The Detour "${status.openDetour.title}" is still open. Finish its work first, then end it with end_detour (merge back, return or recalibrate), and tell me in a line.`,
    ];
  } else if (goal && status.currentTask) {
    steps = [`Carry on with the Task in progress, ${task(status.currentTask)}, and complete_task when it is done.`];
  } else if (goal && status.nextTask) {
    steps = [`Call start_task for the next Task, ${task(status.nextTask)}, then work on it and complete_task when it is done.`];
  } else if (goal) {
    steps = [`Every Task of "${goal.title}" is done or dropped. Check the work against its Outcome, then ask me before calling complete_goal.`];
  } else {
    const paused = status.goals.filter((g) => g.status === "paused");
    const open = paused.length > 0 ? paused : status.goals.filter((g) => g.status === "planned");
    const list = open.map((g) => `- ${g.id}: ${g.title} (${g.status})`);
    steps =
      open.length === 0
        ? ["There is no Goal to pick up. Tell me so, and suggest /progressor:plan followed by what I want to build."]
        : open.length === 1
          ? [`Call claim_goal for ${open[0]!.id} ("${open[0]!.title}"), then start_task for its next Task and work on it.`]
          : ["Several Goals could be picked up. Ask me which one, then claim_goal it and start its next Task:", ...list];
  }
  return ["Pick up the Progressor work where it was left:", "", ...steps, "", statusText].join("\n");
}

/** Where to watch the plan: this project's dashboard, if this Session serves or links to one. */
export function dashboardPrompt(url: string | undefined): string {
  if (!url)
    return [
      "This Progressor Session has no dashboard (it is turned off with PROGRESSOR_DASHBOARD=off, or it could not start).",
      "Tell me I can open it on its own by running `progressor-mcp dashboard` in a terminal.",
    ].join("\n");
  return [
    `The Progressor dashboard for this project is at ${url}`,
    "",
    "Give me the link. If you can open web pages in a browser pane or preview, open it there so I can keep it beside the chat; otherwise tell me to open it in my browser.",
  ].join("\n");
}
