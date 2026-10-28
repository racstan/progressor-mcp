// Films the showcase video and takes the README's pictures from two sample projects:
//   npm run build && node scripts/demo.mjs [output folder]
//
// It writes the projects' plans, with a few days of history, to throwaway folders, serves the
// dashboard on its own port and project list (never the real one at 4747), and plays an AI at work
// while headless Chrome shows the page. Title cards, captions, a pointer and a mock AI chat are drawn
// over the page, and every frame Chrome paints is kept, so the video is sharp.
//
// It writes to the output folder (default docs/media): progressor-showcase.mp4 (1080p, for YouTube),
// youtube-thumbnail.png, demo.gif (a short loop for the README) and the README's screenshots.
// Needs playwright-core and Chrome (set PLAYWRIGHT_CORE to playwright-core's index.mjs if it is not
// installed here, and CHROME to the browser; default /usr/bin/google-chrome) and ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startDashboard } from "../dist/dashboard/http.js";
import { projectEntry, registerProject } from "../dist/dashboard/registry.js";
import { Project } from "../dist/project.js";

const out = resolve(process.argv[2] ?? "docs/media");
mkdirSync(out, { recursive: true });
const pw = process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : "playwright-core";
const { chromium } = await import(pw);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the sample projects, with history ----------------------------------------------------------

// Plain-looking folders, since the dashboard shows them.
const base = join(tmpdir(), "code");
const root = join(base, "recipe-box");
const root2 = join(base, "portfolio-site");
for (const r of [root, root2]) {
  rmSync(r, { recursive: true, force: true });
  mkdirSync(r, { recursive: true });
}
const day = 24 * 60 * 60_000;
let clock;
const later = (minutes) => (clock = new Date(clock.getTime() + minutes * 60_000));
const at = (daysAgo, hour, minute = 10) => {
  clock = new Date(Date.now() - daysAgo * day);
  clock.setHours(hour, minute, 0, 0);
};
const now = () => clock ?? new Date();

const ai = new Project({ root, session: { id: "demo-ai", pid: process.pid }, now });
const ai2 = new Project({ root: root2, session: { id: "demo-ai-site", pid: process.pid }, now });

/** Works through a goal's steps as an AI would, each taking about its estimate. */
function work(p, goal, steps, { sideTripAfter, sideTrip } = {}) {
  p.claimGoal(goal);
  steps.forEach((t, i) => {
    p.startTask(t.id, goal);
    later(Math.round((t.estimate ?? 30) * (0.6 + ((i * 37) % 9) / 10)));
    if (sideTripAfter === t.id && sideTrip) {
      p.startDetour(sideTrip.title, sideTrip.reason, goal);
      later(25);
      p.endDetour(sideTrip.ending, sideTrip.tasks ?? [], goal);
    }
    p.completeTask(t.id, t.code ?? [], undefined, goal);
    later(10);
  });
}
const add = (p, title, outcome, tasks) => {
  const g = p.addGoal(title, tasks, { outcome });
  return { id: g.id, steps: p.plan(g.id).tasks.map((t, i) => ({ ...t, code: tasks[i]?.code })) };
};

at(9, 9, 30);
ai.addStandingInstruction("Ask me before adding a new dependency", true);
ai.addStandingInstruction("Write tests first for anything with logic");
ai.setContext(
  "Recipe box is a small web app for saving recipes, planning meals and shopping for them.\n\n" +
    "- Built with React and a local database, so it works without a connection.\n" +
    "- Runs on phones first; the desktop layout comes second.\n" +
    "- Tests: `npm test`. Run it: `npm run dev`.",
);
const signIn = add(ai, "Sign in with Google", "People can sign in with their Google account and stay signed in on that device.", [
  { title: "Google sign-in button", estimate: 45, code: ["src/auth/GoogleButton.tsx"] },
  { title: "Keep people signed in", estimate: 60, code: ["src/auth/session.ts"] },
  { title: "Sign out from the menu", estimate: 20, code: ["src/menu/Menu.tsx"] },
  { title: "Tests for sign-in", estimate: 40, code: ["test/auth.test.ts"] },
]);
work(ai, signIn.id, signIn.steps);
ai.completeGoal(signIn.id);

at(7, 10);
const favourites = add(ai, "Save favourite recipes", "A heart on each recipe saves it, and Favourites lists them, also offline.", [
  { title: "Heart button on a recipe", estimate: 30, code: ["src/recipe/Heart.tsx"] },
  { title: "Store favourites on the device", estimate: 45, code: ["src/db/favourites.ts"] },
  { title: "Favourites page", estimate: 60, code: ["src/pages/Favourites.tsx"] },
  { title: "Tests for favourites", estimate: 30, code: ["test/favourites.test.ts"] },
]);
work(ai, favourites.id, favourites.steps.slice(0, 2), {
  sideTripAfter: favourites.steps[1].id,
  sideTrip: { title: "Fix the database upgrade", reason: "Old installs failed to open the database after the new table was added", ending: "merge back" },
});
at(6, 9);
work(ai, favourites.id, favourites.steps.slice(2));
ai.completeGoal(favourites.id);

at(4, 11);
const search = add(ai, "Search by ingredient", "Typing an ingredient lists every recipe that uses it, fastest first.", [
  { title: "Index ingredients", estimate: 45, code: ["src/db/index.ts"] },
  { title: "Search box", estimate: 30, code: ["src/search/SearchBox.tsx"] },
  { title: "Results page", estimate: 45, code: ["src/pages/Results.tsx"] },
]);
work(ai, search.id, search.steps.slice(0, 1), {
  sideTripAfter: search.steps[0].id,
  sideTrip: {
    title: "Plural ingredient names",
    reason: "\"tomatoes\" did not find recipes that say \"tomato\"",
    ending: "return",
    tasks: [{ title: "Match singular and plural names", estimate: 30, code: ["src/search/stem.ts"] }],
  },
});
at(3, 10);
work(ai, search.id, ai.plan(search.id).tasks.filter((t) => t.status === "pending"));
ai.completeGoal(search.id);

at(0, 7, 40);
const dark = add(ai, "Dark mode", "The app follows the phone's dark setting, and every screen reads well in it.", [
  { title: "Colours for dark mode", estimate: 40, code: ["src/theme.css"] },
  { title: "Follow the phone's setting", estimate: 20, code: ["src/theme.ts"] },
  { title: "Try it on your phone", estimate: 10 },
]);
work(ai, dark.id, dark.steps.slice(0, 2));
ai.addHandTest("Open the app on your phone with dark mode on. Every screen should be easy to read, including the recipe photos' captions.", dark.id, dark.steps[2].id);
ai.addDecision("Dark colours follow the phone's setting; there is no switch in the app for now.", dark.id);
ai.releaseGoal(dark.id);
ai.addGoal("Meal planner", [
  { title: "Week view", estimate: 60 },
  { title: "Drag a recipe onto a day", estimate: 45 },
  { title: "Shopping list for the week", estimate: 30 },
], { outcome: "Plan the week's meals on a calendar and shop for all of them at once." });

// A second project, so Home has more than one.
at(8, 14);
ai2.setContext("A personal portfolio site: projects, a blog and a contact form.");
const contact = add(ai2, "Contact form", "Visitors can send a message, and it arrives by email.", [
  { title: "Form with checks", estimate: 40 },
  { title: "Send it by email", estimate: 45 },
  { title: "Thank-you page", estimate: 15 },
]);
work(ai2, contact.id, contact.steps);
ai2.completeGoal(contact.id);
at(2, 15);
const blog = add(ai2, "Blog section", "Posts written in Markdown show on the site, newest first.", [
  { title: "Read posts from Markdown", estimate: 45 },
  { title: "Post page", estimate: 40 },
  { title: "List of posts", estimate: 30 },
  { title: "RSS feed", estimate: 30 },
]);
work(ai2, blog.id, blog.steps.slice(0, 2));
ai2.releaseGoal(blog.id);

// From here on the plan changes in real time, while the video runs.
clock = undefined;
ai.claimGoal(dark.id);
ai.setTaskState(dark.steps[2].id, "waiting on you", dark.id);
ai.releaseGoal(dark.id);

// --- the dashboard and the browser ------------------------------------------------------------

const registryFile = join(tmpdir(), "progressor-demo-projects.json");
rmSync(registryFile, { force: true });
registerProject(root2, registryFile);
const dashboard = await startDashboard({
  project: ai,
  registryFile,
  port: Number(process.env.PROGRESSOR_PORT || 4810),
  uiDir: fileURLToPath(new URL("../dist/ui/", import.meta.url)),
});
const id = projectEntry(root).id;
const origin = new URL(dashboard.url).origin;
const url = (hash = "") => `${origin}/?project=${id}${hash}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--headless=new"] });

// 1440 × 810 CSS pixels drawn at 4/3: a 1920 × 1080 picture with text large enough for a phone.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
await ctx.addInitScript(overlay);
const page = await ctx.newPage();

// Every frame Chrome paints, with its time, written to disk as it comes.
const framesDir = join(tmpdir(), "progressor-demo-frames");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir);
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = join(framesDir, `${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
});
const marks = {};
const mark = (name) => (marks[name] = Date.now() / 1000);

const demo = (fn, ...args) => page.evaluate(([f, a]) => window.__demo[f](...a), [fn, args]);
const card = async (title, sub = "", kicker = "", ms = 3500) => {
  await demo("card", title, sub, kicker);
  await pause(ms);
};
const caption = (text, kicker = "") => demo("caption", text, kicker);
/** Moves the pointer to an element and clicks it, as a person would. */
const click = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await demo("pointer", box.x + box.width / 2, box.y + box.height / 2);
  await pause(800);
  await demo("press");
  await locator.click();
  await pause(400);
};
const type = async (locator, text) => {
  await click(locator);
  await locator.pressSequentially(text, { delay: 45 });
};
/** A README picture: the page as it is, without anything drawn over it. */
const shot = async (name) => {
  await demo("hide", true);
  await pause(250);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await demo("hide", false);
};
const goalRow = (title) => page.locator(".goal-row", { hasText: title });
/** The plan folder as a tree of names, for the file view. */
function folderTree(dir, indent = "") {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((e) => (e.isDirectory() ? `${indent}${e.name}/\n${folderTree(join(dir, e.name), `${indent}    `)}` : `${indent}${e.name}\n`))
    .join("");
}

await page.goto(url(`#/goal/${dark.id}`));
await goalRow("Dark mode").waitFor();
await pause(1500);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080 });

// The idea.
mark("start");
await card("Progressor", "Your AI's plan, saved in your project and shown live.", "An MCP server for AI coding assistants", 4500);
await page.screenshot({ path: join(out, "youtube-thumbnail-full.png") });
await card("Vibe coding a big project?", "It starts easy. Then come dozens of features, half-finished ideas and fixes for the fixes. Soon it gets hard to plan, and hard to remember what was being done.", "The problem, for you", 8000);
await card("Your AI forgets too.", "When a long chat gets compacted, the AI loses the details. A new chat starts from nothing. And with no plan to check, an AI can guess, and tell you something is done when it isn't.", "The problem, for your AI", 9000);
await card("Progressor keeps the plan.", "Your AI plans the work as goals and steps, and writes them into your project as it works. You watch it live in your browser. Compacted chats and new chats read the plan and carry on. Nobody forgets anything.", "The idea", 9000);
await card("Any app. Any AI.", "Claude Code, Antigravity, opencode, pi, Cursor, VS Code, Codex, Windsurf… anything that supports MCP. The plan belongs to your project, not to the chat, so you can switch whenever you like.", "Use what you like", 8000);

// 1. You ask, your AI plans.
await card("You ask. Your AI plans.", "", "1", 2200);
await demo("hideCard");
await pause(600);
await demo("chat", "In your AI chat");
await pause(500);
await demo("say", "you", "Let's make a shopping list from the week's recipes.");
await pause(1800);
await demo("say", "ai", "I'll plan it as a goal with 5 steps. You can follow along on the dashboard.");
await pause(1000);
const list = add(ai, "Shopping list from recipes", "Pick recipes for the week and get one shopping list, with the same ingredients added up.", [
  { title: "List items in the database", estimate: 30, code: ["src/db/list.ts"] },
  { title: "Add a recipe's ingredients", estimate: 45, code: ["src/list/addRecipe.ts"] },
  { title: "Add up the same ingredients", estimate: 45, code: ["src/list/merge.ts"] },
  { title: "Tick items off in the shop", estimate: 30, code: ["src/pages/List.tsx"] },
  { title: "Share the list by link", estimate: 60, code: ["src/list/share.ts"] },
]);
ai.claimGoal(list.id);
await caption("The new goal shows up on the dashboard by itself.", "You ask, your AI plans");
await pause(3000);
await demo("hideChat");
await click(goalRow("Shopping list from recipes"));
await caption("A goal has steps, and a finish line: what done looks like.", "You ask, your AI plans");
await pause(4500);
await caption("Each step has an estimate, so you can see roughly when it will be done.", "You ask, your AI plans");
await pause(4500);

// 2. Watch it work.
await card("Watch it work, live.", "", "2", 2200);
await demo("hideCard");
mark("gif-start");
ai.startTask(list.steps[0].id, list.id);
await caption("The step your AI is on is highlighted. The page updates by itself.", "Watch it work");
await pause(3000);
ai.completeTask(list.steps[0].id, list.steps[0].code, undefined, list.id);
await pause(900);
ai.startTask(list.steps[1].id, list.id);
await pause(2500);
ai.completeTask(list.steps[1].id, list.steps[1].code, undefined, list.id);
await pause(900);
ai.startTask(list.steps[2].id, list.id);
await caption("Finished steps say when they were done, and the bar shows how far along it is.", "Watch it work");
await pause(3500);

// 3. Side trips.
ai.startDetour("Units that don't match", "\"1 cup\" and \"200 g\" of the same flour could not be added up", list.id);
await caption("Something unexpected? Your AI takes a side trip, and says why.", "Side trips");
await pause(4500);
ai.endDetour("return", [{ title: "Convert cups and spoons to grams", estimate: 30, code: ["src/list/units.ts"] }], list.id);
await caption("Then it comes back, and adds what it found to the plan.", "Side trips");
await pause(3000);
ai.completeTask(list.steps[2].id, list.steps[2].code, undefined, list.id);
ai.addDecision("Ingredients are added up by name and unit, ignoring case: 200 g flour + 100 g Flour = 300 g flour.", list.id);
await pause(900);
ai.startTask(list.steps[3].id, list.id);
await pause(2000);
mark("gif-end");
await shot("goal");
await click(page.getByRole("tab", { name: /Map/ }));
await caption("The whole plan as a map: side trips branch off and join back in.", "The map");
await pause(4500);
await shot("map");
await click(page.getByRole("tab", { name: /Steps/ }));

// 3. It asks when it needs you.
await card("It tells you when it needs you.", "", "3", 2200);
await demo("hideCard");
ai.askDeveloper("Should ticked-off items stay on the list, or disappear?", ["Stay, greyed out", "Disappear"], { goal: list.id, task: list.steps[3].id });
await pause(1200);
await caption("A question for you waits right on the page. Answer with a click.", "Needs you");
await pause(3500);
await click(page.getByRole("button", { name: "Stay, greyed out" }));
await caption("Your AI reads your answer at its next step, and keeps it as a decision.", "Needs you");
await pause(3000);
await click(goalRow("Dark mode"));
await caption("Things only you can try, like checking on your phone, are listed too.", "Needs you");
await pause(3500);
await shot("needs-you");
await click(page.getByRole("button", { name: "Works" }).first());
await pause(2000);

// 4. Talk to your AI.
await card("Talk to your AI from the page.", "", "4", 2200);
await demo("hideCard");
await click(goalRow("Shopping list from recipes"));
await click(page.getByRole("tab", { name: /Conversation/ }));
await caption("Write to your AI about a goal, or about the whole project.", "Talk to your AI");
await type(page.getByLabel("Write to your AI about this goal"), "Can the shared list update live when my partner ticks something off?");
await click(page.getByRole("button", { name: "Send" }));
await pause(2500);
ai.takeNewFromDeveloper(list.id);
ai.replyToDeveloper("m1", "Yes: the shared list syncs when either phone is online. I added it to \"Share the list by link\".", list.id);
await caption("Its reply shows up under your message. What you write stays on your computer.", "Talk to your AI");
await pause(4500);
await shot("conversation");

// 5. Nothing is forgotten.
await card("Nothing is forgotten.", "The chat's memory gets compacted, the chat closes, or you switch to another app. The plan stays.", "5", 5000);
await demo("hideCard");
await click(page.getByRole("tab", { name: /Steps/ }));
await demo("chat", "Your AI chat, an hour later");
await pause(400);
await demo("say", "sys", "Conversation compacted: older messages were summarised to save space.");
await pause(2000);
await demo("say", "ai", "Let me check the plan before I go on… We're on step 4 of 6, \"Tick items off in the shop\". Ticked items stay greyed out, as you decided.");
await caption("After compaction, your AI reads the plan instead of guessing from a summary.", "Nothing is forgotten");
await pause(6500);
await caption("No made-up progress: what's done is what the plan says is done.", "Nothing is forgotten");
await pause(4500);
await demo("hideChat");
ai.releaseGoal(list.id);
await caption("Then the chat ends. The goal waits, exactly where it was.", "Nothing is forgotten");
await pause(4000);
const planFile = readFileSync(join(root, ".progressor", "goals", `${list.id}.md`), "utf8")
  .split("\n")
  .filter((l) => !/^\s+- (added|updated|time spent|timing since|started|finished|code|estimate):/.test(l))
  .slice(0, 20)
  .join("\n");
await demo("file", `.progressor/goals/${list.id}.md`, planFile);
await caption("Everything is saved as plain markdown files in your project, next to your code.", "Nothing is forgotten");
await pause(5500);
await demo("hideFile");
await demo("chat", "Next day: a new chat, in a different app");
await pause(400);
await demo("say", "you", "carry on");
await pause(1500);
const next = new Project({ root, session: { id: "demo-ai-2", pid: process.pid } });
next.claimGoal(list.id);
next.startTask(list.steps[3].id, list.id);
await demo("say", "ai", "Picking up \"Shopping list from recipes\" at step 4 of 6: Tick items off in the shop. Ticked items stay greyed out, as you decided.");
await caption("A new chat, even in another app or with another AI, carries on where the last one stopped.", "Nothing is forgotten");
await pause(6500);
await demo("hideChat");

// 6. Private, and yours.
await card("Private, and yours.", "Your plan is plain markdown files in your project, on your computer. Nothing is sent anywhere.", "6", 5500);
await demo("hideCard");
await demo("file", "recipe-box/.progressor/", folderTree(join(root, ".progressor")));
await caption("A folder of markdown files you can open and read in any editor.", "Private, and yours");
await pause(6000);
await demo("file", ".progressor/.gitignore", readFileSync(join(root, ".progressor", ".gitignore"), "utf8").trim());
await caption("Kept out of git by default. Want it in git, to share with your team? Just ask your AI.", "Private, and yours");
await pause(7000);
await demo("hideFile");
await caption("No account, no cloud, no tracking. Delete the folder and it's gone.", "Private, and yours");
await pause(4500);

// 7. Rules.
await card("Rules your AI keeps.", "", "7", 2200);
await demo("hideCard");
await click(page.getByRole("button", { name: /Project notes/ }));
await caption("Lasting rules and the project's background, read by every chat.", "Project notes");
await pause(3000);
await click(page.getByRole("button", { name: "+ Add a rule" }));
await type(page.getByLabel("The rule"), "Keep the app working offline");
await click(page.getByLabel("Must never be broken"));
await click(page.getByRole("button", { name: "Add rule" }));
await caption("Add, change or remove them here, and your AI is told.", "Project notes");
await pause(1500);
next.replyToProjectMessage("m1", "Noted: the app must keep working offline, and I'll check that in every step.");
await pause(2000);
await shot("notes");

// 7. Statistics and Home.
await card("See how it's going.", "", "8", 2200);
await demo("hideCard");
await click(page.getByRole("button", { name: /^Statistics$/ }).first());
await caption("How long steps take against their estimates, and what got done each day.", "Statistics");
await pause(4000);
await shot("statistics");
await page.mouse.wheel(0, 500);
await caption("How often the work stepped off the plan, and the longest steps.", "Statistics");
await pause(3500);
await click(page.getByRole("button", { name: "Home" }));
await caption("Home: what needs you and what's being worked on, across all your projects.", "Every project on one page");
await pause(4500);
await shot("home");
ai2.claimGoal(blog.id);
ai2.startTask(blog.steps[2].id, blog.id);
await caption("Another chat starts on the portfolio site. Several projects and goals at once, all live.", "Every project on one page");
await pause(5500);
await click(page.locator(".project-card", { hasText: "portfolio-site" }).first());
await caption("Each project keeps its own plan. Switch between them with a click.", "Every project on one page");
await pause(5000);
await click(page.getByRole("button", { name: "Home" }));
await pause(800);
await page.mouse.wheel(0, 700);
await caption("…with statistics for all of them.", "Every project on one page");
await pause(3500);

// 8. Themes.
await card("Your look.", "", "9", 2000);
for (const [theme, words] of [
  ["dark", "Dark…"],
  ["vibrant", "…or Vibrant, if you like colour."],
]) {
  await page.evaluate((t) => {
    localStorage.setItem("progressor.theme", t);
    localStorage.removeItem("progressor.tab");
  }, theme);
  await page.goto(url(`#/goal/${list.id}`));
  await page.getByRole("tab", { name: /Steps/ }).waitFor();
  await caption(words, "Light, dark or Vibrant");
  await pause(3500);
  await shot(theme);
}
await page.evaluate(() => localStorage.removeItem("progressor.theme"));
await page.goto(url(`#/goal/${list.id}`));
await page.getByRole("tab", { name: /Steps/ }).waitFor();

// The end.
await card("Never lose track again.", "You and your AI always know what was planned, what's done and what's next, across every chat, every app and every project.", "Progressor", 7000);
await card("Set it up in two minutes.", "Free and open source. Works with Claude Code, Antigravity, opencode, pi, Cursor, VS Code, Codex, Windsurf and any app that supports MCP.", "github.com/racstan/progressor-mcp", 3500);
await demo("cardCode", "npm install -g progressor-mcp");
await pause(7000);
mark("end");
await cdp.send("Page.stopScreencast");
await ctx.close();
await browser.close();
await dashboard.close();

// --- the video, the thumbnail and the GIF ---------------------------------------------------------

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const entries = frames.map((f, i) => {
  const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - f.t) : 1;
  return `file '${f.file}'\nduration ${d.toFixed(4)}`;
});
writeFileSync(join(framesDir, "frames.txt"), `ffconcat version 1.0\n${entries.join("\n")}\nfile '${frames.at(-1).file}'\n`);
const video = join(out, "progressor-showcase.mp4");
ff(["-f", "concat", "-safe", "0", "-i", join(framesDir, "frames.txt"), "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", video]);
ff(["-i", join(out, "youtube-thumbnail-full.png"), "-vf", "scale=1280:720:flags=lanczos", join(out, "youtube-thumbnail.png")]);
rmSync(join(out, "youtube-thumbnail-full.png"));
const from = (marks["gif-start"] - frames[0].t).toFixed(2);
const length = (marks["gif-end"] - marks["gif-start"]).toFixed(2);
ff(["-ss", from, "-t", length, "-i", video, "-vf",
  "fps=8,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle", join(out, "demo.gif")]);
rmSync(framesDir, { recursive: true, force: true });
for (const r of [root, root2]) rmSync(r, { recursive: true, force: true });
rmSync(registryFile, { force: true });
console.log(`Wrote the showcase video (${(marks.end - marks.start).toFixed(0)} s), thumbnail, GIF and screenshots to ${out}`);
process.exit(0);

// --- what is drawn over the page ------------------------------------------------------------------

/** Runs in the page: title cards, captions, a pointer, a mock AI chat and a file view, drawn over the dashboard. */
function overlay() {
  const css = `
  #demo-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: Roboto, "Segoe UI", system-ui, sans-serif; }
  #demo-layer.hidden > * { visibility: hidden !important; }
  .d-card { position: absolute; inset: 0; background: #0b0b0b; color: #f4f4f2; display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 0 120px; opacity: 0; transition: opacity .45s ease; z-index: 10; }
  .d-card.on { opacity: 1; }
  .d-card .k { font-size: 18px; letter-spacing: .14em; text-transform: uppercase; color: #9a9a96; margin-bottom: 22px; }
  .d-card .k.n { font-size: 22px; width: 52px; height: 52px; line-height: 48px; border: 3px solid #f4f4f2; border-radius: 50%; color: #f4f4f2; letter-spacing: 0; box-sizing: border-box; }
  .d-card h1 { font-size: 64px; line-height: 1.1; margin: 0; font-weight: 700; letter-spacing: -.01em; }
  .d-card p { font-size: 26px; line-height: 1.45; color: #c8c8c4; max-width: 980px; margin: 26px 0 0; }
  .d-card code { margin-top: 40px; font: 500 30px/1 "DejaVu Sans Mono", monospace; background: #f4f4f2; color: #0b0b0b; padding: 20px 30px; border-radius: 14px;
    opacity: 0; transform: translateY(10px); transition: all .4s ease; }
  .d-card code.on { opacity: 1; transform: none; }
  .d-cap { position: absolute; left: 50%; bottom: 34px; transform: translate(-50%, 16px); opacity: 0; transition: all .35s ease; background: rgba(11,11,11,.94); color: #fff;
    padding: 16px 28px 18px; border-radius: 16px; max-width: 1080px; box-shadow: 0 12px 40px rgba(0,0,0,.25); z-index: 6; }
  .d-cap.on { opacity: 1; transform: translate(-50%, 0); }
  .d-cap .k { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #a7a7a3; margin-bottom: 4px; }
  .d-cap .t { font-size: 24px; line-height: 1.35; }
  .d-ptr { position: absolute; left: 720px; top: 900px; width: 26px; height: 26px; transition: left .75s cubic-bezier(.3,.7,.2,1), top .75s cubic-bezier(.3,.7,.2,1); }
  .d-ptr svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  .d-ptr .ring { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #111; opacity: 0; }
  .d-ptr.press .ring { animation: d-ring .5s ease-out; }
  @keyframes d-ring { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.6); } }
  .d-chat { position: absolute; right: 36px; top: 84px; width: 440px; background: #fff; color: #111; border: 2px solid #111; border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.22);
    padding: 16px 18px 18px; opacity: 0; transform: translateX(30px); transition: all .4s ease; }
  .d-chat.on { opacity: 1; transform: none; }
  .d-chat .h { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #777; margin-bottom: 12px; }
  .d-chat .b { font-size: 19px; line-height: 1.4; padding: 10px 14px; border-radius: 14px; margin-top: 10px; animation: d-in .35s ease backwards; max-width: 90%; }
  .d-chat .b.you { background: #111; color: #fff; margin-left: auto; width: fit-content; }
  .d-chat .b.ai { background: #efefed; }
  .d-chat .b.sys { background: none; border: 2px dashed #bbb; color: #666; font-size: 15px; max-width: none; text-align: center; }
  .d-chat .b small { display: block; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .6; margin-bottom: 2px; }
  @keyframes d-in { from { opacity: 0; transform: translateY(8px); } }
  .d-file { position: absolute; left: 50%; top: 42%; width: 960px; transform: translate(-50%, -46%); opacity: 0; transition: all .4s ease; background: #0b0b0b; color: #e9e9e6;
    border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,.35); overflow: hidden; }
  .d-file.on { opacity: 1; transform: translate(-50%, -50%); }
  .d-file .h { font: 500 15px/1 "DejaVu Sans Mono", monospace; color: #9a9a96; padding: 14px 20px; border-bottom: 1px solid #2a2a2a; }
  .d-file pre { margin: 0; padding: 16px 20px 20px; font: 15px/1.55 "DejaVu Sans Mono", monospace; white-space: pre-wrap; background: transparent !important; color: #e9e9e6 !important; border: 0 !important; max-height: none !important; overflow: visible !important; }
  `;
  const el = (tag, cls, html = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  let layer;
  const get = (cls, make) => {
    if (!layer) {
      layer = el("div", "");
      layer.id = "demo-layer";
      layer.append(el("style", "", css));
      document.documentElement.append(layer);
    }
    return layer.querySelector(`.${cls}`) ?? layer.appendChild(make());
  };
  const show = (e) => requestAnimationFrame(() => requestAnimationFrame(() => e.classList.add("on")));
  window.__demo = {
    card(title, sub, kicker) {
      const c = get("d-card", () => el("div", "d-card"));
      const n = /^\d+$/.test(kicker);
      c.innerHTML = `${kicker ? `<div class="k ${n ? "n" : ""}">${esc(kicker)}</div>` : ""}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}`;
      this.hideCaption();
      show(c);
    },
    cardCode(text) {
      const code = el("code", "", esc(text));
      get("d-card", () => el("div", "d-card")).append(code);
      show(code);
    },
    hideCard() {
      get("d-card", () => el("div", "d-card")).classList.remove("on");
    },
    caption(text, kicker) {
      const c = get("d-cap", () => el("div", "d-cap"));
      const fill = () => (c.innerHTML = `${kicker ? `<div class="k">${esc(kicker)}</div>` : ""}<div class="t">${esc(text)}</div>`);
      if (!c.classList.contains("on")) {
        fill();
        show(c);
        return;
      }
      c.classList.remove("on");
      setTimeout(() => {
        fill();
        show(c);
      }, 300);
    },
    hideCaption() {
      get("d-cap", () => el("div", "d-cap")).classList.remove("on");
    },
    pointer(x, y) {
      const p = get("d-ptr", () =>
        el("div", "d-ptr", '<div class="ring"></div><svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'),
      );
      p.style.left = `${x - 4}px`;
      p.style.top = `${y - 3}px`;
    },
    press() {
      const p = get("d-ptr", () => el("div", "d-ptr"));
      p.classList.remove("press");
      void p.offsetWidth;
      p.classList.add("press");
    },
    chat(title) {
      const c = get("d-chat", () => el("div", "d-chat"));
      c.innerHTML = `<div class="h">${esc(title)}</div>`;
      show(c);
    },
    say(who, text) {
      get("d-chat", () => el("div", "d-chat")).append(el("div", `b ${who}`, `${who === "sys" ? "" : `<small>${who === "you" ? "You" : "Your AI"}</small>`}${esc(text)}`));
    },
    hideChat() {
      get("d-chat", () => el("div", "d-chat")).classList.remove("on");
    },
    file(name, text) {
      const f = get("d-file", () => el("div", "d-file"));
      f.innerHTML = `<div class="h">${esc(name)}</div><pre>${esc(text)}</pre>`;
      show(f);
    },
    hideFile() {
      get("d-file", () => el("div", "d-file")).classList.remove("on");
    },
    hide(on) {
      get("d-card", () => el("div", "d-card"));
      layer.classList.toggle("hidden", on);
    },
  };
}
