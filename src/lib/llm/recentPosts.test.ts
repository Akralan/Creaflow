import { describe, expect, it } from "vitest";
import { hookOpening, lastSentence, postCardFromScript } from "./recentPosts";
import { buildRecentPostsBlock } from "./prompts";
import { checkGeneratedPost } from "./scriptChecks";
import type { GenerationPrep } from "./scriptSchema";

const trace = {
  reader: { label: "Players" },
  candidateMoments: [{ moment: "Other" }, { moment: "The jump tuned" }],
  chosenMoment: { index: 1, why: "" },
  hookOptions: [{ kind: "Chiffre", text: "" }],
  chosenHook: { index: 0, why: "" },
};

describe("postCardFromScript", () => {
  it("draws audience, moment and hook type from the trace, and the last sentence of the text", () => {
    const card = postCardFromScript({
      createdAt: new Date("2026-10-12T10:00:00Z"),
      platform: "x",
      hookText: "80 ms too long in the air.",
      storyboard: null,
      caption: "The jump felt mushy. We tuned the gravity. Here is the before and after.",
      generationTrace: trace,
    });
    expect(card).toEqual({
      createdAt: "2026-10-12T10:00:00.000Z",
      platform: "x",
      readerLabel: "Players",
      moment: "The jump tuned",
      hook: "80 ms too long in the air.",
      hookKind: "chiffre",
      ending: "Here is the before and after.",
    });
  });

  it("stays usable without a trace (old or manual script), with the 1st slide as the hook", () => {
    const card = postCardFromScript({
      createdAt: new Date(),
      platform: "instagram",
      hookText: null,
      storyboard: [{ planNumber: 1, description: "Jump before / after" }],
      caption: null,
      generationTrace: null,
    });
    expect(card).toMatchObject({ readerLabel: null, moment: null, hookKind: null, hook: "Jump before / after", ending: null });
  });
});

describe("lastSentence / hookOpening", () => {
  it("cuts an ending that is too long", () => {
    expect(lastSentence("a".repeat(300))?.length).toBe(160);
  });
  it("compares the first 6 words without accents or punctuation", () => {
    expect(hookOpening("I’ve deleted 4,000 lines, this week!")).toBe(hookOpening("i've deleted 4 000 lines this week-long"));
  });
});

describe("buildRecentPostsBlock", () => {
  it("lists the cards, and nothing without a recent post", () => {
    expect(buildRecentPostsBlock([])).toBe("");
    const block = buildRecentPostsBlock([
      { createdAt: "2026-10-12T10:00:00.000Z", platform: "x", readerLabel: "Players", moment: "The jump", hook: "80 ms", hookKind: "chiffre", ending: "Fin." },
    ]);
    expect(block).toContain("<recent_posts>");
    expect(block).toContain("- Oct 12 · x · audience: Players: moment \"The jump\" · hook [chiffre] \"80 ms\" · ending \"Fin.\"");
  });
});

describe("repetition checks", () => {
  const body = "A text long enough for LinkedIn. ".repeat(25);
  const prep = (kind: string): GenerationPrep => ({
    reader: { label: "Devs", knows: "", wants: "" },
    candidateMoments: [],
    chosenMoment: { index: 0, why: "" },
    hookOptions: [{ kind, text: "" }],
    chosenHook: { index: 0, why: "" },
    inspirationsUsed: [],
    inspirationsToDrop: [],
    selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Yes.", authorTest: true },
  });
  const card = (hook: string, hookKind: string | null) => ({ createdAt: "", platform: "linkedin", readerLabel: null, moment: null, hook, hookKind, ending: null });
  const ctx = (recentPosts: ReturnType<typeof card>[]) => ({ platform: "linkedin", contentType: "text" as const, materialTexts: [], avoid: [], recentPosts });
  const post = (hookText: string) => ({ title: "T", hookText, caption: body, hashtags: [], usedExcerpts: [], promisesMade: [] });

  it("rejects a hook that reuses the opening of a recent post", () => {
    const failures = checkGeneratedPost(post("I deleted 4,000 lines this month."), null, ctx([card("I deleted 4,000 lines this week.", null)]));
    expect(failures[0]).toMatch(/^The hook repeats that of a recent post/);
  });

  it("rejects a 3rd post in a row with the same hook type, not a 2nd", () => {
    const twice = ctx([card("A b c d e f g", "chiffre"), card("H i j k l m n", "chiffre")]);
    expect(checkGeneratedPost(post("Entirely different new entry here"), prep("Chiffre"), twice)).toContain(
      "The last two posts already opened with a \"chiffre\" type of hook: choose another type."
    );
    expect(checkGeneratedPost(post("Entirely different new entry here"), prep("aveu"), twice)).toEqual([]);
    expect(checkGeneratedPost(post("Entirely different new entry here"), prep("chiffre"), ctx([card("A b c d e f g", "chiffre")]))).toEqual([]);
  });
});
