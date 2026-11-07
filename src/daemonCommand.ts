// `progressor-mcp daemon start|stop|status|install|uninstall`: the dashboard in a small background
// process of its own, so it stays up with no AI session open (the pure parts are in daemon.ts).
//
// It serves every registered project and Workspace like any Progressor hub (http.ts), so it never
// fights the AI sessions over the port: while it serves, their MCP servers share it; while a newer
// Progressor serves, it shares that one and takes over again when it closes. When a newer Progressor
// asks it to step down, it moves to that version: daemon.json then names the newer CLI, and it starts
// again from there.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAEMON_NAME,
  type DaemonState,
  type DaemonStatus,
  type LoginItemPlan,
  daemonFiles,
  describeStatus,
  launcherSource,
  loginItem,
  nodeArgs,
  parseDaemonArgs,
} from "./daemon.js";
import { DEFAULT_PORT, VERSION, hubInfo, startDashboard } from "./dashboard/http.js";
import { defaultRegistryFile } from "./dashboard/registry.js";
import { announceServer, defaultServersDir, listServers, requestStop } from "./servers.js";

const USAGE = `Usage: progressor-mcp daemon <start | stop | status | install | uninstall>

Runs the Progressor dashboard in a small background process, so it stays up when no AI chat is open.
  start      start it now (until you log out or stop it)
  stop       stop it
  status     say whether it runs, its address, version and memory
  install    start it every time you log in, and now
  uninstall  stop starting it at login, and stop it
Without it, the dashboard runs while your AI's app is open, as usual. Both ways work the same.`;

/** This Progressor's command line program. */
const CLI = fileURLToPath(new URL("./cli.js", import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readState(file: string): DaemonState | undefined {
  try {
    const s = JSON.parse(readFileSync(file, "utf8")) as DaemonState;
    return typeof s.cli === "string" ? s : undefined;
  } catch {
    return undefined;
  }
}

function writeState(file: string, state: DaemonState): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, file);
}

/** Writes the launcher and points daemon.json at `cli` (this Progressor unless given), keeping the older ones as fallbacks. */
function prepare(registryFile: string, cli = CLI): DaemonState {
  const files = daemonFiles(registryFile);
  mkdirSync(files.dir, { recursive: true });
  writeFileSync(files.launcher, launcherSource());
  const old = readState(files.state);
  const state: DaemonState = { ...old, cli };
  const fallback = [old?.cli, ...(old?.fallback ?? [])].filter((c): c is string => !!c && c !== cli && existsSync(c));
  state.fallback = [...new Set(fallback)].slice(0, 3);
  if (process.env.PROGRESSOR_PORT) state.port = Number(process.env.PROGRESSOR_PORT);
  writeState(files.state, state);
  return state;
}

/** Starts the background process from the launcher, detached, with its output in daemon.log. */
function spawnDetached(registryFile: string): void {
  const files = daemonFiles(registryFile);
  // keep the log from growing without end: start afresh past 1 MB
  try {
    if (statSync(files.log).size > 1_048_576) rmSync(files.log, { force: true });
  } catch {
    // no log yet
  }
  const out = openSync(files.log, "a");
  try {
    spawn(process.execPath, nodeArgs(files.launcher), {
      detached: true,
      windowsHide: true,
      stdio: ["ignore", out, out],
      env: { ...process.env, PROGRESSOR_REGISTRY: registryFile },
    }).unref();
  } finally {
    closeSync(out);
  }
}

/** The background process's record, if one runs. */
const record = (registryFile: string) => listServers(defaultServersDir(registryFile)).find((s) => s.kind === "background");

/** The running background dashboard, or undefined. */
export async function daemonStatus(registryFile = defaultRegistryFile()): Promise<DaemonStatus | undefined> {
  const r = record(registryFile);
  if (!r) return undefined;
  const state = readState(daemonFiles(registryFile).state);
  const port = state?.port ?? DEFAULT_PORT;
  const info = await hubInfo(port);
  return { pid: r.pid, port, version: r.version, memory: r.memory, serving: info?.pid === r.pid, startedAt: r.startedAt };
}

/** Whether `install` set it up to start at login. */
export function daemonInstalled(registryFile = defaultRegistryFile()): boolean {
  return !!readState(daemonFiles(registryFile).state)?.loginItem;
}

async function waitFor(check: () => boolean | Promise<boolean>, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  do {
    if (await check()) return true;
    await sleep(250);
  } while (Date.now() < end);
  return false;
}

export async function startDaemon(registryFile = defaultRegistryFile()): Promise<string> {
  if (record(registryFile)) return describeStatus(await daemonStatus(registryFile));
  prepare(registryFile);
  spawnDetached(registryFile);
  if (!(await waitFor(() => !!record(registryFile), 15_000)))
    return `The background dashboard did not start. What it said is in ${daemonFiles(registryFile).log}.`;
  return describeStatus(await daemonStatus(registryFile));
}

/** Asks the background process to stop, and waits until it has. */
export async function stopDaemon(registryFile = defaultRegistryFile()): Promise<string> {
  const r = record(registryFile);
  if (!r) return "The background dashboard was not running.";
  requestStop(defaultServersDir(registryFile), r.pid);
  if (!(await waitFor(() => !record(registryFile), 8000))) {
    try {
      process.kill(r.pid);
    } catch {
      // it has gone after all
    }
  }
  return "Stopped the background dashboard. The dashboard runs again whenever your AI's app is open.";
}

function loginPlan(registryFile: string, name: string): LoginItemPlan {
  return loginItem({
    platform: process.platform,
    home: homedir(),
    appData: process.env.APPDATA,
    configHome: process.env.XDG_CONFIG_HOME,
    uid: process.getuid?.(),
    node: process.execPath,
    dir: daemonFiles(registryFile).dir,
    name,
  });
}

/** Writes a login entry's files and runs its commands; the error says what failed. */
function apply(plan: LoginItemPlan): void {
  for (const f of plan.files) {
    mkdirSync(dirname(f.path), { recursive: true });
    writeFileSync(f.path, f.content);
  }
  for (const r of plan.run) {
    const result = spawnSync(r.command, r.args, { encoding: "utf8", windowsHide: true, timeout: 20_000 });
    if (result.status !== 0) throw new Error(`${r.command} ${r.args[0]}: ${(result.stderr || result.stdout || result.error?.message || "failed").trim()}`);
  }
}

/** Starts the background dashboard at every login, and now. */
export async function installDaemon(registryFile = defaultRegistryFile(), name = DAEMON_NAME): Promise<string> {
  const state = prepare(registryFile);
  const plan = loginPlan(registryFile, name);
  let used = plan;
  try {
    apply(plan);
  } catch (first) {
    if (!plan.fallback) throw first;
    used = plan.fallback;
    apply(used);
  }
  writeState(daemonFiles(registryFile).state, { ...state, loginItem: used.kind, ...(name !== DAEMON_NAME ? { name } : {}) });
  if (used.startsItself) await waitFor(() => !!record(registryFile), 10_000);
  const now = await startDaemon(registryFile);
  return `It now starts when you log in, from ${used.describe}.\n${now}`;
}

/** Stops starting it at login; `stop: false` leaves the running process for the caller to stop. */
export async function uninstallDaemon(registryFile = defaultRegistryFile(), options: { name?: string; stop?: boolean } = {}): Promise<string> {
  const files = daemonFiles(registryFile);
  const state = readState(files.state);
  const plan = loginPlan(registryFile, options.name ?? state?.name ?? DAEMON_NAME);
  for (const r of plan.remove.run) spawnSync(r.command, r.args, { stdio: "ignore", windowsHide: true, timeout: 20_000 });
  for (const f of plan.remove.files) rmSync(f, { force: true });
  if (state) {
    const { loginItem: _gone, name: _name, ...rest } = state;
    writeState(files.state, rest as DaemonState);
  }
  const stopped = options.stop === false ? "" : `\n${await stopDaemon(registryFile)}`;
  return `It no longer starts when you log in.${stopped}`;
}

/** Asks the background process to stop without waiting (the Settings page, which it may be serving). */
export function requestDaemonStop(registryFile = defaultRegistryFile()): void {
  const r = record(registryFile);
  if (r) requestStop(defaultServersDir(registryFile), r.pid);
}

/** The background process itself (`daemon run`, started by the launcher). */
export async function runDaemon(): Promise<number> {
  const registryFile = defaultRegistryFile();
  const files = daemonFiles(registryFile);
  const others = listServers(defaultServersDir(registryFile)).filter((s) => s.kind === "background" && s.pid !== process.pid);
  if (others.length > 0) {
    console.error(`progressor: a background dashboard already runs (process ${others[0]!.pid}).`);
    return 0;
  }
  const log = (m: string) => console.error(`${new Date().toISOString()} progressor: ${m}`);
  let ended: () => void = () => undefined;
  let moving = false;
  let announced: { close(): void } | undefined;

  const dashboard = await startDashboard({
    registryFile,
    port: process.env.PROGRESSOR_PORT ? Number(process.env.PROGRESSOR_PORT) : undefined,
    editor: process.env.PROGRESSOR_EDITOR || undefined,
    uiDir: fileURLToPath(new URL("./ui/", import.meta.url)),
    // A newer Progressor has taken the port over: move to it, if it says where it is.
    onStepDown: () =>
      void (async () => {
        // the newer one takes the port a moment after this one lets it go
        let info = await hubInfo(dashboard.port);
        for (const end = Date.now() + 6000; !info && Date.now() < end; info = await hubInfo(dashboard.port)) await sleep(300);
        if (!info?.cli || info.version === VERSION || !existsSync(info.cli)) {
          log(`Progressor ${info?.version ?? "(newer)"} serves the dashboard now; this one shares it and takes over when it closes.`);
          return;
        }
        log(`moving to Progressor ${info.version} (${info.cli}).`);
        moving = true;
        prepare(registryFile, info.cli);
        ended();
      })(),
  });
  announced = announceServer({ kind: "background", root: files.dir }, { version: VERSION, onStop: () => ended() });
  log(`Progressor ${VERSION}: dashboard at http://localhost:${dashboard.port}/ (${dashboard.role === "serving" ? "serving" : "shared with another Progressor"}).`);

  // Nothing else keeps the process alive while it only shares a newer hub.
  const keepAlive = setInterval(() => undefined, 60_000);
  await new Promise<void>((done) => {
    ended = done;
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", ...(process.platform === "win32" ? ["SIGBREAK"] : [])]) process.once(signal, done);
  });
  clearInterval(keepAlive);
  announced.close();
  await dashboard.close();
  if (moving) spawnDetached(registryFile);
  log(moving ? "handed over to the newer Progressor." : "stopped.");
  return 0;
}

export async function runDaemonCommand(args: string[]): Promise<number> {
  const parsed = parseDaemonArgs(args);
  try {
    switch (parsed.action) {
      case "help":
        console.log(USAGE);
        return 0;
      case "unknown":
        console.error(`progressor: no daemon command "${parsed.word}".\n\n${USAGE}`);
        return 1;
      case "run":
        return await runDaemon();
      case "start":
        console.log(await startDaemon());
        return 0;
      case "stop":
        console.log(await stopDaemon());
        return 0;
      case "status": {
        console.log(describeStatus(await daemonStatus()));
        if (daemonInstalled()) console.log("It starts when you log in.");
        return 0;
      }
      case "install":
        console.log(await installDaemon(undefined, parsed.name));
        return 0;
      case "uninstall":
        console.log(await uninstallDaemon(undefined, { name: parsed.name }));
        return 0;
    }
  } catch (e) {
    console.error(`progressor: ${(e as Error).message}`);
    return 1;
  }
}
