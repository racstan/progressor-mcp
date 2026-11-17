// docs/tools.md lists every tool the MCP server has, once, and no tool it does not have: adding or
// removing a tool without updating the index fails here.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function registeredTools(dir: string): string[] {
  const names: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) names.push(...registeredTools(p));
    else if (p.endsWith(".ts")) for (const m of readFileSync(p, "utf8").matchAll(/registerTool\(\s*"([a-z_]+)"/g)) names.push(m[1]!);
  }
  return names;
}

// The index proper: the list of merged tools at the end names old ones.
const indexed = () => [...readFileSync("docs/tools.md", "utf8").split("## Tools that were merged")[0]!.matchAll(/^\| `([a-z_]+)` \| (.+) \|$/gm)].map((m) => ({ name: m[1]!, about: m[2]! }));

describe("the tool index", () => {
  it("lists every tool once, and only real ones", () => {
    const tools = registeredTools("src").sort();
    const listed = indexed().map((t) => t.name);
    expect([...listed].sort()).toEqual(tools);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("says each in one short line", () => {
    for (const t of indexed()) expect(t.about.length, t.name).toBeLessThanOrEqual(100);
  });

  it("is linked from the README and the reference", () => {
    expect(readFileSync("README.md", "utf8")).toContain("docs/tools.md");
    expect(readFileSync("docs/reference.md", "utf8")).toContain("tools.md");
  });
});
