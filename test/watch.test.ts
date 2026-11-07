import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { watchProgress } from "../src/dashboard/watch.js";
import { tempDir } from "./tmp.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let stop: (() => void) | undefined;
afterEach(() => stop?.());

/** Saves a file the way Progressor does: write a temporary file, then rename it into place. */
function save(file: string, text: string) {
  writeFileSync(`${file}.tmp`, text);
  renameSync(`${file}.tmp`, file);
}

describe("watching .progressor/", () => {
  it("reports every save of a Plan File, not only the first", async () => {
    const root = tempDir("progressor-watch-");
    mkdirSync(join(root, ".progressor/goals"), { recursive: true });
    const plan = join(root, ".progressor/goals/g.md");
    save(plan, "0");
    const seen: string[][] = [];
    stop = watchProgress(root, (files) => seen.push(files), 20);
    await wait(150);
    seen.length = 0;
    for (let i = 1; i <= 3; i++) {
      save(plan, String(i));
      await wait(150);
      expect(seen.flat(), `save ${i}`).toContain("goals/g.md");
      seen.length = 0;
    }
    save(join(root, ".progressor/roadmap.md"), "r");
    await wait(150);
    expect(seen.flat()).toContain("roadmap.md");
  });

  it("notices the goals folder when it appears after watching started", async () => {
    const root = tempDir("progressor-watch-");
    mkdirSync(join(root, ".progressor"), { recursive: true });
    const seen: string[] = [];
    stop = watchProgress(root, (files) => seen.push(...files), 20);
    await wait(150);
    mkdirSync(join(root, ".progressor/goals"));
    await wait(150);
    seen.length = 0;
    save(join(root, ".progressor/goals/new.md"), "1");
    await wait(150);
    save(join(root, ".progressor/goals/new.md"), "2");
    await wait(150);
    expect(seen.filter((f) => f === "goals/new.md").length).toBeGreaterThanOrEqual(2);
  });

  it("starts over when .progressor/ is removed and made again", async () => {
    const root = tempDir("progressor-watch-");
    mkdirSync(join(root, ".progressor/goals"), { recursive: true });
    const seen: string[] = [];
    stop = watchProgress(root, (files) => seen.push(...files), 20);
    await wait(150);
    rmSync(join(root, ".progressor"), { recursive: true });
    await wait(150);
    mkdirSync(join(root, ".progressor/goals"), { recursive: true });
    await wait(1300);
    seen.length = 0;
    save(join(root, ".progressor/goals/g.md"), "1");
    await wait(150);
    save(join(root, ".progressor/goals/g.md"), "2");
    await wait(150);
    expect(seen.filter((f) => f === "goals/g.md").length).toBeGreaterThanOrEqual(2);
  });
});

describe("a folder that vanishes while it is being watched", () => {
  it("does not throw out of the watcher (which would stop the whole server), and starts over", () => {
    const root = tempDir("progressor-watch-");
    mkdirSync(join(root, ".progressor/attachments"), { recursive: true });
    const listeners = new Map<string, (event: string, name: string) => void>();
    const closed: string[] = [];
    let failNext = false;
    const fakeWatch = (path: string, listener: (event: string, name: string) => void) => {
      if (failNext) throw Object.assign(new Error(`ENOENT: no such file or directory, watch '${path}'`), { code: "ENOENT" });
      listeners.set(path, listener);
      return { on: () => undefined, close: () => closed.push(path) } as never;
    };
    stop = watchProgress(root, () => undefined, 20, fakeWatch as never);
    const attachments = [...listeners.entries()].find(([p]) => p.endsWith("attachments"))![1];
    // a wish's folder is made, and is gone again before it can be watched
    mkdirSync(join(root, ".progressor/attachments/w2"));
    failNext = true;
    expect(() => attachments("rename", "w2")).not.toThrow();
    expect(closed.length).toBeGreaterThan(0); // it starts over instead
  });
});
