// The MCP tools that belong to a feature. Each feature keeps its tools in src/tools/<feature>.ts,
// exporting `register<Feature>Tools(server, ctx)`, and adds one line to registerFeatureTools below;
// server.ts calls it once, after its own tools. Prefer extending an existing tool over adding one:
// every tool's description costs the AI tokens on every call (see test/lighter.test.ts).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Project } from "../project.js";

/** What server.ts gives every feature's tools. */
export interface FeatureToolContext {
  /** This Session's project. */
  project: Project;
  /** The project list (registry.ts), for finding other projects. */
  registryFile: string | undefined;
  /** The settings for how Progressor works (settings.ts); read it fresh with readSettings when needed. */
  settingsFile: string;
  /** Runs a tool body on the plan named (this project's when undefined) under its lock, and answers with its text or error. */
  respondIn(wanted: string | undefined, body: (p: Project) => string): { content: { type: "text"; text: string }[]; isError?: boolean };
  /** Ends a short reply with the Now line: where the work stands. */
  withNow(text: string): string;
  /** What a change answers with: the Now line here, or which project it was in. */
  doneIn(p: Project, text: string): string;
}

/** Registers every feature's tools. A feature adds one line: `registerMyFeatureTools(server, ctx);`. */
export function registerFeatureTools(server: McpServer, ctx: FeatureToolContext): void {
  void server;
  void ctx;
}
