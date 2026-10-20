import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildReaderPortraitMessage, describeReaders, parseStoredReaderPortrait, portraitIsStale, type ReaderPortraitContext } from "./readerPortrait";

const reader = { label: "Players", who: "Platformer fans", knows: "", wants: "", stopsFor: "", turnsOff: "", words: ["wishlist"] };

const ctx: ReaderPortraitContext = {
  subjectName: "Mira",
  subjectDescription: "Platformer game",
  valueProposition: null,
  subjectAudience: "Platformer players",
  brandAudience: null,
  activityType: "You build a game",
  platforms: ["x", "instagram"],
  materialSummaries: ["The jump was tuned."],
};

beforeEach(() => callStructuredMock.mockReset());

describe("buildReaderPortraitMessage", () => {
  it("gives the subject, the author's Who-for and the summaries", () => {
    const message = buildReaderPortraitMessage(ctx);
    expect(message).toContain("Subject: Mira — Platformer game");
    expect(message).toContain("Who for, according to the author: Platformer players");
    expect(message).toContain("The author's general audience: (not specified)");
    expect(message).toContain("Platforms where they publish: x, instagram");
    expect(message).toContain("- The jump was tuned.");
  });
});

describe("describeReaders", () => {
  it("keeps 3 audiences at most and records the audience sentence it is based on", async () => {
    callStructuredMock.mockResolvedValue({ readers: [reader, reader, reader, reader] });
    const portrait = await describeReaders(ctx, new Date("2026-10-17T00:00:00Z"));
    expect(portrait.readers).toHaveLength(3);
    expect(portrait).toMatchObject({ editedByUser: false, basedOnAudience: "Platformer players", generatedAt: "2026-10-17T00:00:00.000Z" });
  });
});

describe("parseStoredReaderPortrait / portraitIsStale", () => {
  it("reads a stored portrait and rejects the unreadable", () => {
    expect(parseStoredReaderPortrait({ readers: [reader] })?.readers[0].label).toBe("Players");
    expect(parseStoredReaderPortrait({ readers: [] })).toBeNull();
    expect(parseStoredReaderPortrait(null)).toBeNull();
  });

  it("marks stale a missing portrait or one based on another Who-for, never a hand-corrected portrait", () => {
    expect(portraitIsStale({ readerPortrait: null, targetAudience: "A" })).toBe(true);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A" }, targetAudience: "A" })).toBe(false);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A" }, targetAudience: "B" })).toBe(true);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: null }, targetAudience: "" })).toBe(false);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A", editedByUser: true }, targetAudience: "B" })).toBe(false);
  });
});

describe("tolérance sur ce que le modèle renvoie", () => {
  it("tronque les mots en trop au lieu de perdre tout le portrait", async () => {
    const bavard = { ...reader, words: Array.from({ length: 14 }, (_, i) => `mot${i}`) };
    callStructuredMock.mockResolvedValue({ readers: [bavard] });
    const portrait = await describeReaders(ctx);
    expect(portrait.readers).toHaveLength(1);
    expect(portrait.readers[0].words).toHaveLength(8);
    expect(portrait.readers[0].words[0]).toBe("mot0");
  });

  it("garde au plus trois lecteurs, comme avant", async () => {
    callStructuredMock.mockResolvedValue({ readers: [reader, reader, reader, reader, reader] });
    await expect(describeReaders(ctx)).resolves.toMatchObject({ readers: expect.any(Array) });
    expect((await describeReaders(ctx)).readers).toHaveLength(3);
  });
});
