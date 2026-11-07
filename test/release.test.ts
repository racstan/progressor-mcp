import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { bumpVersion, latestChangelogEntry, releaseFacts } from "../src/facts.js";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
const agent = () => new Project({ root, session: { id: "s", pid: process.pid } });
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stdio: "pipe" }).toString().trim();

/** A finished goal with one finished step and a decision. */
function finished(p: Project, title: string, opts: { hotfix?: boolean } = {}) {
  const goal = opts.hotfix ? p.addHotfix(title) : p.addGoal(title, [{ title: `Build ${title}` }], { outcome: `${title} works` });
  p.claimGoal(goal.id);
  for (const t of p.plan(goal.id).tasks) p.completeTask(t.id!, [], undefined, goal.id);
  p.addDecision(`Chose the simple way for ${title}`, goal.id);
  p.completeGoal(goal.id);
  return goal.id;
}

beforeEach(() => {
  root = tempDir("progressor-release-");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version: "1.3.0" }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\nIntro.\n\n## 1.3.0 · A new license\n\n- **One.** Line.\n- **Two.** Line.\n\n## 1.2.2 · Older\n\n- Old.\n");
});

describe("versions and the changelog", () => {
  it("bumps the minor version for new work, the patch for hotfixes only", () => {
    expect(bumpVersion("1.3.0", "minor")).toBe("1.4.0");
    expect(bumpVersion("1.3.7", "patch")).toBe("1.3.8");
    expect(bumpVersion("0.9.2", "minor")).toBe("0.10.0");
    expect(bumpVersion("not a version", "minor")).toBeUndefined();
  });

  it("finds the latest changelog entry, as a style sample", () => {
    expect(latestChangelogEntry(readFileSync(join(root, "CHANGELOG.md"), "utf8"))).toBe("## 1.3.0 · A new license\n\n- **One.** Line.\n- **Two.** Line.");
    expect(latestChangelogEntry("# Changelog\n")).toBeUndefined();
  });
});

describe("the facts a release goal gives the AI", () => {
  it("bundles the finished goals no earlier release took, with what each was and the version to write", () => {
    const p = agent();
    const a = finished(p, "Plan history");
    const b = finished(p, "Phone pushes");
    const facts = releaseFacts(p, {});
    expect(facts.bundles).toEqual([a, b]);
    expect(facts.current).toBe("1.3.0");
    expect(facts.version).toBe("1.4.0");
    expect(facts.text).toContain("Release facts for 1.4.0 (now 1.3.0)");
    expect(facts.text).toContain("- plan-history: Plan history. Finished when: Plan history works.");
    expect(facts.text).toContain("Decisions: Chose the simple way for Plan history");
    expect(facts.text).toContain("## 1.3.0 · A new license");
    expect(facts.text).toContain("Write the CHANGELOG.md entry for 1.4.0");
    expect(facts.text).toContain("package.json");
  });

  it("suggests a patch when only hotfixes are bundled", () => {
    const p = agent();
    finished(p, "Login crashes on empty password", { hotfix: true });
    expect(releaseFacts(p, {}).version).toBe("1.3.1");
  });

  it("lists the commits since the last version's tag when there is git", () => {
    git("init", "-q", "-b", "main");
    git("add", ".");
    git("commit", "-qm", "Release 1.3.0");
    git("tag", "v1.3.0");
    writeFileSync(join(root, "a.txt"), "a");
    git("add", ".");
    git("commit", "-qm", "Add plan history");
    const p = agent();
    finished(p, "Plan history");
    const text = releaseFacts(p, {}).text;
    expect(text).toContain("Commits since v1.3.0 (1):");
    expect(text).toMatch(/- [0-9a-f]{7} Add plan history/);
  });
});

describe("release goals through the tools", () => {
  async function connect() {
    const server = createServer(agent(), { settingsFile: join(tempDir("progressor-set-"), "settings.json") });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await server.connect(x);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(y);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content.map((c) => c.text).join("\n"), isError: !!r.isError };
    };
  }

  it("adds a release goal with its version and bundle, gives the facts, and doesn't bundle them again", async () => {
    const a = finished(agent(), "Plan history");
    const call = await connect();
    const added = await call("add_goal", { title: "Release 1.4.0", release: true, tasks: [{ title: "Changelog and version" }], claim: true });
    expect(added.isError).toBe(false);
    expect(added.text).toContain("Release facts for 1.4.0 (now 1.3.0)");
    const roadmap = readFileSync(join(root, ".progressor", "roadmap.md"), "utf8");
    expect(roadmap).toContain(`  - release: 1.4.0\n  - bundles: ${a}\n`);
    expect((await call("get_status")).text).toContain("Release facts for 1.4.0");
    const next = await call("add_goal", { title: "Release 1.5.0", release: true });
    expect(next.text).toContain("No finished goals to bundle");
  });

  it("takes the goals to bundle when given", async () => {
    const p = agent();
    const a = finished(p, "Plan history");
    finished(p, "Phone pushes");
    const call = await connect();
    await call("add_goal", { title: "Release", release: true, bundles: [a] });
    expect(readFileSync(join(root, ".progressor", "roadmap.md"), "utf8")).toContain(`  - bundles: ${a}\n`);
  });
});

describe("a finished release asks for its handoff", () => {
  it("tells the AI to write one, unless the setting is off", async () => {
    const { writeSettings } = await import("../src/settings.js");
    finished(agent(), "Plan history");
    const settings = join(tempDir("progressor-set-"), "settings.json");
    const server = createServer(agent(), { settingsFile: settings });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await server.connect(x);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(y);
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content.map((c) => c.text).join("\n");
    await call("add_goal", { title: "Release 1.4.0", release: true, tasks: [{ title: "Changelog", done: true }], claim: true });
    expect(await call("complete_goal")).toContain("write a handoff for this release");
    writeSettings(settings, "handoffs", { afterRelease: false });
    await call("add_goal", { title: "Release 1.5.0", release: true, tasks: [{ title: "x", done: true }], claim: true });
    expect(await call("complete_goal")).not.toContain("handoff");
  });
});
