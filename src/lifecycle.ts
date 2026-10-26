// When the app that started this MCP server goes away, the server must go too: release the
// Session's Claims, drop its record and free the dashboard's port for the next Progressor. Apps
// end a server in different ways: they close its stdin (the MCP spec's way), send a signal, or just
// exit, which closes the pipes. Any of them ends the process; a crash still releases the Claims.
import type { EventEmitter } from "node:events";

export interface LifecycleIo {
  stdin: EventEmitter;
  stdout: EventEmitter;
  /** Where signals and "exit" arrive: `process`. */
  process: EventEmitter;
  platform: NodeJS.Platform;
  exit: (code: number) => void;
  log: (message: string) => void;
}

const defaultIo = (): LifecycleIo => ({
  stdin: process.stdin,
  stdout: process.stdout,
  process,
  platform: process.platform,
  exit: (code) => process.exit(code),
  log: (message) => console.error(message),
});

/**
 * Calls `release` once and exits when the app goes away. Returns the function that does it, for
 * other reasons to end (the dashboard's Stop button, the MCP connection closing).
 */
export function endWithApp(release: () => void, io: LifecycleIo = defaultIo()): () => void {
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    try {
      release();
    } catch (e) {
      io.log(`progressor: could not release the Claims: ${(e as Error).message}`);
    }
  };
  const end = () => {
    releaseOnce();
    io.exit(0);
  };
  // stdin ends when the app closes its end of the pipe or exits; an app that can no longer be
  // written to (EPIPE) has gone too, and without a listener that error would crash the process.
  for (const event of ["end", "close", "error"]) io.stdin.on(event, end);
  io.stdout.on("error", end);
  const signals = ["SIGINT", "SIGTERM", "SIGHUP", ...(io.platform === "win32" ? ["SIGBREAK"] : [])];
  for (const signal of signals) io.process.on(signal, end);
  // An uncaught error or a plain process.exit elsewhere still leaves no Claims behind.
  io.process.on("exit", releaseOnce);
  return end;
}
