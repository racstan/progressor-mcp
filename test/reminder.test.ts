import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import { createServer } from "../src/server.js";
import { tempDir } from "./tmp.js";

let now: Date;
let project: Project;
let client: Client;

const status = async () => {
  const r = (await client.callTool({ name: "get_status", arguments: {} })) as { content: { text: string }[] };
  return r.content.map((c) => c.text).join("\n");
};

beforeEach(async () => {
  now = new Date("2026-11-01T10:00:00.000Z");
  const root = tempDir("progressor-remind-");
  project = new Project({ root, session: { id: "s-a", pid: process.pid }, now: () => now });
  const goal = project.addGoal("Mic", [{ title: "Record" }]);
  project.claimGoal(goal.id);
  const other = project.addGoal("Camera", [{ title: "Shoot" }]);
  project.claimGoal(other.id);
  project.transaction("add_hand_test", () => project.addHandTest("Try the mic", goal.id));
  now = new Date("2026-11-03T10:00:00.000Z");
  project.transaction("add_hand_test", () => project.addHandTest("Try the camera", other.id));
  now = new Date("2026-11-05T10:00:00.000Z");
  const server = createServer(project);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

describe("the gentle reminder in get_status", () => {
  it("mentions the untried things to try once, then not again that day", async () => {
    const first = await status();
    expect(first).toContain("The Developer has 2 things to try across 2 goals, the oldest from 4 days ago;");
    expect(first).toContain("Try them one by one");
    expect(await status()).not.toContain("The Developer has");
    now = new Date("2026-11-05T20:00:00.000Z");
    expect(await status()).not.toContain("The Developer has");
  });

  it("says it again the next day, and stops once nothing is untried", async () => {
    await status();
    now = new Date("2026-11-06T11:00:00.000Z");
    expect(await status()).toContain("The Developer has 2 things to try across 2 goals, the oldest from 5 days ago;");
    for (const g of project.roadmap().goals) for (const t of project.plan(g.id).handTests) project.markHandTest(g.id, t.id!, "works");
    now = new Date("2026-11-08T11:00:00.000Z");
    expect(await status()).not.toContain("The Developer has");
  });
});
