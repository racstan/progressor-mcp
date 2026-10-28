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
