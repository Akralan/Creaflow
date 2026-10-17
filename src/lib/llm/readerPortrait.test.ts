import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildReaderPortraitMessage, describeReaders, parseStoredReaderPortrait, portraitIsStale, type ReaderPortraitContext } from "./readerPortrait";

const reader = { label: "Joueurs", who: "Fans de plateformes", knows: "", wants: "", stopsFor: "", turnsOff: "", words: ["wishlist"] };

const ctx: ReaderPortraitContext = {
  subjectName: "Mira",
  subjectDescription: "Jeu de plateforme",
  valueProposition: null,
  subjectAudience: "Les joueurs de plateformes",
  brandAudience: null,
  activityType: "Tu construis un jeu",
  platforms: ["x", "instagram"],
  materialSummaries: ["Le saut a été réglé."],
};

beforeEach(() => callStructuredMock.mockReset());

describe("buildReaderPortraitMessage", () => {
  it("donne le sujet, le « Pour qui » de l'auteur et les résumés", () => {
    const message = buildReaderPortraitMessage(ctx);
    expect(message).toContain("Sujet : Mira — Jeu de plateforme");
    expect(message).toContain("Pour qui, selon l'auteur : Les joueurs de plateformes");
    expect(message).toContain("Audience générale de l'auteur : (non précisée)");
    expect(message).toContain("Plateformes où il publie : x, instagram");
    expect(message).toContain("- Le saut a été réglé.");
  });
});

describe("describeReaders", () => {
  it("garde 3 publics au plus et note la phrase d'audience sur laquelle il se fonde", async () => {
    callStructuredMock.mockResolvedValue({ readers: [reader, reader, reader, reader] });
    const portrait = await describeReaders(ctx, new Date("2026-10-17T00:00:00Z"));
    expect(portrait.readers).toHaveLength(3);
    expect(portrait).toMatchObject({ editedByUser: false, basedOnAudience: "Les joueurs de plateformes", generatedAt: "2026-10-17T00:00:00.000Z" });
  });
});

describe("parseStoredReaderPortrait / portraitIsStale", () => {
  it("lit un portrait stocké et rejette l'illisible", () => {
    expect(parseStoredReaderPortrait({ readers: [reader] })?.readers[0].label).toBe("Joueurs");
    expect(parseStoredReaderPortrait({ readers: [] })).toBeNull();
    expect(parseStoredReaderPortrait(null)).toBeNull();
  });

  it("périme un portrait absent ou fondé sur un autre « Pour qui », jamais un portrait corrigé à la main", () => {
    expect(portraitIsStale({ readerPortrait: null, targetAudience: "A" })).toBe(true);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A" }, targetAudience: "A" })).toBe(false);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A" }, targetAudience: "B" })).toBe(true);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: null }, targetAudience: "" })).toBe(false);
    expect(portraitIsStale({ readerPortrait: { readers: [reader], basedOnAudience: "A", editedByUser: true }, targetAudience: "B" })).toBe(false);
  });
});
