import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Look, eventsBetween } from "../src/events.js";
import { LEDGER_KEEP, buildRequest, ledgerFileFor, send, sendNew, sendTest } from "../src/ntfy.js";
import { SETTINGS_DEFAULTS } from "../src/settings.js";
import { tempDir } from "./tmp.js";

type G = { id: string; status?: string; hotfix?: boolean; questions?: string[]; tests?: string[]; alternatives?: string[] };
const look = (...goals: G[]): Look => [{ id: "shop", name: "Shop", goals: goals.map((g) => ({ title: `Goal ${g.id}`, status: "active", ...g })) }];
const on = (change: Partial<typeof SETTINGS_DEFAULTS.ntfy> = {}) => ({ ...SETTINGS_DEFAULTS.ntfy, enabled: true, topic: "progressor-abc", ...change });

function fake(result: { ok: boolean; status: number } | "fail" = { ok: true, status: 200 }) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fn = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: init.body });
    if (result === "fail") throw new Error("offline");
    return result;
  };
  return { calls, fn };
}

describe("eventsBetween", () => {
  it("finds a new question, a new thing to try, a finished goal and an alternative", () => {
    const before = look({ id: "a", questions: ["q1"], tests: ["t1"] }, { id: "b" }, { id: "c" });
    const after = look({ id: "a", questions: ["q1", "q2"], tests: ["t1", "t2"] }, { id: "b", status: "done" }, { id: "c", alternatives: ["x1"] });
    expect(eventsBetween(before, after).map((e) => e.key)).toEqual(["question/shop/a/q2", "handTest/shop/a/t2", "goalFinished/shop/b", "alternatives/shop/c/x1"]);
  });

  it("finds a hotfix that arrived as a new goal", () => {
    const events = eventsBetween(look({ id: "a" }), look({ id: "a" }, { id: "fix", hotfix: true }));
    expect(events.map((e) => [e.kind, e.goal.id])).toEqual([["hotfix", "fix"]]);
  });

  it("says nothing on the first look, for a new project, or for what was already there", () => {
    expect(eventsBetween(undefined, look({ id: "a", questions: ["q"], status: "done" }))).toEqual([]);
    expect(eventsBetween(look({ id: "a", questions: ["q"], status: "done" }), look({ id: "a", questions: ["q"], status: "done" }))).toEqual([]);
    expect(eventsBetween([], look({ id: "a", questions: ["q"] }))).toEqual([]);
    expect(eventsBetween(look({ id: "a" }), look({ id: "a" }, { id: "plain" }))).toEqual([]);
  });

  it("announces only the new question when one is answered and another asked", () => {
    expect(eventsBetween(look({ id: "a", questions: ["q1"] }), look({ id: "a", questions: ["q2"] })).map((e) => e.key)).toEqual(["question/shop/a/q2"]);
  });
});

describe("the request", () => {
  const event = eventsBetween(look({ id: "a" }), look({ id: "a", questions: ["q1"] }))[0]!;

  it("has a plain title, a link to the goal, a tag, and the message with titles when they are on", () => {
    const r = buildRequest(on({ server: "https://ntfy.example.com/" }), event, "http://localhost:4747/");
    expect(r.url).toBe("https://ntfy.example.com/progressor-abc");
    expect(r.headers).toEqual({ Title: "Progressor has a question", Tags: "question", Click: "http://localhost:4747/?project=shop#/goal/a" });
    expect(r.body).toBe('The AI is waiting for your answer. In "Goal a" (Shop).');
  });

  it("leaves goal and project names out when titles are off, and adds the token only when set", () => {
    const r = buildRequest(on({ includeTitles: false, token: "tk_secret" }), event, "http://localhost:4747");
    expect(r.body).toBe("The AI is waiting for your answer.");
    expect(r.headers.Authorization).toBe("Bearer tk_secret");
    expect(buildRequest(on(), event, "http://localhost:4747").headers.Authorization).toBeUndefined();
  });

  it("keeps non-ASCII goal titles out of headers", () => {
    const e = { ...event, goal: { id: "a", title: "Café ☕" } };
    const r = buildRequest(on(), e, "http://localhost:4747");
    expect(Object.values(r.headers).every((v) => /^[\x20-\x7e]*$/.test(v))).toBe(true);
    expect(r.body).toContain("Café ☕");
  });
});

describe("send", () => {
  const event = eventsBetween(look({ id: "a" }), look({ id: "a", tests: ["t1"] }))[0]!;

  it("posts when on, and says it went out", async () => {
    const f = fake();
    expect(await send(on(), event, f.fn)).toBe(true);
    expect(f.calls).toHaveLength(1);
  });

  it("is silent when off, with no topic, or with that kind of event switched off", async () => {
    const f = fake();
    expect(await send({ ...on(), enabled: false }, event, f.fn)).toBe(false);
    expect(await send(on({ topic: "" }), event, f.fn)).toBe(false);
    expect(await send(on({ events: { ...SETTINGS_DEFAULTS.ntfy.events, handTest: false } }), event, f.fn)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it("swallows network failures and refusals", async () => {
    expect(await send(on(), event, fake("fail").fn)).toBe(false);
    expect(await send(on(), event, fake({ ok: false, status: 500 }).fn)).toBe(false);
  });
});

describe("sendTest", () => {
  it("sends whatever the switches say and reports failures in words", async () => {
    const f = fake();
    expect(await sendTest({ ...on(), enabled: false }, f.fn)).toEqual({ ok: true });
    expect(f.calls[0]!.headers.Title).toBe("Progressor test");
    expect(await sendTest(on(), fake("fail").fn)).toEqual({ ok: false, error: "Could not reach the server." });
    expect(await sendTest(on(), fake({ ok: false, status: 401 }).fn)).toMatchObject({ ok: false, error: expect.stringContaining("token") });
    expect(await sendTest(on({ topic: "" }), f.fn)).toMatchObject({ ok: false });
  });
});

describe("the sent ledger", () => {
  const events = () => eventsBetween(look({ id: "a" }), look({ id: "a", questions: ["q1"], tests: ["t1"] }));
  const settingsFile = () => join(tempDir("progressor-ntfy-"), "settings.json");

  it("sends each event once, also from a second sender sharing the folder", async () => {
    const file = settingsFile();
    const f = fake();
    expect(await sendNew(file, on(), events(), "http://localhost:4747", f.fn)).toBe(2);
    expect(await sendNew(file, on(), events(), "http://localhost:4747", f.fn)).toBe(0);
    expect(f.calls).toHaveLength(2);
    expect(ledgerFileFor(file)).toBe(join(file, "..", "ntfy-sent.json"));
    expect(JSON.parse(readFileSync(ledgerFileFor(file), "utf8"))).toEqual(["question/shop/a/q1", "handTest/shop/a/t1"]);
  });

  it("does not note an event that failed to send, nor anything when off", async () => {
    const file = settingsFile();
    expect(await sendNew(file, on(), events(), "http://localhost:4747", fake("fail").fn)).toBe(0);
    expect(await sendNew(file, { ...on(), enabled: false }, events(), "http://localhost:4747", fake().fn)).toBe(0);
    expect(existsSync(ledgerFileFor(file))).toBe(false);
  });

  it("keeps only the last 500 keys, and survives a damaged ledger", async () => {
    const file = settingsFile();
    writeFileSync(ledgerFileFor(file), JSON.stringify(Array.from({ length: LEDGER_KEEP }, (_, i) => `old/${i}`)));
    await sendNew(file, on(), events(), "http://localhost:4747", fake().fn);
    const keys = JSON.parse(readFileSync(ledgerFileFor(file), "utf8")) as string[];
    expect(keys).toHaveLength(LEDGER_KEEP);
    expect(keys.at(-1)).toBe("handTest/shop/a/t1");
    expect(keys[0]).toBe("old/2");
    writeFileSync(ledgerFileFor(file), "{not json");
    expect(await sendNew(file, on(), events(), "http://localhost:4747", fake().fn)).toBe(2);
  });
});
