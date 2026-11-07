import { describe, expect, it } from "vitest";
import { DEFAULT_PHONE_SERVER, phoneMode, topicProblem } from "../src/ui/settings/phoneMode.js";

describe("which phone setup is in use", () => {
  it("is the default with ntfy.sh, a topic Progressor made and no token", () => {
    expect(phoneMode({ server: DEFAULT_PHONE_SERVER, topic: "progressor-0123456789abcdef" }, false)).toBe("default");
    expect(phoneMode({ server: "https://ntfy.sh/", topic: "" }, false)).toBe("default");
  });

  it("is your own with another server, a topic you chose, or a token", () => {
    expect(phoneMode({ server: "https://push.example.com", topic: "progressor-0123456789abcdef" }, false)).toBe("own");
    expect(phoneMode({ server: DEFAULT_PHONE_SERVER, topic: "my-alerts" }, false)).toBe("own");
    expect(phoneMode({ server: DEFAULT_PHONE_SERVER, topic: "progressor-0123456789abcdef" }, true)).toBe("own");
  });
});

describe("checking a topic you type", () => {
  it("accepts letters, digits, - and _, 3 to 64 of them", () => {
    expect(topicProblem("my-alerts_2")).toBeUndefined();
    expect(topicProblem("abc")).toBeUndefined();
  });

  it("says in plain words what is wrong", () => {
    expect(topicProblem("")).toMatch(/Type a topic/);
    expect(topicProblem("ab")).toMatch(/at least 3/);
    expect(topicProblem("x".repeat(65))).toMatch(/at most 64/);
    expect(topicProblem("has space")).toMatch(/letters, digits/);
  });
});
