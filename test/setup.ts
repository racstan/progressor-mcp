// Runs before every test file. Tests never touch the Developer's real project registry: they get a
// throwaway one, and every temp folder a test makes is removed after it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach } from "vitest";
import { dashboardToken } from "../src/dashboard/respond.js";
import { removeTempDirs } from "./tmp.js";

const registryDir = mkdtempSync(join(tmpdir(), "progressor-registry-"));
process.env.PROGRESSOR_REGISTRY = join(registryDir, "projects.json");
// Settings then sit next to that throwaway registry, never in the Developer's own settings file.
delete process.env.PROGRESSOR_SETTINGS;

// Every change the dashboard accepts needs its token, which the real page reads from its own HTML.
// Tests that post to a dashboard stand in for that page: a post that names an x-progressor kind
// (other than a hub's step-down) and carries no token gets this process's. A test of a missing or
// wrong token sends the header itself (an empty value is "missing").
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const headers = init?.headers;
  if (init?.method === "POST" && headers && !Array.isArray(headers) && !(headers instanceof Headers)) {
    const h = headers as Record<string, string>;
    const kind = h["x-progressor"];
    if (kind !== undefined && kind !== "step-down" && h["x-progressor-token"] === undefined)
      return realFetch(input, { ...init, headers: { ...h, "x-progressor-token": dashboardToken } });
  }
  return realFetch(input, init);
}) as typeof fetch;

// Registered first, so it runs after each file's own afterEach (which closes servers and watchers).
afterEach(() => removeTempDirs());
afterAll(() => {
  removeTempDirs();
  rmSync(registryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});
