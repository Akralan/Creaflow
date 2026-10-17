import { describe, expect, it } from "vitest";
import { buildRefusalBlock, checkGeneratedPost, normalizeForCheck, type CheckablePost, type CheckContext } from "./scriptChecks";
import type { GenerationPrep } from "./scriptSchema";

const linkedinBody = "J'ai supprimé 4 000 lignes cette semaine et l'app démarre deux fois plus vite. ".repeat(10);

const post = (overrides: Partial<CheckablePost> = {}): CheckablePost => ({
  title: "Quatre mille lignes en moins",
  hookText: "J'ai supprimé 4 000 lignes cette semaine.",
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
  selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Il veut le chiffre.", authorTest: true, ...selfCheck },
});

describe("normalizeForCheck", () => {
  it("retire accents, casse, apostrophes typographiques et espaces multiples", () => {
    expect(normalizeForCheck("  N’Hésitez   PAS ")).toBe("n'hesitez pas");
  });
});

describe("checkGeneratedPost", () => {
  it("laisse passer un post propre", () => {
    expect(checkGeneratedPost(post(), prep(), ctx())).toEqual([]);
  });

  it("repère les tournures interdites, accents et casse ignorés", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} Découvrez la suite. Ce n'est pas un outil, c'est une méthode.` }), null, ctx());
    expect(failures).toContain("Tournure interdite : « découvrez » dans le texte.");
    expect(failures).toContain("Tournure interdite : « ce n'est pas …, c'est … » dans le texte.");
  });

  it("ne confond pas « ce n'est pas encore fini mais c'est utilisable » avec la tournure interdite", () => {
    expect(checkGeneratedPost(post({ caption: `${linkedinBody} Ce n'est pas encore fini mais c'est utilisable.` }), null, ctx())).toEqual([]);
  });

  it("compte aussi « [a completer] » écrit sans accent", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} [a completer] [A compléter] [à compléter]` }), null, ctx());
    expect(failures).toContain("3 « [à compléter] », 2 au plus.");
  });

  it("repère une question rhétorique en ouverture", () => {
    expect(checkGeneratedPost(post({ hookText: "Et si on supprimait tout ?" }), null, ctx())).toContain(
      "Tournure interdite : « et si… ? en ouverture »."
    );
  });

  it("applique la liste « À bannir » du style", () => {
    expect(checkGeneratedPost(post({ caption: `${linkedinBody} Un vrai game-changer.` }), null, ctx({ avoid: ["vrai"] }))).toEqual(
      expect.arrayContaining(["Tournure que l'auteur bannit : « vrai » dans le texte.", "Tournure interdite : « game changer » dans le texte."])
    );
  });

  it("contrôle longueur de l'accroche, du texte et nombre de hashtags par plateforme", () => {
    const failures = checkGeneratedPost(post({ hookText: "x".repeat(250), caption: "Trop court.", hashtags: ["#a", "#b", "#c", "#d"] }), null, ctx());
    expect(failures).toContain("L'accroche fait 250 caractères, linkedin en affiche 200 avant « voir plus ».");
    expect(failures.some((f) => f.startsWith("Le texte fait"))).toBe(true);
    expect(failures).toContain("4 hashtags, attendu entre 0 et 3.");
  });

  it("compte l'accroche dans la longueur quand la légende ne la contient pas (X)", () => {
    const failures = checkGeneratedPost(post({ hookText: "a".repeat(100), caption: "b".repeat(200), hashtags: [] }), null, ctx({ platform: "x" }));
    expect(failures).toContain("Le texte fait 301 caractères, attendu entre 0 et 280.");
  });

  it("contrôle le titre comme objet pour une newsletter", () => {
    const failures = checkGeneratedPost(
      post({ title: "Un objet de newsletter beaucoup trop long pour la boîte de réception", caption: "x".repeat(2000), hashtags: [] }),
      null,
      ctx({ platform: "newsletter" })
    );
    expect(failures.some((f) => f.startsWith("Le titre fait"))).toBe(true);
  });

  it("limite la légende d'un visuel sans texte", () => {
    const failures = checkGeneratedPost(
      post({ hookText: undefined, hookVisual: "Photo", storyboard: [{ planNumber: 1, description: "Slide" }], caption: "x".repeat(400) }),
      null,
      ctx({ contentType: "visual", visual: { format: "single", slideCount: null, durationMs: null, withText: false } })
    );
    expect(failures).toContain("Le texte fait 400 caractères, attendu entre 0 et 300.");
  });

  it("ignore les limites d'une plateforme inconnue", () => {
    expect(checkGeneratedPost(post({ caption: "court", hashtags: ["#a", "#b", "#c", "#d", "#e", "#f"] }), null, ctx({ platform: "mastodon" }))).toEqual([]);
  });

  it("échoue seulement si aucune citation ne se retrouve dans la matière", () => {
    const materialTexts = ["[déjà utilisé dans un post précédent]Le run 31 a convergé en 4 heures.[/déjà utilisé] Puis plus rien."];
    expect(checkGeneratedPost(post({ usedExcerpts: ["Le run 31 a convergé en 4 heures."] }), null, ctx({ materialTexts }))).toEqual([]);
    expect(checkGeneratedPost(post({ usedExcerpts: ["Le run 31 a convergé en 4 heures.", "Inventé de toutes pièces ici."] }), null, ctx({ materialTexts }))).toEqual([]);
    expect(checkGeneratedPost(post({ usedExcerpts: ["Une phrase qui n'existe nulle part ailleurs."] }), null, ctx({ materialTexts }))).toContain(
      "Aucune des citations de usedExcerpts ne se retrouve dans la matière : cite les passages mot pour mot."
    );
  });

  it("refuse plus de deux « [à compléter] »", () => {
    const failures = checkGeneratedPost(post({ caption: `${linkedinBody} [à compléter] [à compléter] [à compléter]` }), null, ctx());
    expect(failures).toContain("3 « [à compléter] », 2 au plus.");
  });

  it("reprend le rappel de format du storyboard", () => {
    const failures = checkGeneratedPost(
      post({ hookText: undefined, hookVisual: "Photo", storyboard: [{ planNumber: 1, description: "a" }, { planNumber: 2, description: "b" }] }),
      null,
      ctx({ contentType: "visual", visual: { format: "carousel", slideCount: 3, durationMs: null } })
    );
    expect(failures.some((f) => f.startsWith("Rappel de format"))).toBe(true);
  });

  it("transforme chaque point raté de la relecture déclarée en échec", () => {
    const failures = checkGeneratedPost(
      post(),
      prep({ factsFromMaterial: false, bannedPhrasesFound: ["Découvrez"], readerTest: "« Aucune ».", authorTest: false }),
      ctx()
    );
    expect(failures).toHaveLength(4);
  });
});

describe("buildRefusalBlock", () => {
  it("liste les raisons dans un bloc <refus>", () => {
    const block = buildRefusalBlock(["Raison A", "Raison B"]);
    expect(block.startsWith("<refus>\nTa version précédente a été refusée :\n- Raison A\n- Raison B\n")).toBe(true);
    expect(block.endsWith("</refus>")).toBe(true);
  });
});
