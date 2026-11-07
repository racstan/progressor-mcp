// Makes the tour's sample project (src/ui/sampleData.ts): a small "Recipe box" plan with history,
// built in a throwaway folder, read back through the real dashboard API, and saved as fixed answers.
// The page shows them while the tour runs (sample.ts); nothing of it reaches a project list, the
// disk of anyone running Progressor, search, or the AI.
//   npm run build && node scripts/make-sample.mjs
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDashboard } from "../dist/dashboard/http.js";
import { Project } from "../dist/project.js";

const SAMPLE_ID = "progressor-sample";
const SAMPLE_NAME = "Sample: Recipe box";
const SAMPLE_ROOT = "Sample project";

const home = mkdtempSync(join(tmpdir(), "progressor-sample-"));
const root = join(home, "recipe-box");
const registryFile = join(home, "projects.json");

const day = 24 * 60 * 60_000;
let clock;
const later = (minutes) => (clock = new Date(clock.getTime() + minutes * 60_000));
const at = (daysAgo, hour, minute = 10) => {
  clock = new Date(Date.now() - daysAgo * day);
  clock.setHours(hour, minute, 0, 0);
};
const ai = new Project({ root, session: { id: "s-sample", pid: process.pid }, now: () => clock ?? new Date() });

function work(goal, steps, { sideTripAfter, sideTrip } = {}) {
  ai.claimGoal(goal);
  steps.forEach((t, i) => {
    ai.startTask(t.id, goal);
    later(Math.round((t.estimate ?? 30) * (0.6 + ((i * 37) % 9) / 10)));
    if (sideTripAfter === t.id && sideTrip) {
      ai.startDetour(sideTrip.title, sideTrip.reason, goal);
      later(25);
      ai.endDetour(sideTrip.ending, sideTrip.tasks ?? [], goal);
    }
    ai.completeTask(t.id, t.code ?? [], undefined, goal);
    later(10);
  });
}
const add = (title, outcome, tasks) => {
  const g = ai.addGoal(title, tasks, { outcome });
  return { id: g.id, steps: ai.plan(g.id).tasks.map((t, i) => ({ ...t, code: tasks[i]?.code })) };
};

at(9, 9, 30);
ai.addStandingInstruction("Ask me before adding a new dependency", true);
ai.addStandingInstruction("Write tests first for anything with logic");
ai.setContext(
  "Recipe box is a small web app for saving recipes, planning meals and shopping for them. This is a sample, for the tour.\n\n" +
    "- Built with React and a local database, so it works without a connection.\n" +
    "- Runs on phones first; the desktop layout comes second.",
);
const signIn = add("Sign in with Google", "People can sign in with their Google account and stay signed in on that device.", [
  { title: "Google sign-in button", estimate: 45, code: ["src/auth/GoogleButton.tsx"] },
  { title: "Keep people signed in", estimate: 60, code: ["src/auth/session.ts"] },
  { title: "Tests for sign-in", estimate: 40, code: ["test/auth.test.ts"] },
]);
work(signIn.id, signIn.steps);
ai.completeGoal(signIn.id);

at(6, 10);
const favourites = add("Save favourite recipes", "A heart on each recipe saves it, and Favourites lists them, also offline.", [
  { title: "Heart button on a recipe", estimate: 30, code: ["src/recipe/Heart.tsx"] },
  { title: "Store favourites on the device", estimate: 45, code: ["src/db/favourites.ts"] },
  { title: "Favourites page", estimate: 60, code: ["src/pages/Favourites.tsx"] },
]);
work(favourites.id, favourites.steps, {
  sideTripAfter: favourites.steps[1].id,
  sideTrip: { title: "Fix the database upgrade", reason: "Old installs failed to open the database after the new table was added", ending: "merge back" },
});
ai.completeGoal(favourites.id);

at(3, 11);
const search = add("Search by ingredient", "Typing an ingredient lists every recipe that uses it, fastest first.", [
  { title: "Index ingredients", estimate: 45, code: ["src/db/index.ts"] },
  { title: "Search box", estimate: 30, code: ["src/search/SearchBox.tsx"] },
  { title: "Results page", estimate: 45, code: ["src/pages/Results.tsx"] },
]);
work(search.id, search.steps);
ai.completeGoal(search.id);

at(1, 8, 40);
const dark = add("Dark mode", "The app follows the phone's dark setting, and every screen reads well in it.", [
  { title: "Colours for dark mode", estimate: 40, code: ["src/theme.css"] },
  { title: "Follow the phone's setting", estimate: 20, code: ["src/theme.ts"] },
  { title: "Try it on your phone", estimate: 10 },
]);
work(dark.id, dark.steps.slice(0, 2));
ai.addHandTest("Open the app on your phone with dark mode on. Every screen should be easy to read.", dark.id, dark.steps[2].id);
ai.setTaskState(dark.steps[2].id, "waiting on you", dark.id);
ai.releaseGoal(dark.id);

at(0, 9, 15);
const list = add("Shopping list from recipes", "Pick recipes for the week and get one shopping list, with the same ingredients added up.", [
  { title: "List items in the database", estimate: 30, code: ["src/db/list.ts"] },
  { title: "Add a recipe's ingredients", estimate: 45, code: ["src/list/addRecipe.ts"] },
  { title: "Add up the same ingredients", estimate: 45, code: ["src/list/merge.ts"] },
  { title: "Tick items off in the shop", estimate: 30, code: ["src/pages/List.tsx"] },
  { title: "Share the list by link", estimate: 60, code: ["src/list/share.ts"] },
]);
work(list.id, list.steps.slice(0, 2));
ai.startTask(list.steps[2].id, list.id);
later(20);
ai.startDetour("Units that don't match", '"1 cup" and "200 g" of the same flour could not be added up', list.id);
later(25);
ai.endDetour("return", [{ title: "Convert cups and spoons to grams", estimate: 30, code: ["src/list/units.ts"] }], list.id);
ai.completeTask(list.steps[2].id, list.steps[2].code, undefined, list.id);
ai.addDecision("Ingredients are added up by name and unit: 200 g flour + 100 g Flour = 300 g flour.", list.id);
later(5);
ai.startTask(list.steps[3].id, list.id);
ai.sendMessage(list.id, "Can the list update live when my partner ticks something off?");
later(3);
ai.takeNewFromDeveloper(list.id);
ai.replyToDeveloper("m1", 'Yes: the shared list syncs when either phone is online. I added it to "Share the list by link".', list.id);
ai.sendMessage("_project", "Please keep the app working offline, whatever we add.");
later(2);
ai.replyToProjectMessage("m1", "Will do. Everything is stored on the phone first and synced when there's a connection.");

ai.addGoal("Meal planner", [
  { title: "Week view", estimate: 60 },
  { title: "Drag a recipe onto a day", estimate: 45 },
], { outcome: "Plan the week's meals on a calendar." });
clock = undefined;

// --- read it back through the real dashboard ----------------------------------------------------

const dashboard = await startDashboard({ project: ai, registryFile, port: 20000 + Math.floor(Math.random() * 20000) });
const base = new URL(dashboard.url).origin;
const id = dashboard.project.id;
const get = async (path) => {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};
const paths = ["/api/projects", "/api/workspaces", "/api/overview", "/api/stats"];
const p = `/api/projects/${id}`;
paths.push(`${p}/roadmap`, `${p}/stats`, `${p}/calendar`, `${p}/handoffs`, `${p}/routines`);
const roadmap = await get(`${p}/roadmap`);
for (const g of roadmap.goals) paths.push(`${p}/goals/${g.id}`);
const takenAt = new Date().toISOString();
const answers = {};
for (const path of paths) answers[path.split(id).join(SAMPLE_ID)] = await get(path);
await dashboard.close();

// The sample's own name and place, instead of the throwaway folder's.
const escaped = (s) => JSON.stringify(s).slice(1, -1);
let text = JSON.stringify({ takenAt, answers }, null, 1);
for (const [from, to] of [
  [root.replace(/\\/g, "/"), SAMPLE_ROOT],
  [root, SAMPLE_ROOT],
  [id, SAMPLE_ID],
]) {
  text = text.split(escaped(from)).join(escaped(to));
}
// the folder's name, wherever it is shown as the project's name
text = text.split('"recipe-box"').join(JSON.stringify(SAMPLE_NAME));
const data = JSON.parse(text);
rmSync(home, { recursive: true, force: true });

writeFileSync(
  "src/ui/sampleData.ts",
  `// Made by scripts/make-sample.mjs: the tour's sample project, as the dashboard's API answered for it.
// Do not edit by hand; run the script again. Shown only while the tour runs (sample.ts).
import type { SampleSnapshot } from "./sample.js";

export const SAMPLE_SNAPSHOT: SampleSnapshot = ${JSON.stringify(data, null, 1)};
`,
);
console.log(`Wrote src/ui/sampleData.ts: ${Object.keys(data.answers).length} answers.`);
