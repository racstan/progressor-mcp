// Phone notifications: whether the default setup (ntfy.sh with a private topic Progressor made) is in
// use or one of your own, and what is wrong with a topic you type. The server checks topics the same way.

export const DEFAULT_PHONE_SERVER = "https://ntfy.sh";
const MADE = /^progressor-[0-9a-f]{16}$/;

export function phoneMode(ntfy: { server: string; topic: string }, tokenSet: boolean): "default" | "own" {
  const server = ntfy.server.replace(/\/+$/, "");
  return server === DEFAULT_PHONE_SERVER && (ntfy.topic === "" || MADE.test(ntfy.topic)) && !tokenSet ? "default" : "own";
}

/** What is wrong with a topic, in plain words; undefined when it is fine. */
export function topicProblem(topic: string): string | undefined {
  if (!topic) return "Type a topic.";
  if (topic.length < 3) return "A topic needs at least 3 characters.";
  if (topic.length > 64) return "A topic can have at most 64 characters.";
  if (!/^[A-Za-z0-9_-]+$/.test(topic)) return "Use only letters, digits, - and _ in a topic.";
  return undefined;
}
