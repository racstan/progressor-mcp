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
    ...from.answers.map((q) => answerLine(goal, q)),
  ]);
  return lines.length > 0 ? ["New from the Developer on the dashboard (act on it, then answer each message with reply_to_developer):", ...lines] : [];
}

/** One answer as news; alternatives the AI went ahead with, or a pick that differs from it, say what to do. */
function answerLine(goal: string, q: Question): string {
  const kept = q.decision ? ` (kept as decision ${q.decision})` : "";
  if (q.chosenBy === "AI") return `- ${q.id} on goal ${goal} "${q.text}": nobody picked in time, so go ahead now with your recommended option: ${q.answer}${kept}. A later pick comes as news.`;
  if (q.wentAhead && q.answer !== q.wentAhead)
    return `- The Developer picked another option for ${q.id} on goal ${goal} "${q.text}": ${q.answer}, not ${q.wentAhead} that you went ahead with; change course${kept}`;
  return `- Answer to ${q.id} on goal ${goal} "${q.text}": ${q.answer}${kept}`;
}

/**
 * An open alternatives question for get_status: the AI's pick and when it goes ahead with it. One
 * whose wait is over is closed before the status is made and told as news (Project.takeNewFromDeveloper).
 */
function alternativesText(q: Question): string {
  const n = q.recommended ?? 1;
  return `${q.id} ${q.text} (yours: ${n} "${q.alternatives[n - 1]?.title ?? ""}"; if nobody picks, go ahead at ${q.proceeds})`;
}

/** What is still open between the Agent and the Developer on a held Goal, for get_status. */
export function talkLines(s: { messages: Message[]; questions: Question[] }): string[] {
  const plain = s.questions.filter((q) => q.alternatives.length === 0);
  const alternatives = s.questions.filter((q) => q.alternatives.length > 0);
  return [
    ...(s.messages.length > 0 ? [`Messages from the Developer not replied to yet: ${s.messages.map((m) => `${m.id} ${quote(m.text, 200)}`).join("; ")}`] : []),
    ...(plain.length > 0 ? [`Your questions waiting for the Developer's answer: ${plain.map((q) => `${q.id} ${q.text}`).join("; ")}`] : []),
    ...(alternatives.length > 0 ? [`Alternatives waiting for a pick: ${alternatives.map((q) => alternativesText(q)).join("; ")}`] : []),
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
