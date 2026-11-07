import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installDaemon } from "../src/daemonCommand.js";
import { tempDir } from "./tmp.js";

describe("inside the Docker image", () => {
  afterEach(() => {
    delete process.env.PROGRESSOR_CONTAINER;
  });

  it("never sets the background dashboard to start at login, and says what to do instead", async () => {
    process.env.PROGRESSOR_CONTAINER = "1";
    const dir = tempDir("progressor-container-");
    await expect(installDaemon(join(dir, "projects.json"), "progressor-test-container")).rejects.toThrow(/Docker/);
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
  });
});
