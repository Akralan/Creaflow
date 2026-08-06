import { describe, expect, it } from "vitest";
import { findBestMatchingScript, MATCH_SCORE_THRESHOLD, scorePostMatch } from "./postMatchingService";

const DAY_MS = 1000 * 60 * 60 * 24;

describe("scorePostMatch", () => {
  it("renvoie un score élevé pour une date identique et une caption identique", () => {
    const publishedAt = new Date("2026-08-01T12:00:00Z");
    const score = scorePostMatch(
      { publishedAt, captionText: "Nouveau produit disponible dès aujourd'hui" },
      { scheduledDate: publishedAt, caption: "Nouveau produit disponible dès aujourd'hui" }
    );
    expect(score).toBeCloseTo(1, 5);
  });

  it("renvoie 0 pour un écart de date au-delà de la fenêtre de 7 jours, même caption identique en date seule", () => {
    const post = { publishedAt: new Date("2026-08-01T00:00:00Z") };
    const candidate = { scheduledDate: new Date("2026-08-20T00:00:00Z"), caption: null };
    expect(scorePostMatch(post, candidate)).toBe(0);
  });

  it("dégrade linéairement le score de date avec l'écart en jours", () => {
    const post = { publishedAt: new Date("2026-08-01T00:00:00Z") };
    const threeDaysLater = new Date(post.publishedAt.getTime() + 3 * DAY_MS);
    const score = scorePostMatch(post, { scheduledDate: threeDaysLater, caption: null });
    // 0.5 * (1 - 3/7) ≈ 0.286
    expect(score).toBeCloseTo(0.5 * (1 - 3 / 7), 5);
  });

  it("renvoie 0 si aucune date n'est disponible d'un côté ou de l'autre", () => {
    expect(scorePostMatch({ captionText: "test" }, { scheduledDate: null, caption: "test" })).toBeCloseTo(0.5, 5);
    expect(scorePostMatch({}, { scheduledDate: new Date(), caption: null })).toBe(0);
  });

  it("ignore les hashtags et les URLs dans la similarité de caption", () => {
    const post = { captionText: "Lancement du nouveau produit ! #promo #nouveaute https://exemple.com" };
    const candidate = { scheduledDate: null, caption: "Lancement du nouveau produit !" };
    expect(scorePostMatch(post, candidate)).toBeCloseTo(0.5, 5);
  });

  it("renvoie 0 pour deux captions vides", () => {
    expect(scorePostMatch({}, { scheduledDate: null, caption: null })).toBe(0);
  });

  it("est insensible à la casse et à la ponctuation", () => {
    const post = { captionText: "Belle Journee, non ?" };
    const candidate = { scheduledDate: null, caption: "belle journee non" };
    expect(scorePostMatch(post, candidate)).toBeCloseTo(0.5, 5);
  });
});

describe("findBestMatchingScript", () => {
  const publishedAt = new Date("2026-08-01T00:00:00Z");

  it("renvoie null si aucun candidat n'atteint le seuil", () => {
    const result = findBestMatchingScript(
      { publishedAt, captionText: "Contenu totalement différent" },
      [{ scheduledDate: new Date("2026-09-15T00:00:00Z"), caption: "Rien à voir" }]
    );
    expect(result).toBeNull();
  });

  it("renvoie le candidat avec le meilleur score parmi plusieurs au-dessus du seuil", () => {
    const weakMatch = { id: "weak", scheduledDate: publishedAt, caption: "sujet vaguement proche" };
    const strongMatch = { id: "strong", scheduledDate: publishedAt, caption: "lancement du nouveau produit" };
    const result = findBestMatchingScript(
      { publishedAt, captionText: "lancement du nouveau produit" },
      [weakMatch, strongMatch]
    );
    expect(result?.script.id).toBe("strong");
    expect(result?.score).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
  });

  it("renvoie null pour une liste de candidats vide", () => {
    expect(findBestMatchingScript({ publishedAt }, [])).toBeNull();
  });
});
