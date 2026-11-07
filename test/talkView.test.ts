import { describe, expect, it } from "vitest";
import { type AlternativesLike, atTop, chosen, goAheadWords, isNotice, latestReply, noticeWords, unreadReplies } from "../src/ui/talkView.js";

const m = (repliedAt?: string) => ({ repliedAt });

describe("unreadReplies", () => {
  it("counts the replies that came after the page was last opened", () => {
    const messages = [m("2026-10-31T10:00:00.000Z"), m("2026-10-31T12:00:00.000Z"), m(), m("2026-10-31T13:00:00.000Z")];
    expect(unreadReplies(messages, "2026-10-31T11:00:00.000Z")).toBe(2);
    expect(unreadReplies(messages, "2026-10-31T13:00:00.000Z")).toBe(0);
  });
  it("counts nothing before the page was ever opened in this browser", () => {
    expect(unreadReplies([m("2026-10-31T10:00:00.000Z")], undefined)).toBe(0);
  });
  it("never counts messages still waiting for an answer", () => {
    expect(unreadReplies([m(), m()], "2026-01-01T00:00:00.000Z")).toBe(0);
  });
});

describe("latestReply", () => {
  it("is the newest reply's time, or nothing", () => {
    expect(latestReply([m("2026-10-31T10:00:00.000Z"), m("2026-10-31T12:00:00.000Z"), m()])).toBe("2026-10-31T12:00:00.000Z");
    expect(latestReply([m()])).toBeUndefined();
  });
});

describe("notices", () => {
  it("tells the dashboard's own notices from what the person wrote", () => {
    expect(isNotice('On the dashboard I added wish w1 to the wishlist: "Stable".')).toBe(true);
    expect(isNotice("Stop everything")).toBe(false);
    expect(isNotice("on the dashboard I saw a bug")).toBe(false);
  });
  it("says a notice from the person's side", () => {
    expect(noticeWords('On the dashboard I added wish w1 to the wishlist: "Stable".')).toBe('You added wish w1 to the wishlist: "Stable".');
    expect(noticeWords("On the dashboard I changed the Important context. Read it again with get_rules before your next step.")).toBe(
      "You changed the Important context.",
    );
    expect(noticeWords(`On the dashboard I added wish w1 to the wishlist: "Stable". You may suggest a goal for it; don't change the wishlist yourself.`)).toBe(
      'You added wish w1 to the wishlist: "Stable".',
    );
  });
});

describe("notice endings meant for the AI", () => {
  it("are left out", () => {
    expect(noticeWords(`On the dashboard I ticked off wish w1, "Stable": I have what I wished for.`)).toBe('You ticked off wish w1, "Stable".');
    expect(noticeWords(`On the dashboard I removed wish w1 from the wishlist: "Stable". I don't want it any more.`)).toBe(
      'You removed wish w1 from the wishlist: "Stable".',
    );
    expect(noticeWords(`On the dashboard I removed rule s1: "Tests first". Stop following it.`)).toBe('You removed rule s1: "Tests first".');
  });
});

describe("alternatives on the page", () => {
  const alts = [{ title: "Cards" }, { title: "List" }];
  const q = (over: Partial<AlternativesLike>): AlternativesLike => ({
    state: "open", alternatives: alts, recommended: 1, answer: undefined, chosenBy: undefined, proceeds: undefined, ...over,
  });
  const now = Date.parse("2026-10-28T10:00:00.000Z");

  it("say who chose and which one", () => {
    expect(chosen(q({ state: "answered", answer: "List", chosenBy: "Developer" }))).toEqual({ index: 1, words: "You picked" });
    expect(chosen(q({ state: "answered", answer: "Cards", chosenBy: "AI" }))).toEqual({ index: 0, words: "Your AI went ahead with" });
    expect(chosen(q({ state: "answered", answer: "Something else", chosenBy: "Developer" }))).toEqual({ index: -1, words: "You picked" });
    expect(chosen(q({}))).toBeUndefined();
  });

  it("show at the top of the goal while open, or while the AI's pick stands", () => {
    expect(atTop(q({}))).toBe(true);
    expect(atTop(q({ state: "answered", answer: "Cards", chosenBy: "AI" }))).toBe(true);
    expect(atTop(q({ state: "answered", answer: "Cards", chosenBy: "Developer" }))).toBe(false);
    expect(atTop(q({ alternatives: [] }))).toBe(false);
    expect(atTop(q({ state: "withdrawn" }))).toBe(false);
  });

  it("say when the AI goes ahead if nobody picks", () => {
    expect(goAheadWords(q({ proceeds: "2026-10-28T10:10:00.000Z" }), now)).toBe('If you don\'t pick, your AI goes ahead with "Cards" in 10 min.');
    expect(goAheadWords(q({ proceeds: "2026-10-28T12:00:00.000Z" }), now)).toBe('If you don\'t pick, your AI goes ahead with "Cards" in 2 h.');
    expect(goAheadWords(q({ proceeds: "2026-10-30T10:00:00.000Z" }), now)).toBe('If you don\'t pick, your AI goes ahead with "Cards" in 2 days.');
    expect(goAheadWords(q({ proceeds: "2026-10-28T09:00:00.000Z" }), now)).toBe('Your AI goes ahead with "Cards" at its next step.');
    expect(goAheadWords(q({ state: "answered", answer: "Cards", chosenBy: "AI" }), now)).toBe("You can still pick another; your AI changes course.");
    expect(goAheadWords(q({ state: "answered", answer: "Cards", chosenBy: "Developer" }), now)).toBeUndefined();
  });
});

describe("asking for other options", () => {
  it("reads as the person's own notice", () => {
    expect(noticeWords('On the dashboard I asked for other options to question q1 "Which layout?". Offer new ones with ask_developer.')).toBe(
      'You asked for other options to question q1 "Which layout?".',
    );
  });
});
