#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Project } from "./project.js";
import { createServer } from "./server.js";

// One server process serves one Agent conversation (and its sub-agents), so the
// process is the Session: it gets a fresh ID, and its pid lets other Sessions
// spot a Claim left behind by a process that crashed.
const project = new Project({
  root: process.env.PROGRESSOR_ROOT ?? process.cwd(),
  session: { id: `s-${randomBytes(3).toString("hex")}`, pid: process.pid },
});

let released = false;
function releaseAndExit(code = 0): void {
  if (!released) {
    released = true;
    try {
      project.releaseGoal();
    } catch (e) {
      console.error(`progressor: could not release the Claim: ${(e as Error).message}`);
    }
  }
  process.exit(code);
}

process.stdin.on("close", () => releaseAndExit());
process.on("SIGINT", () => releaseAndExit());
process.on("SIGTERM", () => releaseAndExit());
process.on("SIGHUP", () => releaseAndExit());

await createServer(project).connect(new StdioServerTransport());
console.error(`progressor: serving ${project.root} as Session ${project.session.id}`);
