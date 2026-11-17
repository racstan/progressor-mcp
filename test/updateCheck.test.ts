import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECK_EVERY_MS,
  RETRY_AFTER_MS,
  dismissUpdate,
  howInstalled,
  isNewer,
  readUpdateState,
  refreshUpdate,
  takeUpdateLine,
  updateCommand,
  updateView,
} from "../src/updateCheck.js";
import { tempDir } from "./tmp.js";

const fileIn = () => join(tempDir("progressor-update-"), "update-check.json");
const npm = (version: string) => async () => new Response(JSON.stringify({ name: "progressor-mcp", version }), { status: 200 });
const offline = async (): Promise<Response> => {
  throw new Error("getaddrinfo ENOTFOUND registry.npmjs.org");
};

describe("isNewer", () => {
  it("compares versions number by number", () => {
    expect(isNewer("1.5.0", "1.4.0")).toBe(true);
    expect(isNewer("1.10.0", "1.9.3")).toBe(true);
    expect(isNewer("2.0.0", "1.99.99")).toBe(true);
    expect(isNewer("1.4.1", "1.4.0")).toBe(true);
    expect(isNewer("1.4.0", "1.4.0")).toBe(false);
    expect(isNewer("1.3.9", "1.4.0")).toBe(false);
  });

  it("never offers a test version, and a test build of the same version is older than the release", () => {
    expect(isNewer("1.5.0-beta.1", "1.4.0")).toBe(false);
    expect(isNewer("1.4.0", "1.4.0-beta.2")).toBe(true);
  });

  it("says no to anything that is not a version", () => {
    expect(isNewer("latest", "1.4.0")).toBe(false);
    expect(isNewer("", "1.4.0")).toBe(false);
    expect(isNewer("1.5.0", "not a version")).toBe(false);
  });
});

describe("refreshUpdate", () => {
  it("asks npm and keeps what it said", async () => {
    const file = fileIn();
    const asked: string[] = [];
    const state = await refreshUpdate(file, {
      now: 1000,
      fetch: async (url) => {
        asked.push(String(url));
        return npm("1.5.0")();
      },
    });
    expect(asked).toEqual(["https://registry.npmjs.org/progressor-mcp/latest"]);
    expect(state.latest).toBe("1.5.0");
    expect(readUpdateState(file)).toMatchObject({ latest: "1.5.0", checkedAt: 1000 });
  });

  it("asks at most once a day", async () => {
    const file = fileIn();
    let asks = 0;
    const fetch = async () => {
      asks++;
      return npm("1.5.0")();
    };
    await refreshUpdate(file, { now: 0, fetch });
    await refreshUpdate(file, { now: CHECK_EVERY_MS - 1, fetch });
    expect(asks).toBe(1);
    await refreshUpdate(file, { now: CHECK_EVERY_MS, fetch });
    expect(asks).toBe(2);
  });

  it("offline, keeps the last answer and waits an hour before trying again", async () => {
    const file = fileIn();
    await refreshUpdate(file, { now: 0, fetch: npm("1.5.0") });
    let asks = 0;
    const failing = async () => {
      asks++;
      return offline();
    };
    const state = await refreshUpdate(file, { now: CHECK_EVERY_MS, fetch: failing });
    expect(state.latest).toBe("1.5.0");
    await refreshUpdate(file, { now: CHECK_EVERY_MS + RETRY_AFTER_MS - 1, fetch: failing });
    expect(asks).toBe(1);
    await refreshUpdate(file, { now: CHECK_EVERY_MS + RETRY_AFTER_MS, fetch: failing });
    expect(asks).toBe(2);
  });

  it("ignores a broken answer or a broken file", async () => {
    const file = fileIn();
    writeFileSync(file, "{not json");
    expect(readUpdateState(file)).toEqual({});
    const state = await refreshUpdate(file, { now: 5, fetch: async () => new Response("<html>", { status: 503 }) });
    expect(state.latest).toBeUndefined();
    const odd = await refreshUpdate(file, { now: 5 + RETRY_AFTER_MS, fetch: async () => new Response(JSON.stringify({ version: "../../x" }), { status: 200 }) });
    expect(odd.latest).toBeUndefined();
  });

  it("asks nothing when turned off", async () => {
    const file = fileIn();
    let asks = 0;
    await refreshUpdate(file, {
      now: 0,
      enabled: false,
      fetch: async () => {
        asks++;
        return npm("1.5.0")();
      },
    });
    expect(asks).toBe(0);
  });
});

describe("updateView and dismissing", () => {
  it("offers a newer version until it is dismissed, then again for the next one", async () => {
    const file = fileIn();
    await refreshUpdate(file, { now: 0, fetch: npm("1.5.0") });
    expect(updateView(readUpdateState(file), "1.4.0", "global")).toMatchObject({ current: "1.4.0", latest: "1.5.0", available: true, command: "npm install -g progressor-mcp@latest" });
    dismissUpdate(file, "1.5.0");
    expect(updateView(readUpdateState(file), "1.4.0", "global").available).toBe(false);
    await refreshUpdate(file, { now: CHECK_EVERY_MS, fetch: npm("1.6.0") });
    expect(updateView(readUpdateState(file), "1.4.0", "global")).toMatchObject({ latest: "1.6.0", available: true });
  });

  it("offers nothing when the running version is the newest, or when turned off", async () => {
    const file = fileIn();
    await refreshUpdate(file, { now: 0, fetch: npm("1.4.0") });
    expect(updateView(readUpdateState(file), "1.4.0", "global").available).toBe(false);
    await refreshUpdate(file, { now: CHECK_EVERY_MS, fetch: npm("1.5.0") });
    expect(updateView(readUpdateState(file), "1.4.0", "global", false).available).toBe(false);
  });

  it("only remembers a dismissed version that looks like one", () => {
    const file = fileIn();
    expect(() => dismissUpdate(file, "<script>")).toThrow();
    dismissUpdate(file, "1.5.0");
    expect(JSON.parse(readFileSync(file, "utf8")).dismissed).toBe("1.5.0");
  });
});

describe("how it was installed", () => {
  it("tells the container, npx and a global install apart", () => {
    expect(howInstalled({ PROGRESSOR_CONTAINER: "1" }, "/app/dist/cli.js")).toBe("docker");
    expect(howInstalled({}, "C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\progressor-mcp\\dist\\cli.js")).toBe("npx");
    expect(howInstalled({}, "/home/me/.npm/_npx/abc/node_modules/progressor-mcp/dist/cli.js")).toBe("npx");
    expect(howInstalled({}, "/usr/lib/node_modules/progressor-mcp/dist/cli.js")).toBe("global");
  });

  it("gives the command for each", () => {
    expect(updateCommand("global")).toBe("npm install -g progressor-mcp@latest");
    expect(updateCommand("docker")).toBe("docker pull ghcr.io/racstan/progressor-mcp:latest");
    expect(updateCommand("npx")).toContain("restart");
  });
});

describe("telling the AI", () => {
  it("tells it once per version, never after the Developer dismissed it", async () => {
    const file = fileIn();
    await refreshUpdate(file, { now: 0, fetch: npm("1.5.0") });
    const line = takeUpdateLine(file, "1.4.0", "global");
    expect(line).toContain("1.5.0");
    expect(line).toContain("1.4.0");
    expect(line).toContain("npm install -g progressor-mcp@latest");
    expect(takeUpdateLine(file, "1.4.0", "global")).toBeUndefined();

    await refreshUpdate(file, { now: CHECK_EVERY_MS, fetch: npm("1.6.0") });
    dismissUpdate(file, "1.6.0");
    expect(takeUpdateLine(file, "1.4.0", "global")).toBeUndefined();
  });

  it("says nothing with no newer version or nothing checked yet", () => {
    expect(takeUpdateLine(fileIn(), "1.4.0", "global")).toBeUndefined();
  });
});
