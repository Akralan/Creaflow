import { describe, expect, it } from "vitest";
import { buildRefusalBlock, checkGeneratedPost, normalizeForCheck, type CheckablePost, type CheckContext } from "./scriptChecks";
import type { GenerationPrep } from "./scriptSchema";

const linkedinBody = "I deleted 4,000 lines this week and the app starts twice as fast. ".repeat(10);

const post = (overrides: Partial<CheckablePost> = {}): CheckablePost => ({
  title: "Four thousand lines fewer",
  hookText: "I deleted 4,000 lines this week.",
  caption: linkedinBody,
  hashtags: ["#refactor"],
  usedExcerpts: [],
  ...overrides,
});

const ctx = (overrides: Partial<CheckContext> = {}): CheckContext => ({
  platform: "linkedin",
  contentType: "text",
  materialTexts: [],
  avoid: [],
  ...overrides,
});

const prep = (selfCheck: Partial<GenerationPrep["selfCheck"]> = {}): GenerationPrep => ({
  reader: { label: "Devs", knows: "", wants: "" },
  candidateMoments: [],
  chosenMoment: { index: 0, why: "" },
  hookOptions: [],
  chosenHook: { index: 0, why: "" },
  inspirationsUsed: [],
  inspirationsToDrop: [],
  selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "They want the number.", authorTest: true, ...selfCheck },
});

describe("normalizeForCheck", () => {
  it("strips accents, case, typographic apostrophes and repeated spaces", () => {
    expect(normalizeForCheck("  Don’t   HESITATE ")).toBe("don't hesitate");
  });
});

describe("checkGeneratedPost", () => {
  it("lets a clean post through", () => {
    expect(checkGeneratedPost(post(), prep(), ctx())).toEqual([]);
  });

  it("spots banned phrasings, ignoring accents and case", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} Discover how it works. It's not a tool, it's a method.` }), null, ctx());
    expect(failures).toContain("Banned phrasing: \"discover how/why/what\" in the text.");
    expect(failures).toContain("Banned phrasing: \"it's not …, it's …\" in the text.");
  });

  it("does not confuse a not-finished-but-usable sentence with the banned phrasing", () => {
    expect(checkGeneratedPost(post({ caption: `${linkedinBody} It's not finished yet but it's usable.` }), null, ctx())).toEqual([]);
  });

  it("counts the to-be-completed placeholder whatever the case", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} [to be completed] [To Be Completed] [TO BE COMPLETED]` }), null, ctx());
    expect(failures).toContain("3 \"[to be completed]\", 2 at most.");
  });

  it("spots a rhetorical question as an opener", () => {
    expect(checkGeneratedPost(post({ hookText: "What if we deleted everything?" }), null, ctx())).toContain(
      "Banned phrasing: \"what if…? as an opener\"."
    );
  });

  it("applies the style Avoid list", () => {
    expect(checkGeneratedPost(post({ caption: `${linkedinBody} A real game-changer.` }), null, ctx({ avoid: ["real"] }))).toEqual(
      expect.arrayContaining(["Phrasing the author bans: \"real\" in the text.", "Banned phrasing: \"game changer\" in the text."])
    );
  });

  it("checks hook length, text length and hashtag count per platform", () => {
    const failures = checkGeneratedPost(post({ hookText: "x".repeat(250), caption: "Too short.", hashtags: ["#a", "#b", "#c", "#d"] }), null, ctx());
    expect(failures).toContain("The hook is 250 characters long, linkedin shows 200 before \"see more\".");
    expect(failures.some((f) => f.startsWith("The text is"))).toBe(true);
    expect(failures).toContain("4 hashtags, expected between 0 and 3.");
  });

  it("counts the hook in the length when the caption does not contain it (X)", () => {
    const failures = checkGeneratedPost(post({ hookText: "a".repeat(100), caption: "b".repeat(200), hashtags: [] }), null, ctx({ platform: "x" }));
    expect(failures).toContain("The text is 301 characters long, expected between 0 and 280.");
  });

  it("checks the title as the subject line for a newsletter", () => {
    const failures = checkGeneratedPost(
      post({ title: "A newsletter subject line far too long for the inbox preview", caption: "x".repeat(2000), hashtags: [] }),
      null,
      ctx({ platform: "newsletter" })
    );
    expect(failures.some((f) => f.startsWith("The title is"))).toBe(true);
  });

  it("limits the caption of a visual without text", () => {
    const failures = checkGeneratedPost(
      post({ hookText: undefined, hookVisual: "Photo", storyboard: [{ planNumber: 1, description: "Slide" }], caption: "x".repeat(400) }),
      null,
      ctx({ contentType: "visual", visual: { format: "single", slideCount: null, durationMs: null, withText: false } })
    );
    expect(failures).toContain("The text is 400 characters long, expected between 0 and 300.");
  });

  it("ignores the limits of an unknown platform", () => {
    expect(checkGeneratedPost(post({ caption: "court", hashtags: ["#a", "#b", "#c", "#d", "#e", "#f"] }), null, ctx({ platform: "mastodon" }))).toEqual([]);
  });

  it("fails only if no quote is found in the material", () => {
    const materialTexts = ["[already used in a previous post]Run 31 converged in 4 hours.[/already used] Then nothing."];
    expect(checkGeneratedPost(post({ usedExcerpts: ["Run 31 converged in 4 hours."] }), null, ctx({ materialTexts }))).toEqual([]);
    expect(checkGeneratedPost(post({ usedExcerpts: ["Run 31 converged in 4 hours.", "Made up out of thin air here."] }), null, ctx({ materialTexts }))).toEqual([]);
    expect(checkGeneratedPost(post({ usedExcerpts: ["A sentence that exists nowhere else."] }), null, ctx({ materialTexts }))).toContain(
      "None of the usedExcerpts quotes can be found in the material: quote the passages word for word."
    );
  });

  it("rejects more than two to-be-completed placeholders", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} [to be completed] [to be completed] [to be completed]` }), null, ctx());
    expect(failures).toContain("3 \"[to be completed]\", 2 at most.");
  });

  it("reuses the storyboard format reminder", () => {
    const failures = checkGeneratedPost(
      post({ hookText: undefined, hookVisual: "Photo", storyboard: [{ planNumber: 1, description: "a" }, { planNumber: 2, description: "b" }] }),
      null,
      ctx({ contentType: "visual", visual: { format: "carousel", slideCount: 3, durationMs: null } })
    );
    expect(failures.some((f) => f.startsWith("Format reminder"))).toBe(true);
  });

  it("turns each missed point of the declared review into a failure", () => {
    const failures = checkGeneratedPost(
      post(),
      prep({ factsFromMaterial: false, bannedPhrasesFound: ["Discover"], readerTest: "\"None\".", authorTest: false }),
      ctx()
    );
    expect(failures).toHaveLength(4);
  });
});

describe("buildRefusalBlock", () => {
  it("lists the reasons in a <refusal> block", () => {
    const block = buildRefusalBlock(["Reason A", "Reason B"]);
    expect(block.startsWith("<refusal>\nYour previous version was rejected:\n- Reason A\n- Reason B\n")).toBe(true);
    expect(block.endsWith("</refusal>")).toBe(true);
  });
});
