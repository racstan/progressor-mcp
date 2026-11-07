import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pathKey } from "../src/dashboard/registry.js";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_SECTIONS,
  maskSecrets,
  newTopic,
  readSettings,
  renewTopic,
  resetSettings,
  settingsFileFor,
  writeSettings,
} from "../src/settings.js";
import { tempDir } from "./tmp.js";

const fresh = () => join(tempDir("progressor-settings-"), "settings.json");
const raw = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("settings defaults", () => {
  it("gives every feature's defaults when there is no settings file", () => {
    const s = readSettings(fresh());
    expect(s.history).toEqual({ enabled: true, keepDays: 30, maxEntries: 500, maxMB: 20 });
    expect(s.evidence).toEqual({ record: true, warnUncommitted: true });
    expect(s.estimates).toEqual({ learn: true, window: 20 });
    expect(s.checkup).toEqual({ autoRepair: true, onStatus: true });
    expect(s.release).toEqual({ files: ["package.json", "server.json"], changelog: "CHANGELOG.md" });
    expect(s.dependencies).toEqual({ warnOnClaim: true });
    expect(s.routines).toEqual({ enabled: true, createFromDashboard: true });
    expect(s.ntfy).toEqual({
      enabled: false,
      server: "https://ntfy.sh",
      topic: "",
      token: "",
      events: { question: true, handTest: true, goalFinished: true, hotfix: true, alternatives: true },
      includeTitles: true,
    });
    expect(s.alternatives).toEqual({ wait: "0m", offer: "big choices" });
    expect(s.handoffs).toEqual({ afterRelease: true, keep: 50 });
    expect(SETTINGS_SECTIONS).toEqual(Object.keys(SETTINGS_DEFAULTS));
  });

  it("reads a broken file as the defaults, and a wrong value as its default", () => {
    const file = fresh();
    writeFileSync(file, "{ not json");
    expect(readSettings(file)).toEqual(SETTINGS_DEFAULTS);
    writeFileSync(file, JSON.stringify({ history: { keepDays: "lots", maxEntries: 9 }, alternatives: { offer: "sometimes" } }));
    const s = readSettings(file);
    expect(s.history.keepDays).toBe(30);
    expect(s.history.maxEntries).toBe(9);
    expect(s.alternatives.offer).toBe("big choices");
  });

  it("never hands out the defaults object itself, so a caller cannot change them", () => {
    const s = readSettings(fresh());
    s.release.files.push("x");
    expect(SETTINGS_DEFAULTS.release.files).toEqual(["package.json", "server.json"]);
  });
});

describe("changing settings", () => {
  it("saves a change over the defaults and keeps the rest", () => {
    const file = fresh();
    const s = writeSettings(file, "history", { keepDays: 7 });
    expect(s.history).toEqual({ enabled: true, keepDays: 7, maxEntries: 500, maxMB: 20 });
    expect(raw(file)).toEqual({ history: { keepDays: 7 } });
    writeSettings(file, "history", { enabled: false });
    expect(readSettings(file).history).toMatchObject({ enabled: false, keepDays: 7 });
  });

  it("changes part of a nested group", () => {
    const file = fresh();
    writeSettings(file, "ntfy", { events: { hotfix: false } });
    expect(readSettings(file).ntfy.events).toEqual({ question: true, handTest: true, goalFinished: true, hotfix: false, alternatives: true });
  });

  it("refuses a value of the wrong kind, and a section that does not exist, in plain words", () => {
    const file = fresh();
    expect(() => writeSettings(file, "history", { keepDays: "soon" })).toThrow(/keepDays/);
    expect(() => writeSettings(file, "alternatives", { offer: "never ever" })).toThrow(/offer/);
    expect(() => writeSettings(file, "colours", { x: 1 })).toThrow(/no settings called "colours"/);
    expect(existsSync(file)).toBe(false);
  });

  it("keeps keys it does not know, from a newer Progressor, through reads and writes", () => {
    const file = fresh();
    writeFileSync(file, JSON.stringify({ future: { on: true }, history: { keepDays: 3, colour: "blue" } }));
    expect((readSettings(file).history as Record<string, unknown>).colour).toBe("blue");
    writeSettings(file, "history", { maxMB: 5 });
    expect(raw(file)).toEqual({ future: { on: true }, history: { keepDays: 3, colour: "blue", maxMB: 5 } });
  });

  it("makes up a private topic the first time phone notifications are turned on", () => {
    const file = fresh();
    expect(writeSettings(file, "ntfy", { includeTitles: false }).ntfy.topic).toBe("");
    const topic = writeSettings(file, "ntfy", { enabled: true }).ntfy.topic;
    expect(topic).toMatch(/^progressor-[0-9a-f]{16}$/);
    expect(writeSettings(file, "ntfy", { enabled: false }).ntfy.topic).toBe(topic);
  });

  it("takes a topic of your own made of safe characters, at a sensible length", () => {
    const file = fresh();
    expect(writeSettings(file, "ntfy", { topic: "my-alerts_2" }).ntfy.topic).toBe("my-alerts_2");
    expect(writeSettings(file, "ntfy", { topic: "abc" }).ntfy.topic).toBe("abc");
    for (const bad of ["ab", "has space", "a/b", "émoji", "x".repeat(65), "dots.in.it"])
      expect(() => writeSettings(file, "ntfy", { topic: bad }), bad).toThrow(/topic/);
    expect(readSettings(file).ntfy.topic).toBe("abc");
  });

  it("makes a new private topic on request, different from the last", () => {
    const file = fresh();
    const first = writeSettings(file, "ntfy", { enabled: true }).ntfy.topic;
    const next = renewTopic(file).ntfy.topic;
    expect(next).toMatch(/^progressor-[0-9a-f]{16}$/);
    expect(next).not.toBe(first);
    expect(newTopic()).toMatch(/^progressor-[0-9a-f]{16}$/);
  });
});

describe("one project's own settings", () => {
  it("merges defaults, then the settings for every project, then this project's", () => {
    const file = fresh();
    const shop = tempDir("progressor-shop-");
    const other = tempDir("progressor-other-");
    writeSettings(file, "history", { keepDays: 10, maxMB: 5 });
    writeSettings(file, "history", { keepDays: 2 }, shop);
    expect(readSettings(file, shop).history).toEqual({ enabled: true, keepDays: 2, maxEntries: 500, maxMB: 5 });
    expect(readSettings(file, other).history.keepDays).toBe(10);
    expect(readSettings(file).history.keepDays).toBe(10);
    expect(raw(file).projects[pathKey(shop)]).toEqual({ history: { keepDays: 2 } });
  });
});

describe("resetting settings", () => {
  it("resets one section everywhere, and leaves the others", () => {
    const file = fresh();
    const shop = tempDir("progressor-shop-");
    writeSettings(file, "history", { keepDays: 10 });
    writeSettings(file, "history", { keepDays: 2 }, shop);
    writeSettings(file, "estimates", { window: 5 });
    const s = resetSettings(file, "history");
    expect(s.history).toEqual(SETTINGS_DEFAULTS.history);
    expect(readSettings(file, shop).history).toEqual(SETTINGS_DEFAULTS.history);
    expect(s.estimates.window).toBe(5);
  });

  it("resets one section for one project only", () => {
    const file = fresh();
    const shop = tempDir("progressor-shop-");
    writeSettings(file, "history", { keepDays: 10 });
    writeSettings(file, "history", { keepDays: 2 }, shop);
    expect(resetSettings(file, "history", shop).history.keepDays).toBe(10);
    expect(readSettings(file).history.keepDays).toBe(10);
  });

  it("resets everything to the defaults", () => {
    const file = fresh();
    const shop = tempDir("progressor-shop-");
    writeSettings(file, "history", { keepDays: 10 });
    writeSettings(file, "routines", { enabled: false }, shop);
    expect(resetSettings(file)).toEqual(SETTINGS_DEFAULTS);
    expect(readSettings(file, shop)).toEqual(SETTINGS_DEFAULTS);
  });

  it("refuses to reset a section that does not exist", () => {
    expect(() => resetSettings(fresh(), "colours")).toThrow(/no settings called/);
  });
});

describe("where settings are kept", () => {
  it("sits next to the project list, unless PROGRESSOR_SETTINGS names a file", () => {
    const before = process.env.PROGRESSOR_SETTINGS;
    try {
      delete process.env.PROGRESSOR_SETTINGS;
      expect(settingsFileFor(join("a", "b", "projects.json"))).toBe(join("a", "b", "settings.json"));
      process.env.PROGRESSOR_SETTINGS = join("x", "mine.json");
      expect(settingsFileFor(join("a", "b", "projects.json"))).toBe(join("x", "mine.json"));
    } finally {
      if (before === undefined) delete process.env.PROGRESSOR_SETTINGS;
      else process.env.PROGRESSOR_SETTINGS = before;
    }
  });

  it("hides secrets when settings are shown, saying only whether one is set", () => {
    const file = fresh();
    const s = writeSettings(file, "ntfy", { token: "tk_secret" });
    const shown = maskSecrets(s);
    expect(shown.settings.ntfy.token).toBe("");
    expect(shown.secretsSet).toEqual(["ntfy.token"]);
    expect(s.ntfy.token).toBe("tk_secret");
    expect(maskSecrets(readSettings(fresh())).secretsSet).toEqual([]);
  });
});
