// Records the README's demo and screenshots from a sample project, "Recipe box":
//   npm run build && node scripts/demo.mjs [output folder]
// It writes a plan with a few days of history to a throwaway folder, serves the dashboard on its own
// port and registry (never the real one at 4747), then plays an AI working through a goal while
// headless Chrome films the page, and takes the screenshots. Needs playwright-core and Chrome:
// set PLAYWRIGHT_CORE to playwright-core's index.mjs if it is not installed here, and CHROME to the
// browser (default /usr/bin/google-chrome). The video comes out as WebM; ffmpeg turns it into the
// README's MP4 and GIF (see the end of this file).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startDashboard } from "../dist/dashboard/http.js";
import { projectEntry } from "../dist/dashboard/registry.js";
import { PROJECT_TALK, Project } from "../dist/project.js";

const out = resolve(process.argv[2] ?? "docs/media");
mkdirSync(out, { recursive: true });
const pw = process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : "playwright-core";
const { chromium } = await import(pw);

// --- the sample project, with history ---------------------------------------------------------

// A plain-looking folder, since the dashboard shows it.
const base = join(tmpdir(), "code");
const root = join(base, "recipe-box");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const day = 24 * 60 * 60_000;
let clock = new Date(Date.now() - 9 * day);
clock.setHours(9, 30, 0, 0);
const later = (minutes) => (clock = new Date(clock.getTime() + minutes * 60_000));
const nextDay = (hour = 9) => {
  clock = new Date(clock.getTime() + day);
  clock.setHours(hour, 10, 0, 0);
};
const live = () => (clock = undefined);
const now = () => clock ?? new Date();

const ai = new Project({ root, session: { id: "demo-ai", pid: process.pid }, now });
const you = new Project({ root, session: { id: "dashboard", pid: process.pid }, clearStaleClaims: false, now });

ai.addStandingInstruction("Ask me before adding a new dependency", true);
ai.addStandingInstruction("Write tests first for anything with logic");
ai.addStandingInstruction("Keep the app working offline");
ai.setContext(
  "Recipe box is a small web app for saving recipes, planning meals and shopping for them.\n\n" +
    "- Built with React and a local database, so it works without a connection.\n" +
    "- Runs on phones first; the desktop layout comes second.\n" +
    "- Tests: `npm test`. Run it: `npm run dev`.",
);

/** Works through a goal's steps as an AI would, each taking about its estimate. */
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

const signIn = add("Sign in with Google", "People can sign in with their Google account and stay signed in on that device.", [
  { title: "Google sign-in button", estimate: 45, code: ["src/auth/GoogleButton.tsx"] },
  { title: "Keep people signed in", estimate: 60, code: ["src/auth/session.ts"] },
  { title: "Sign out from the menu", estimate: 20, code: ["src/menu/Menu.tsx"] },
  { title: "Tests for sign-in", estimate: 40, code: ["test/auth.test.ts"] },
]);
work(signIn.id, signIn.steps);
ai.completeGoal(signIn.id);

nextDay(10);
const favourites = add("Save favourite recipes", "A heart on each recipe saves it, and Favourites lists them, also offline.", [
  { title: "Heart button on a recipe", estimate: 30, code: ["src/recipe/Heart.tsx"] },
  { title: "Store favourites on the device", estimate: 45, code: ["src/db/favourites.ts"] },
  { title: "Favourites page", estimate: 60, code: ["src/pages/Favourites.tsx"] },
  { title: "Tests for favourites", estimate: 30, code: ["test/favourites.test.ts"] },
]);
work(favourites.id, favourites.steps.slice(0, 2), {
  sideTripAfter: favourites.steps[1].id,
  sideTrip: { title: "Fix the database upgrade", reason: "Old installs failed to open the database after the new table was added", ending: "merge back" },
});
nextDay(9);
work(favourites.id, favourites.steps.slice(2));
ai.completeGoal(favourites.id);

nextDay(11);
const search = add("Search by ingredient", "Typing an ingredient lists every recipe that uses it, fastest first.", [
  { title: "Index ingredients", estimate: 45, code: ["src/db/index.ts"] },
  { title: "Search box", estimate: 30, code: ["src/search/SearchBox.tsx"] },
  { title: "Results page", estimate: 45, code: ["src/pages/Results.tsx"] },
]);
work(search.id, search.steps.slice(0, 1), {
  sideTripAfter: search.steps[0].id,
  sideTrip: {
    title: "Plural ingredient names",
    reason: "\"tomatoes\" did not find recipes that say \"tomato\"",
    ending: "return",
    tasks: [{ title: "Match singular and plural names", estimate: 30, code: ["src/search/stem.ts"] }],
  },
});
nextDay(10);
work(search.id, ai.plan(search.id).tasks.filter((t) => t.status === "pending"));
ai.completeGoal(search.id);

// Today, early: dark mode, whose last step waits on you (set when the plan goes live, so its clock starts now).
clock = new Date();
clock.setHours(7, 40, 0, 0);
const dark = add("Dark mode", "The app follows the phone's dark setting, and every screen reads well in it.", [
  { title: "Colours for dark mode", estimate: 40, code: ["src/theme.css"] },
  { title: "Follow the phone's setting", estimate: 20, code: ["src/theme.ts"] },
  { title: "Try it on your phone", estimate: 10 },
]);
work(dark.id, dark.steps.slice(0, 2));
ai.addHandTest("Open the app on your phone with dark mode on. Every screen should be easy to read, including the recipe photos' captions.", dark.id, dark.steps[2].id);
ai.addDecision("Dark colours follow the phone's setting; there is no switch in the app for now.", dark.id);
ai.releaseGoal(dark.id);

// Today: the goal the video watches.
later(60);
const list = add("Shopping list from recipes", "Pick recipes for the week and get one shopping list, with the same ingredients added up.", [
  { title: "List items in the database", estimate: 30, code: ["src/db/list.ts"] },
  { title: "Add a recipe's ingredients", estimate: 45, code: ["src/list/addRecipe.ts"] },
  { title: "Add up the same ingredients", estimate: 45, code: ["src/list/merge.ts"] },
  { title: "Tick items off in the shop", estimate: 30, code: ["src/pages/List.tsx"] },
  { title: "Share the list by link", estimate: 60, code: ["src/list/share.ts"] },
]);
work(list.id, list.steps.slice(0, 1));
ai.addDecision("Ingredients are added up by name and unit, ignoring case: 200 g flour + 100 g Flour = 300 g flour.", list.id);
you.sendMessage(list.id, "Can the shared list update live when my partner ticks something off?");
ai.takeNewFromDeveloper(list.id);
ai.replyToDeveloper("m1", "Yes: the shared list syncs when either phone is online. I added it to \"Share the list by link\".", list.id);

ai.addGoal("Meal planner", [
  { title: "Week view", estimate: 60 },
  { title: "Drag a recipe onto a day", estimate: 45 },
  { title: "Shopping list for the week", estimate: 30 },
], { outcome: "Plan the week's meals on a calendar and shop for all of them at once." });

you.sendMessage(PROJECT_TALK, "Please keep the app small: no big new libraries without asking me.");
ai.replyToProjectMessage("m1", "Understood. That is already a rule I follow: I ask before adding any new dependency.");

// The plan goes on from here in real time, while the video runs.
live();
ai.claimGoal(dark.id);
ai.setTaskState(dark.steps[2].id, "waiting on you", dark.id);
ai.releaseGoal(dark.id);
ai.claimGoal(list.id);
ai.startTask(list.steps[1].id, list.id);

// --- the dashboard and the browser ------------------------------------------------------------

const registryFile = join(tmpdir(), "progressor-demo-projects.json");
rmSync(registryFile, { force: true });
const dashboard = await startDashboard({
  project: ai,
  registryFile,
  port: Number(process.env.PROGRESSOR_PORT || 4810),
  uiDir: fileURLToPath(new URL("../dist/ui/", import.meta.url)),
});
const id = projectEntry(root).id;
const url = (hash = "") => `${new URL(dashboard.url).origin}/?project=${id}${hash}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--headless=new"] });
const size = { width: 1280, height: 800 };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// The video: an AI working through "Shopping list from recipes".
const videoDir = join(root, ".video");
const film = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size } });
const page = await film.newPage();
await page.goto(url(`#/goal/${list.id}`));
await pause(3500);
ai.completeTask(list.steps[1].id, list.steps[1].code, undefined, list.id);
await pause(1500);
ai.startTask(list.steps[2].id, list.id);
await pause(2500);
ai.startDetour("Units that don't match", "\"1 cup\" and \"200 g\" of the same flour could not be added up", list.id);
await pause(3500);
ai.endDetour("return", [{ title: "Convert cups and spoons to grams", estimate: 30, code: ["src/list/units.ts"] }], list.id);
await pause(2000);
ai.completeTask(list.steps[2].id, list.steps[2].code, undefined, list.id);
await pause(1200);
ai.startTask(list.steps[3].id, list.id);
await pause(2000);
await page.getByRole("tab", { name: /Map/ }).click();
await pause(3500);
ai.askDeveloper("Should ticked-off items stay on the list, or disappear?", ["Stay, greyed out", "Disappear"], { goal: list.id, task: list.steps[3].id });
await pause(2500);
await page.getByRole("button", { name: "Stay, greyed out" }).click();
await pause(2500);
await page.getByRole("tab", { name: /Steps/ }).click();
await pause(2500);
await page.getByRole("button", { name: /Statistics/ }).first().click();
await pause(3500);
await page.goto(url());
await page.getByRole("button", { name: "Home" }).click();
await pause(3500);
await film.close();
const webm = readdirSync(videoDir).find((f) => f.endsWith(".webm"));
renameSync(join(videoDir, webm), join(out, "demo.webm"));

// The screenshots, sharp, in each theme the README shows.
const shots = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
const shot = async (name, hash, { theme, before } = {}) => {
  const p = await shots.newPage();
  await p.addInitScript((t) => {
    if (t) localStorage.setItem("progressor.theme", t);
    else localStorage.removeItem("progressor.theme");
    localStorage.removeItem("progressor.tab"); // each shot opens on Steps unless it clicks a tab
  }, theme ?? null);
  await p.goto(url(hash));
  await pause(2500);
  if (before) await before(p);
  await pause(800);
  await p.screenshot({ path: join(out, `${name}.png`) });
  await p.close();
};
await shot("home", "", { before: (p) => p.getByRole("button", { name: "Home" }).click() });
await shot("goal", `#/goal/${list.id}`);
await shot("map", `#/goal/${list.id}`, { before: (p) => p.getByRole("tab", { name: /Map/ }).click() });
await shot("conversation", `#/goal/${list.id}`, { before: (p) => p.getByRole("tab", { name: /Conversation/ }).click() });
await shot("needs-you", `#/goal/${dark.id}`);
await shot("notes", "#/context");
await shot("statistics", "#/stats");
await shot("dark", `#/goal/${list.id}`, { theme: "dark" });
await shot("vibrant", `#/goal/${list.id}`, { theme: "vibrant" });
await shots.close();
await browser.close();
await dashboard.close();
rmSync(root, { recursive: true, force: true });
rmSync(registryFile, { force: true });

// MP4 for GitHub, and a small GIF for the top of the README and npm.
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
ff(["-i", join(out, "demo.webm"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-movflags", "+faststart", join(out, "demo.mp4")]);
ff(["-i", join(out, "demo.webm"), "-vf", "fps=8,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle", join(out, "demo.gif")]);
rmSync(join(out, "demo.webm"));
console.log(`Wrote the demo and screenshots to ${out}`);
process.exit(0);
