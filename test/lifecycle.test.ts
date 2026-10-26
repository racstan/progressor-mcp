import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { endWithApp } from "../src/lifecycle.js";

function setup(platform: NodeJS.Platform = "linux", release: () => void = () => {}) {
  const io = {
    stdin: new EventEmitter(),
    stdout: new EventEmitter(),
    process: new EventEmitter(),
    platform,
    exits: [] as number[],
    logs: [] as string[],
  };
  let released = 0;
  const end = endWithApp(
    () => {
      released++;
      release();
    },
    { ...io, exit: (code) => io.exits.push(code), log: (m) => io.logs.push(m) },
  );
  return { io, end, released: () => released };
}

describe("ending with the app", () => {
  it.each(["end", "close", "error"])("releases and exits when the app closes its end of the pipe (stdin %s)", (event) => {
    const { io, released } = setup();
    io.stdin.emit(event, new Error("gone"));
    expect(released()).toBe(1);
    expect(io.exits).toEqual([0]);
  });

  it("releases and exits when the app can no longer be written to", () => {
    const { io, released } = setup();
    io.stdout.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
    expect(released()).toBe(1);
    expect(io.exits).toEqual([0]);
  });

  it.each(["SIGINT", "SIGTERM", "SIGHUP"])("releases and exits on %s", (signal) => {
    const { io, released } = setup();
    io.process.emit(signal);
    expect(released()).toBe(1);
    expect(io.exits).toEqual([0]);
  });

  it("listens for the Windows console's close signal only on Windows", () => {
    expect(setup("linux").io.process.listenerCount("SIGBREAK")).toBe(0);
    const win = setup("win32");
    win.io.process.emit("SIGBREAK");
    expect(win.released()).toBe(1);
  });

  it("releases only once when several signs that the app has gone arrive", () => {
    const { io, end, released } = setup();
    io.stdin.emit("end");
    io.stdin.emit("close");
    io.process.emit("SIGTERM");
    end();
    expect(released()).toBe(1);
  });

  it("still releases when the process exits some other way, such as a crash", () => {
    const { io, released } = setup();
    io.process.emit("exit", 1);
    expect(released()).toBe(1);
    expect(io.exits).toEqual([]);
  });

  it("still exits when releasing fails, and says why", () => {
    const { io } = setup("linux", () => {
      throw new Error("read-only folder");
    });
    io.stdin.emit("end");
    expect(io.exits).toEqual([0]);
    expect(io.logs.join("\n")).toMatch(/read-only folder/);
  });
});
