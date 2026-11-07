// The Message your AI page: which messages are the dashboard's own notices, and how many of your
// AI's replies are new since the page was last opened in this browser.

/** What the dashboard writes to the AI when the person edits the rules, notes or wishlist (dashboard/http.ts). */
const NOTICE = "On the dashboard I ";

export const isNotice = (text: string) => text.startsWith(NOTICE);

/**
 * A notice as the person reads it: "You added wish w1 …". Sentences meant only for the AI, such as
 * "Read it again with get_rules …", are left out.
 */
export function noticeWords(text: string): string {
  return `You ${text.slice(NOTICE.length)}`
    .replace(/\s+Read it again with get_rules[^.]*\./, "")
    .replace(/\s+You may suggest a goal for it; don't change the wishlist yourself\./, "")
    .replace(/\s+Offer new ones with ask_developer\./, "")
    .replace(/[:.]\s+(?:I have what I wished for|I still want it|I don't want it any more|Follow it from now on|Stop following it)\.$/, ".");
}

/** The newest reply's time (ISO), or undefined when nothing has been answered. */
export function latestReply(messages: { repliedAt?: string }[]): string | undefined {
  return messages.reduce<string | undefined>((latest, m) => (m.repliedAt && (!latest || m.repliedAt > latest) ? m.repliedAt : latest), undefined);
}

/** Replies that came after `lastRead`; none before the page was ever opened in this browser. */
export function unreadReplies(messages: { repliedAt?: string }[], lastRead: string | undefined): number {
  if (!lastRead) return 0;
  return messages.filter((m) => m.repliedAt && m.repliedAt > lastRead).length;
}

/** What the page needs of a question to show it as alternatives (planFile.ts Question). */
export interface AlternativesLike {
  state: string;
  alternatives: { title: string }[];
  recommended?: number | undefined;
  answer?: string | undefined;
  chosenBy?: "AI" | "Developer" | undefined;
  proceeds?: string | undefined;
}

/** Which alternative was chosen (-1 for the person's own words) and by whom, or undefined while nobody has. */
export function chosen(q: AlternativesLike): { index: number; words: string } | undefined {
  if (q.state !== "answered" || !q.chosenBy) return undefined;
  return { index: q.alternatives.findIndex((a) => a.title === q.answer), words: q.chosenBy === "AI" ? "Your AI went ahead with" : "You picked" };
}

/** Alternatives show at the top of their goal while nobody has picked, or while only the AI has. */
export const atTop = (q: AlternativesLike) => q.alternatives.length > 0 && (q.state === "open" || (q.state === "answered" && q.chosenBy === "AI"));

const inWords = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
};

/** What happens if the person doesn't pick: nothing ever waits on them. */
export function goAheadWords(q: AlternativesLike, now: number): string | undefined {
  if (q.state === "answered") return q.chosenBy === "AI" ? "You can still pick another; your AI changes course." : undefined;
  if (q.state !== "open") return undefined;
  const pick = q.alternatives[(q.recommended ?? 1) - 1]?.title ?? "";
  const at = q.proceeds ? Date.parse(q.proceeds) : NaN;
  if (Number.isNaN(at) || at <= now) return `Your AI goes ahead with "${pick}" at its next step.`;
  return `If you don't pick, your AI goes ahead with "${pick}" in ${inWords(at - now)}.`;
}
