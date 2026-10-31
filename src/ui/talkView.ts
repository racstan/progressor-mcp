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
