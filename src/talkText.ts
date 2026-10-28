// How the Agent is told what the Developer wrote on the dashboard: new messages and answers (once,
// see Project.takeNewFromDeveloper), what is still waiting, and a short line for Claude Code's
// prompt hook. Its own small module, like handTestText.ts, so the hooks need not load the server.
import type { Message, Question } from "./planFile.js";
import { type FromDeveloper, PROJECT_TALK } from "./project.js";

const quote = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** The block that tells the Agent what just arrived, one Goal after another; empty when nothing did. */
export function newsLines(news: { goal: string; from: FromDeveloper }[]): string[] {
  const lines = news.flatMap(({ goal, from }) => [
    ...from.messages.map((m) =>
      goal === PROJECT_TALK ? `- Message ${m.id} to the whole project: ${m.text} (reply with whole_project: true)` : `- Message ${m.id} on goal ${goal}: ${m.text}`,
    ),
    ...from.answers.map((q) => `- Answer to ${q.id} on goal ${goal} "${q.text}": ${q.answer}${q.decision ? ` (kept as decision ${q.decision})` : ""}`),
  ]);
  return lines.length > 0 ? ["New from the Developer on the dashboard (act on it, then answer each message with reply_to_developer):", ...lines] : [];
}

/** What is still open between the Agent and the Developer on a held Goal, for get_status. */
export function talkLines(s: { messages: Message[]; questions: Question[] }): string[] {
  return [
    ...(s.messages.length > 0 ? [`Messages from the Developer not replied to yet: ${s.messages.map((m) => `${m.id} ${quote(m.text, 200)}`).join("; ")}`] : []),
    ...(s.questions.length > 0 ? [`Your questions waiting for the Developer's answer: ${s.questions.map((q) => `${q.id} ${q.text}`).join("; ")}`] : []),
  ];
}

/** The whole project's messages not replied to yet, for get_status; any AI chat in the project can answer them. */
export function projectTalkLine(messages: Message[]): string | undefined {
  return messages.length > 0 ? `Messages to the whole project not replied to yet: ${messages.map((m) => `${m.id} ${quote(m.text, 200)}`).join("; ")}` : undefined;
}

/** Goals nobody here holds that have news, as "logo (1 message)"; the news stays unseen for whoever claims them. */
export function elsewhereNewsLine(goals: { goal: string; messages: number; answers: number }[]): string | undefined {
  const some = goals.filter((g) => g.messages + g.answers > 0);
  if (some.length === 0) return undefined;
  const count = (n: number, one: string, many: string) => (n > 0 ? [`${n} ${n === 1 ? one : many}`] : []);
  const each = some.map((g) => `${g.goal} (${[...count(g.messages, "message", "messages"), ...count(g.answers, "answer", "answers")].join(", ")})`);
  return `The Developer also wrote on goals you don't hold: ${each.join(", ")}. Claim the goal to read and act on it, or tell the Developer which goal you are on.`;
}

/** One line for Claude Code's prompt hook; the hook only reads, so the Agent is shown it again by get_status. */
export function promptNewsLine(messages: Message[], answers: Question[], toProject: Message[] = []): string | undefined {
  const parts = [
    ...toProject.map((m) => `message ${m.id} to the whole project: ${quote(m.text, 300)}`),
    ...messages.map((m) => `message ${m.id}: ${quote(m.text, 300)}`), ...answers.map((q) => `answer to ${q.id}: ${quote(q.answer ?? "", 300)}`)];
  return parts.length > 0 ? `New from the Developer on the dashboard: ${parts.join("; ")}. Call get_status to act on it.` : undefined;
}
