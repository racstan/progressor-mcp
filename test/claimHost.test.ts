import { readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Project, claimMayBeLive } from "../src/project.js";
import { parseRoadmap } from "../src/roadmap.js";
import { tempDir } from "./tmp.js";

// With plan sync, a claim made on one computer is read on another, where its pid means nothing.

let root: string;
const NOW = new Date("2026-10-18T15:00:00.000Z");
const hoursLater = (h: number) => () => new Date(NOW.getTime() + h * 3_600_000);

function chat(id: string, pid: number, host: string, now = () => NOW, isAlive = (_p: number) => true): Project {
  return new Project({ root, session: { id, pid, host }, isAlive, now, claims: () => ({ idleHours: 24 }) });
}
const roadmapText = () => readFileSync(join(root, ".progressor", "roadmap.md"), "utf8");

beforeEach(() => {
  root = tempDir("progressor-claimhost-");
});

describe("a claim records its computer", () => {
  it("writes the computer's name beside the pid and reads it back", () => {
    const a = chat("s-a", 100, "laptop");
    a.addGoal("Login", [{ title: "Route" }]);
    a.claimGoal("login");
    expect(roadmapText()).toMatch(/claimed by: s-a \(pid 100\) on laptop since /);
    expect(a.roadmap().goal("login")!.claim).toMatchObject({ session: "s-a", pid: 100, host: "laptop" });
  });

  it("reads an old claim with no computer, and writes one back unchanged", () => {
    const text = "# Roadmap\n\n## Goals\n\n- [/] [Login](goals/login.md) ^login\n  - claimed by: s-a (pid 7) since 2026-10-18T15:00:00.000Z\n";
    const roadmap = parseRoadmap(text);
    expect(roadmap.goal("login")!.claim).toEqual({ session: "s-a", pid: 7, since: "2026-10-18T15:00:00.000Z" });
    expect(roadmap.toString()).toBe(text);
  });

  it("keeps a computer name with spaces on one word", () => {
    const a = chat("s-a", 100, "Rachit PC");
    a.addGoal("Login", [{ title: "Route" }]);
    a.claimGoal("login");
    expect(a.roadmap().goal("login")!.claim!.host).toBe("Rachit-PC");
  });
});

describe("a claim from another computer", () => {
  it("is not judged by pid: a dead pid here does not end it", () => {
    expect(claimMayBeLive({ session: "s-a", pid: 100, since: undefined, host: "desktop" }, { isAlive: () => false, host: "laptop" })).toBe(true);
  });

  it("is not taken for this chat even when the pid matches this process", () => {
    const self = { id: "s-b", pid: 100 };
    expect(claimMayBeLive({ session: "s-a", pid: 100, since: undefined, host: "desktop" }, { isAlive: () => true, self, host: "laptop" })).toBe(true);
  });

  it("ends only after the quiet time with no change", () => {
    const claim = { session: "s-a", pid: 100, since: undefined, host: "desktop" };
    const base = { isAlive: () => false, host: "laptop", lastActive: 0, idleMs: 10 };
    expect(claimMayBeLive(claim, { ...base, now: 5 })).toBe(true);
    expect(claimMayBeLive(claim, { ...base, now: 11 })).toBe(false);
  });

  it("on the same computer is still judged by pid", () => {
    expect(claimMayBeLive({ session: "s-a", pid: 100, since: undefined, host: "laptop" }, { isAlive: () => false, host: "laptop" })).toBe(false);
  });

  it("stays held by a chat on this computer until the quiet time, then is freed", () => {
    chat("s-a", 100, "desktop").addGoal("Login", [{ title: "Route" }]);
    chat("s-a", 100, "desktop").claimGoal("login");
    // On the laptop, pid 100 is not running at all.
    const laptop = (h: number) => chat("s-b", 200, "laptop", hoursLater(h), (p) => p === 200);
    laptop(1).sessionStatus();
    expect(roadmapText()).toContain("claimed by: s-a (pid 100) on desktop");
    expect(() => laptop(1).claimGoal("login")).toThrow(/still running/);
    // Make the plan file look a day old too, so only the claim's own time counts.
    const goalFile = join(root, ".progressor", "goals", "login.md");
    writeFileSync(goalFile, readFileSync(goalFile, "utf8"));
    utimesSync(goalFile, NOW, NOW);
    laptop(25).sessionStatus();
    expect(roadmapText()).not.toContain("claimed by: s-a");
  });
});
