import { describe, expect, it } from "vitest";
import { hookOpening, lastSentence, postCardFromScript } from "./recentPosts";
import { buildRecentPostsBlock } from "./prompts";
import { checkGeneratedPost } from "./scriptChecks";
import type { GenerationPrep } from "./scriptSchema";

const trace = {
  reader: { label: "Joueurs" },
  candidateMoments: [{ moment: "Autre" }, { moment: "Le saut réglé" }],
  chosenMoment: { index: 1, why: "" },
  hookOptions: [{ kind: "Chiffre", text: "" }],
  chosenHook: { index: 0, why: "" },
};

describe("postCardFromScript", () => {
  it("tire public, moment et type d'accroche de la trace, et la dernière phrase du texte", () => {
    const card = postCardFromScript({
      createdAt: new Date("2026-10-12T10:00:00Z"),
      platform: "x",
      hookText: "80 ms de trop en l'air.",
      storyboard: null,
      caption: "Le saut semblait mou. On a réglé la gravité. Voici l'avant et l'après.",
      generationTrace: trace,
    });
    expect(card).toEqual({
      createdAt: "2026-10-12T10:00:00.000Z",
      platform: "x",
      readerLabel: "Joueurs",
      moment: "Le saut réglé",
      hook: "80 ms de trop en l'air.",
      hookKind: "chiffre",
      ending: "Voici l'avant et l'après.",
    });
  });

  it("reste utilisable sans trace (script ancien ou manuel), avec la 1re slide comme accroche", () => {
    const card = postCardFromScript({
      createdAt: new Date(),
      platform: "instagram",
      hookText: null,
      storyboard: [{ planNumber: 1, description: "Avant / après du saut" }],
      caption: null,
      generationTrace: null,
    });
    expect(card).toMatchObject({ readerLabel: null, moment: null, hookKind: null, hook: "Avant / après du saut", ending: null });
  });
});

describe("lastSentence / hookOpening", () => {
  it("coupe une fin trop longue", () => {
    expect(lastSentence("a".repeat(300))?.length).toBe(160);
  });
  it("compare les 6 premiers mots sans accents ni ponctuation", () => {
    expect(hookOpening("J’ai supprimé 4 000 lignes, cette semaine !")).toBe(hookOpening("j'ai supprime 4 000 lignes cette semaine-là"));
  });
});

describe("buildRecentPostsBlock", () => {
  it("liste les fiches, et rien sans post récent", () => {
    expect(buildRecentPostsBlock([])).toBe("");
    const block = buildRecentPostsBlock([
      { createdAt: "2026-10-12T10:00:00.000Z", platform: "x", readerLabel: "Joueurs", moment: "Le saut", hook: "80 ms", hookKind: "chiffre", ending: "Fin." },
    ]);
    expect(block).toContain("<derniers_posts>");
    expect(block).toContain("- 12 oct. · x · public : Joueurs : moment « Le saut » · accroche [chiffre] « 80 ms » · fin « Fin. »");
  });
});

describe("contrôles de répétition", () => {
  const body = "Un texte assez long pour LinkedIn. ".repeat(25);
  const prep = (kind: string): GenerationPrep => ({
    reader: { label: "Devs", knows: "", wants: "" },
    candidateMoments: [],
    chosenMoment: { index: 0, why: "" },
    hookOptions: [{ kind, text: "" }],
    chosenHook: { index: 0, why: "" },
    inspirationsUsed: [],
    inspirationsToDrop: [],
    selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Oui.", authorTest: true },
  });
  const card = (hook: string, hookKind: string | null) => ({ createdAt: "", platform: "linkedin", readerLabel: null, moment: null, hook, hookKind, ending: null });
  const ctx = (recentPosts: ReturnType<typeof card>[]) => ({ platform: "linkedin", contentType: "text" as const, materialTexts: [], avoid: [], recentPosts });
  const post = (hookText: string) => ({ title: "T", hookText, caption: body, hashtags: [], usedExcerpts: [] });

  it("refuse une accroche qui reprend l'ouverture d'un post récent", () => {
    const failures = checkGeneratedPost(post("J'ai supprimé 4 000 lignes ce mois-ci."), null, ctx([card("J’ai supprimé 4 000 lignes cette semaine.", null)]));
    expect(failures[0]).toMatch(/^L'accroche reprend celle d'un post récent/);
  });

  it("refuse un 3e post d'affilée sur le même type d'accroche, pas un 2e", () => {
    const twice = ctx([card("A b c d e f g", "chiffre"), card("H i j k l m n", "chiffre")]);
    expect(checkGeneratedPost(post("Nouvelle entrée totalement différente ici"), prep("Chiffre"), twice)).toContain(
      "Les deux derniers posts ouvraient déjà sur une accroche de type « chiffre » : choisis un autre type."
    );
    expect(checkGeneratedPost(post("Nouvelle entrée totalement différente ici"), prep("aveu"), twice)).toEqual([]);
    expect(checkGeneratedPost(post("Nouvelle entrée totalement différente ici"), prep("chiffre"), ctx([card("A b c d e f g", "chiffre")]))).toEqual([]);
  });
});
