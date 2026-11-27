// `progressor-mcp sync <connect | now | off | status | link | unlink>`: plan sync from the command line,
// so the Developer's AI can turn it on with one command on each computer (see sync/connect.ts).
import { hostname } from "node:os";
import { defaultRegistryFile } from "./dashboard/registry.js";
import { allProjects } from "./dashboard/workspace.js";
import { defaultSettingsFile } from "./settings.js";
import { connectSync, defaultPlansDir, syncOff, syncSettings } from "./sync/connect.js";
import { readSyncState, syncOnce, syncStateFileFor } from "./sync/run.js";
import { linkProject, syncKey, unlinkProject } from "./sync/identity.js";

const USAGE = `Usage: progressor-mcp sync <connect [owner/repo | URL] | now | off | status | link <key> | unlink>

Keeps every project's plan in one private GitHub repo, the same on each of your computers.
  connect [repo]  turn sync on for this computer. With no repo, finds or makes your private
                  progressor-plans repo with the GitHub CLI (gh); run it once on each computer
  now             sync once right now (it also runs by itself while Progressor is open)
  off             turn sync off on this computer (your plans stay where they are)
  status          say whether sync is on, with which repo, and which plan this folder is
  link <key>      sync this folder with the plan named <key> (such as github.com/owner/repo),
                  for a project whose git address differs between computers
  unlink          forget this folder's link`;

export async function runSyncCommand(args: string[], cwd = process.cwd()): Promise<number> {
  const [what, arg] = args;
  try {
    if (what === "connect") {
      const c = await connectSync(arg);
      console.log(`${c.created ? "Made your private plans repo and connected" : "Connected"} this computer to ${c.repo}. Sync is on.`);
      console.log("Plans sync while Progressor or its background dashboard runs. Run the same command on your other computers.");
      return 0;
    }
    if (what === "now") {
      const registry = defaultRegistryFile();
      const settingsFile = defaultSettingsFile();
      const r = await syncOnce({
        settingsFile,
        plansDir: defaultPlansDir(registry),
        projects: allProjects(registry).map((p) => p.root),
        host: hostname(),
      });
      const state = readSyncState(syncStateFileFor(settingsFile));
      const kept = r.conflicts ? ` ${r.conflicts} clash${r.conflicts === 1 ? "" : "es"} settled by keeping the newer change; the other is saved in sync-state.json.` : "";
      if (r.ok) console.log(`Synced${r.changed ? "" : ": nothing new"}.${kept}`);
      else console.log(`${r.problem ?? "Sync did not finish."}${state.pending ? ` (${state.pending} change${state.pending === 1 ? "" : "s"} waiting)` : ""}`);
      return r.ok || r.offline ? 0 : 1;
    }
    if (what === "off") {
      syncOff();
      console.log("Sync is off on this computer. Your plans stay in each project's .progressor folder.");
      return 0;
    }
    if (what === "status") {
      const s = syncSettings();
      console.log(s.enabled ? `Sync is on, with ${s.repo}.` : "Sync is off on this computer. Turn it on with: progressor-mcp sync connect");
      console.log(`This folder's plan: ${syncKey(cwd)}`);
      return 0;
    }
    if (what === "link" && arg) {
      console.log(`This folder now syncs with the plan ${linkProject(cwd, arg)}.`);
      return 0;
    }
    if (what === "unlink") {
      console.log(unlinkProject(cwd) ? `Link removed; this folder's plan is ${syncKey(cwd)}.` : "This folder had no link.");
      return 0;
    }
    console.error(USAGE);
    return what === undefined || what === "help" || what === "--help" ? 0 : 1;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}
