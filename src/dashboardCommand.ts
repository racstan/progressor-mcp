// `progressor-mcp dashboard [folder]`: opens the dashboard on a Workspace from anywhere, with no
// Agent running. The folder is remembered, so the dashboard keeps showing its projects later too.
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION, startDashboard } from "./dashboard/http.js";
import { forgetWorkspace, listWorkspaces, projectEntry } from "./dashboard/registry.js";
import { findProjects } from "./dashboard/workspace.js";
import { announceServer } from "./servers.js";

const USAGE = `Usage: progressor-mcp dashboard [folder] [--no-open]
       progressor-mcp dashboard --forget [folder]

Opens the Progressor dashboard on a folder (the current one by default) and every project inside it
that has a .progressor/ Roadmap. The folder is remembered as a Workspace; --forget stops showing it.`;

/** Opens a web address in the Developer's browser; a failure only means they open it themselves. */
function openInBrowser(url: string): void {
  const [command, args] =
    process.platform === "win32" ? ["explorer.exe", [url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
  } catch {
    // the address is printed anyway
  }
}

export async function runDashboardCommand(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const folder = resolve(args.find((a) => !a.startsWith("-")) ?? process.cwd());

  if (args.includes("--forget")) {
    console.log(forgetWorkspace(folder) ? `No longer showing the Workspace ${folder}.` : `${folder} was not a Workspace.`);
    return 0;
  }
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    console.error(`progressor: ${folder} is not a folder.\n\n${USAGE}`);
    return 1;
  }

  const found = findProjects(folder).length;
  const known = listWorkspaces().some((w) => w.id === projectEntry(folder).id);
  const dashboard = await startDashboard({
    workspace: folder,
    port: process.env.PROGRESSOR_PORT ? Number(process.env.PROGRESSOR_PORT) : undefined,
    editor: process.env.PROGRESSOR_EDITOR || undefined,
    uiDir: fileURLToPath(new URL("./ui/", import.meta.url)),
  });
  console.log(
    found === 0
      ? `No projects with a .progressor/ Roadmap in ${folder} yet. They appear once an Agent adds a Goal in one.`
      : `${found} ${found === 1 ? "project" : "projects"} in ${folder}.`,
  );
  if (!known)
    console.log(
      "Remembered this folder as a Workspace, so the dashboard keeps showing its projects. Remove it with: progressor-mcp dashboard --forget " +
        (args.find((a) => !a.startsWith("-")) ?? "."),
    );
  console.log(`Dashboard: ${dashboard.url}`);
  if (!args.includes("--no-open")) openInBrowser(dashboard.url);

  if (dashboard.role === "shared") {
    console.log("Another Progressor process serves the dashboard, so this one is done.");
    await dashboard.close();
    return 0;
  }
  console.log("Serving the dashboard. Press Ctrl+C to stop.");
  await new Promise<void>((done) => {
    const record = announceServer({ kind: "dashboard", root: folder }, { version: VERSION, onStop: done });
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
    process.once("exit", () => record.close());
  });
  await dashboard.close();
  return 0;
}
