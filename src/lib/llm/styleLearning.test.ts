import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import {
  buildLearnStyleUserMessage,
  computeEditStats,
  countEmojis,
  countHashtags,
  diffScript,
  formatEditStats,
  learnStyle,
  opensWithQuestion,
  truncateMiddle,
  type StyleCorrection,
} from "./styleLearning";

describe("diffScript", () => {
  const draft = {
    title: "Titre",
    hookText: "Vous saviez que 80 % des bougies… ?",
    caption: "Découvrez notre nouvelle collection 🕯️✨ N'hésitez pas !",
    hashtags: ["#bougie", "#artisanat", "#deco", "#handmade"],
    storyboard: [
      { planNumber: 1, description: "Plan large de l'atelier" },
      { planNumber: 2, description: "Gros plan sur la mèche" },
    ],
  };

  it("renvoie un tableau vide si la version finale est identique au premier jet", () => {
    expect(diffScript(draft, { ...draft, hashtags: [...draft.hashtags] })).toEqual([]);
  });

  it("ne renvoie que les blocs modifiés, storyboard plan par plan", () => {
    const final = {
      ...draft,
      caption: "Nouvelle collection. Regarde.",
      storyboard: [draft.storyboard[0], { planNumber: 2, description: "Gros plan sur la flamme" }],
    };
    const diffs = diffScript(draft, final);
    expect(diffs.map((d) => d.field).sort()).toEqual(["caption", "storyboard.2"]);
    expect(diffs.find((d) => d.field === "caption")).toEqual({
      field: "caption",
      before: draft.caption,
      after: "Nouvelle collection. Regarde.",
    });
  });

  it("traite null et vide comme équivalents", () => {
    expect(diffScript({ hookAudio: null }, { hookAudio: "" })).toEqual([]);
  });

  it("tronque les blocs longs au milieu", () => {
    const long = "a".repeat(2000);
    const truncated = truncateMiddle(long, 100, 50);
    expect(truncated.length).toBe(100 + 50 + " […] ".length);
    expect(truncated.startsWith("a".repeat(100))).toBe(true);
    expect(truncateMiddle("court", 100, 50)).toBe("court");
  });
});

describe("compteurs", () => {
  it("compte les emojis, hashtags et questions d'ouverture", () => {
    expect(countEmojis("Bonjour 🕯️✨ à tous 🎉")).toBe(3);
    expect(countEmojis("Sans emoji.")).toBe(0);
    expect(countHashtags("#bougie #artisanat et #déco_fait_main")).toBe(3);
    expect(opensWithQuestion("Vous saviez ? Oui.")).toBe(true);
    expect(opensWithQuestion("Oui. Vous saviez ?")).toBe(false);
  });
});

describe("computeEditStats", () => {
  const corrections: StyleCorrection[] = [
    {
      platform: "instagram",
      contentType: "video",
      diffs: [
        { field: "hookText", before: "Et si je vous disais que tout change ? Vraiment tout !", after: "Tout change." },
        { field: "caption", before: "Découvrez 🕯️✨ !!!", after: "Regarde." },
        { field: "hashtags", before: "#a #b #c #d #e #f", after: "#a #b" },
      ],
    },
    {
      platform: "linkedin",
      contentType: "text",
      diffs: [
        { field: "hookText", before: "Vous connaissez ce problème ?", after: "Ce problème, je l'ai eu." },
        { field: "caption", before: "Corps 😀", after: "Corps" },
      ],
    },
    {
      platform: "tiktok",
      contentType: "video",
      diffs: [{ field: "hookText", before: "Court.", after: "Beaucoup plus long maintenant 🎉." }],
    },
  ];

  it("agrège les signaux systématiques sans les inventer", () => {
    const stats = computeEditStats(corrections);
    expect(stats.corrections).toBe(3);
    expect(stats.emojisRemovedIn).toBe(2);
    expect(stats.emojisAddedIn).toBe(1);
    expect(stats.hookShortenedIn).toBe(2);
    expect(stats.hookLengthenedIn).toBe(1);
    expect(stats.openingQuestionRemovedIn).toBe(2);
    expect(stats.openingQuestionAddedIn).toBe(0);
    expect(stats.exclamationsReducedIn).toBe(1);
    expect(stats.hashtagsAvgBefore).toBe(6);
    expect(stats.hashtagsAvgAfter).toBe(2);
    expect(stats.hookMedianDeltaPct).toBeLessThan(0);
  });

  it("formate des lignes lisibles pour le modèle", () => {
    const text = formatEditStats(computeEditStats(corrections));
    expect(text).toContain("Emojis : retirés dans 2/3, ajoutés dans 1/3");
    expect(text).toContain("Question en ouverture : supprimée dans 2/3");
    expect(text).toContain("Hashtags : moyenne 6 → 2");
    expect(formatEditStats(computeEditStats([]))).toBe("Aucune correction dans cette passe.");
  });
});

describe("buildLearnStyleUserMessage", () => {
  it("assemble profil, statistiques, corrections et échantillons", () => {
    const message = buildLearnStyleUserMessage({
      currentProfile: null,
      corrections: [{ platform: "tiktok", contentType: "video", diffs: [{ field: "caption", before: "A", after: "B" }] }],
      samples: [{ platform: "linkedin", contentType: "text", text: "Mon texte." }],
      stats: computeEditStats([]),
    });
    expect(message).toContain("=== PROFIL ACTUEL ===\naucun (première analyse)");
    expect(message).toContain("=== STATISTIQUES SUR 1 CORRECTIONS ===");
    expect(message).toContain("--- Script 1 · tiktok · video ---\n[caption]\nAVANT : A\nAPRÈS : B");
    expect(message).toContain("=== TEXTES ÉCRITS PAR L'AUTEUR ===\n--- linkedin · text ---\nMon texte.");
  });

  it("omet les sections vides", () => {
    const message = buildLearnStyleUserMessage({ currentProfile: null, corrections: [], samples: [], stats: computeEditStats([]) });
    expect(message).not.toContain("=== CORRECTIONS ===");
    expect(message).not.toContain("=== TEXTES ÉCRITS PAR L'AUTEUR ===");
  });
});

describe("learnStyle", () => {
  const validResult = {
    tone: "direct",
    sentenceLength: "courtes",
    emojiUsage: "aucun",
    vocabulary: "simple",
    summary: "Direct, sans emoji.",
    rules: [{ text: "Jamais d'emoji.", platform: null }],
    avoid: ["découvrez"],
    prefer: [],
    changeNotes: "Une règle ajoutée : plus d'emoji, retirés dans 9 corrections sur 11.",
  };

  beforeEach(() => {
    callStructuredMock.mockReset();
  });

  it("renvoie le profil et les notes, avec l'evidence renseignée", async () => {
    callStructuredMock.mockResolvedValue(validResult);
    const now = new Date("2026-09-17T10:00:00.000Z");
    const result = await learnStyle({ currentProfile: null, corrections: [], samples: [], scriptCount: 7, now });
    expect(result.changeNotes).toBe(validResult.changeNotes);
    expect(result.styleProfile.rules).toEqual(validResult.rules);
    expect(result.styleProfile.evidence).toEqual({ scriptCount: 7, learnedAt: now.toISOString() });
    expect(callStructuredMock).toHaveBeenCalledTimes(1);
    expect(callStructuredMock.mock.calls[0][0].tool.name).toBe("learn_style");
  });

  it("rejette une réponse hors schéma (règle trop longue)", async () => {
    callStructuredMock.mockResolvedValue({ ...validResult, rules: [{ text: "x".repeat(200), platform: null }] });
    await expect(learnStyle({ currentProfile: null, corrections: [], samples: [], scriptCount: 1 })).rejects.toThrow();
  });
});
