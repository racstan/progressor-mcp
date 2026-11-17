// The risks list: kept in .progressor/risks.md, filled and kept current by the AI with add_risk and
// update_risk; each risk has how likely and how bad it is, what would reduce it, who owns it, and the
// goals that reduce it.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { formatRisks, parseRisks, riskScore, sortedRisks } from "../src/risks.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let root: string;
const agent = () => new Project({ root, session: { id: "s", pid: process.pid } });
const file = () => join(root, ".progressor", "risks.md");

beforeEach(() => {
  root = tempDir("progressor-risks-");
  agent().addGoal("Login", [{ title: "Route" }]);
});

describe("the risks file", () => {
  const text = `# Risks

## r1 Plan files swept into commits
- likelihood: high
- impact: medium
- reduce it by: Keep the plan out of git
- owner: your AI
- goals: login
- status: open

## r2 npm token leaks
- likelihood: low
- impact: high
- status: reduced
`;

  it("reads each risk and writes it back the same", () => {
    const risks = parseRisks(text);
    expect(risks).toEqual([
      { id: "r1", title: "Plan files swept into commits", likelihood: "high", impact: "medium", mitigation: "Keep the plan out of git", owner: "your AI", goals: ["login"], status: "open" },
      { id: "r2", title: "npm token leaks", likelihood: "low", impact: "high", goals: [], status: "reduced" },
    ]);
    expect(formatRisks(risks)).toBe(text);
  });

  it("is forgiving with a file edited by hand: unknown levels are medium, a missing ID gets the next", () => {
    const risks = parseRisks("# Risks\n\n## r4 One\n- likelihood: very\n\n## Two\n- impact: HIGH\n");
    expect(risks.map((r) => [r.id, r.likelihood, r.impact, r.status])).toEqual([
      ["r4", "medium", "medium", "open"],
      ["r5", "medium", "high", "open"],
    ]);
  });

  it("scores likelihood times impact and lists the worst open risks first", () => {
    const risks = parseRisks(text);
    expect(riskScore(risks[0]!)).toBe(6);
    expect(riskScore(risks[1]!)).toBe(3);
    const more = [...risks, { id: "r3", title: "Closed", likelihood: "high" as const, impact: "high" as const, goals: [], status: "closed" as const }];
    expect(sortedRisks(more).map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("risks in the project", () => {
  it("are added with the next ID, and only link goals that are on the Roadmap", () => {
    const p = agent();
    const r = p.addRisk({ title: "Windows paths break setup", likelihood: "medium", impact: "high", goals: ["login"] });
    expect(r.id).toBe("r1");
    expect(p.risks()).toEqual([r]);
    expect(readFileSync(file(), "utf8")).toContain("## r1 Windows paths break setup");
    expect(() => p.addRisk({ title: "X", likelihood: "low", impact: "low", goals: ["nope"] })).toThrow(/No Goal nope/);
    expect(() => p.addRisk({ title: "  ", likelihood: "low", impact: "low" })).toThrow(/title/);
  });

  it("are changed field by field; an empty text removes it", () => {
    const p = agent();
    p.addRisk({ title: "Slow CI", likelihood: "high", impact: "low", mitigation: "Cache deps", owner: "Developer" });
    const r = p.updateRisk("r1", { likelihood: "low", mitigation: "", status: "reduced" });
    expect(r).toMatchObject({ id: "r1", likelihood: "low", impact: "low", status: "reduced", owner: "Developer" });
    expect(r.mitigation).toBeUndefined();
    expect(() => p.updateRisk("r9", { status: "closed" })).toThrow(/No risk r9/);
  });

  it("an empty project has none, and a missing file is not an error", () => {
    expect(agent().risks()).toEqual([]);
    writeFileSync(file(), "# Risks\n");
    expect(agent().risks()).toEqual([]);
  });
});

describe("the add_risk and update_risk tools", () => {
  it("record and change risks, answering in one line", async () => {
    const p = agent();
    const server = createServer(p, { registryFile: join(tempDir("progressor-reg-"), "registry.json"), settingsFile: join(tempDir("progressor-settings-"), "settings.json") });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);
    const call = async (name: string, args: Record<string, unknown>) =>
      ((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content[0]!.text;
    expect(await call("add_risk", { title: "Token leaks", likelihood: "low", impact: "high", goals: ["login"] })).toMatch(/^Added risk r1 Token leaks \(low likelihood, high impact\)/);
    expect(await call("update_risk", { risk: "r1", status: "closed" })).toMatch(/^Updated risk r1 Token leaks: closed/);
    expect(p.risks()[0]!.status).toBe("closed");
  });
});
