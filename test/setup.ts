// Runs before every test file. Tests never touch the Developer's real project registry: they get a
// throwaway one, and every temp folder a test makes is removed after it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach } from "vitest";
import { removeTempDirs } from "./tmp.js";

const registryDir = mkdtempSync(join(tmpdir(), "progressor-registry-"));
process.env.PROGRESSOR_REGISTRY = join(registryDir, "projects.json");

// Registered first, so it runs after each file's own afterEach (which closes servers and watchers).
afterEach(() => removeTempDirs());
afterAll(() => {
  removeTempDirs();
  rmSync(registryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});
