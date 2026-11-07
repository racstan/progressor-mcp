// Phone notifications with ntfy (https://ntfy.sh, open source): the dashboard hub POSTs a short
// message to <server>/<topic> and the ntfy app on the phone shows it. Only the hub sends, so a push
// is never doubled; a small ledger of what was sent, kept next to settings.json, stops a repeat when
// the hub hands over to a newer Progressor. A network failure is silent: a phone that cannot be
// reached never gets in the way of the work.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type EventKind, type Look, type LookProject, type PlanEvent, eventsBetween } from "./events.js";
import { withLock } from "./lock.js";
import type { Project } from "./project.js";
import type { Settings } from "./settings.js";

export { eventsBetween };
export type { EventKind, Look, PlanEvent };
export type NtfySettings = Settings["ntfy"];
export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/** How many sent keys the ledger keeps. */
export const LEDGER_KEEP = 500;

/** What each kind of event says. Headers must be plain ASCII, so goal titles go in the message only. */
const WORDS: Record<EventKind, { title: string; text: string; tag: string; priority?: string }> = {
  question: { title: "Progressor has a question", text: "The AI is waiting for your answer.", tag: "question" },
  handTest: { title: "Something is ready to try", text: "There is something for you to try by hand.", tag: "test_tube" },
  goalFinished: { title: "A goal is finished", text: "A goal is finished.", tag: "white_check_mark" },
  hotfix: { title: "A hotfix arrived", text: "A bug report is waiting to be fixed before other work.", tag: "rotating_light", priority: "high" },
  alternatives: { title: "Choices are waiting", text: "The AI offered choices for you to look at.", tag: "twisted_rightwards_arrows" },
};

const trim = (s: string) => s.replace(/\/+$/, "");

/** The address that opens one goal on the dashboard. */
export function goalUrl(dashboardUrl: string, projectId: string, goalId: string): string {
  return `${trim(dashboardUrl)}/?project=${encodeURIComponent(projectId)}#/goal/${encodeURIComponent(goalId)}`;
}

/** The request for one event: where it goes, its headers and its message. */
export function buildRequest(settings: NtfySettings, event: PlanEvent, dashboardUrl: string) {
  const words = WORDS[event.kind];
  const where = settings.includeTitles ? ` In "${event.goal.title}" (${event.project.name}).` : "";
  const headers: Record<string, string> = { Title: words.title, Tags: words.tag, Click: goalUrl(dashboardUrl, event.project.id, event.goal.id) };
  if (words.priority) headers.Priority = words.priority;
  return { url: `${trim(settings.server)}/${encodeURIComponent(settings.topic)}`, headers: withToken(headers, settings), body: `${words.text}${where}` };
}

function withToken(headers: Record<string, string>, settings: NtfySettings): Record<string, string> {
  return settings.token ? { ...headers, Authorization: `Bearer ${settings.token}` } : headers;
}

const defaultFetch: FetchFn = (url, init) => fetch(url, init);

async function post(request: { url: string; headers: Record<string, string>; body: string }, fetchFn: FetchFn): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchFn(request.url, { method: "POST", headers: request.headers, body: request.body, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { ok: true };
    return { ok: false, error: res.status === 401 || res.status === 403 ? "The server wants a token for this topic, or the token is wrong." : `The server answered ${res.status}.` };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

/** Sends one event if phone notifications and that kind of event are on. True when it went out; never throws. */
export async function send(settings: NtfySettings, event: PlanEvent, fetchFn: FetchFn = defaultFetch, dashboardUrl = "http://localhost:4747"): Promise<boolean> {
  if (!settings.enabled || !settings.topic || !settings.events[event.kind]) return false;
  return (await post(buildRequest(settings, event, dashboardUrl), fetchFn)).ok;
}

/** The test message from Settings: sent whatever the switches say, and says in words what went wrong. */
export async function sendTest(settings: NtfySettings, fetchFn: FetchFn = defaultFetch): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!settings.topic) return { ok: false, error: "Turn on phone notifications first, so there is a topic to send to." };
  const headers = withToken({ Title: "Progressor test", Tags: "tada" }, settings);
  return post({ url: `${trim(settings.server)}/${encodeURIComponent(settings.topic)}`, headers, body: "It works. You will get a message like this when Progressor needs you." }, fetchFn);
}

/** The ledger of what was sent, next to settings.json. */
export const ledgerFileFor = (settingsFile: string) => join(dirname(settingsFile), "ntfy-sent.json");

function readLedger(file: string): string[] {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(data) ? data.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeLedger(file: string, keys: string[]): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(keys.slice(-LEDGER_KEEP))}\n`);
    renameSync(tmp, file);
  } catch {
    // a ledger that cannot be written only risks a repeated push
  }
}

/** Sends the events not sent before, and writes each one that went out in the ledger. Gives how many went out. */
export async function sendNew(settingsFile: string, settings: NtfySettings, events: PlanEvent[], dashboardUrl: string, fetchFn: FetchFn = defaultFetch): Promise<number> {
  if (!settings.enabled || events.length === 0) return 0;
  const file = ledgerFileFor(settingsFile);
  let sent = 0;
  for (const event of events) {
    if (withLock(dirname(file), () => readLedger(file)).includes(event.key)) continue;
    if (!(await send(settings, event, fetchFn, dashboardUrl))) continue;
    sent++;
    withLock(dirname(file), () => writeLedger(file, [...readLedger(file), event.key]));
  }
  return sent;
}

/** One project as seen now: its goals and the IDs of open questions, alternatives and hand tests. A plan that cannot be read shows without them. */
export function lookAtProject(project: Project, id: string, name: string): LookProject {
  const goals = project.roadmap().goals.map((g) => {
    let questions: string[] = [];
    let tests: string[] = [];
    let alternatives: string[] = [];
    try {
      const asked = project.talk(g.id).questions;
      const key = (q: (typeof asked)[number]) => q.id ?? q.ref ?? q.text;
      questions = asked.filter((q) => q.state === "open" && q.alternatives.length === 0).map(key);
      // Alternatives offered and not picked by the Developer, even once the AI has gone ahead with its own.
      alternatives = asked.filter((q) => q.alternatives.length > 0 && (q.state === "open" || q.chosenBy === "AI")).map(key);
      tests = project.plan(g.id).handTests.filter((h) => h.result === "pending").map((h) => h.id ?? h.ref ?? h.text);
    } catch {
      // keep the goal, without what waits on the Developer
    }
    return { id: g.id, title: g.title, status: g.status, ...(g.hotfix ? { hotfix: true } : {}), questions, tests, alternatives };
  });
  return { id, name, goals };
}
