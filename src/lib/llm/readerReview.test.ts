import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildReaderReviewMessage, reviewFailures, reviewForReader, type ReaderReview } from "./readerReview";

const reader = {
  label: "Kinés du sport",
  who: "des kinés libéraux en cabinet",
  knows: "la rééducation, pas la technique",
  wants: "savoir ce que font leurs patients entre deux séances",
  stopsFor: "un patient qui tient trois semaines",
  turnsOff: "le vocabulaire d'ingénieur",
  words: ["séance", "amplitude"],
};

const review = (over: Partial<ReaderReview> = {}): ReaderReview => ({ unknownToReader: [], outOfReach: [], couldRepeat: true, why: "", notAStory: "", readsLikeDocument: "", ...over });

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("reviewFailures", () => {
  it("ne dit rien quand le lecteur comprend tout", () => {
    expect(reviewFailures(review())).toEqual([]);
  });

  it("refuse un terme que le lecteur ne comprend pas et que le post n'explique pas", () => {
    const r = review({ unknownToReader: [{ term: "DELETE /patients/{id}", explained: false }] });
    expect(reviewFailures(r)).toContain(
      'A reader of this post does not understand "DELETE /patients/{id}" and the post never says what it changes for them: say what it changes, or take it out.'
    );
  });

  it("laisse passer un terme expliqué par son effet", () => {
    expect(reviewFailures(review({ unknownToReader: [{ term: "JSONB", explained: true }] }))).toEqual([]);
  });

  it("refuse un post que le lecteur ne pourrait pas répéter à un confrère", () => {
    expect(reviewFailures(review({ couldRepeat: false, why: "il ne saurait pas quoi en dire" }))).toContain(
      "This reader could not repeat what this post says using only words they already had: il ne saurait pas quoi en dire"
    );
  });

  it("se borne à deux reproches : au-delà le rédacteur cesse de corriger", () => {
    const sept = Array.from({ length: 7 }, (_, i) => ({ term: `terme${i}`, explained: false }));
    expect(reviewFailures(review({ unknownToReader: sept }))).toHaveLength(2);
  });
});

describe("buildReaderReviewMessage", () => {
  it("donne le lecteur et le post, et RIEN de la matière", () => {
    const message = buildReaderReviewMessage({ reader, postText: "Le compteur suit le patient." });
    expect(message).toContain("Kinés du sport");
    expect(message).toContain("Turned off by: le vocabulaire d'ingénieur");
    expect(message).toContain("Le compteur suit le patient.");
  });
});

describe("reviewForReader", () => {
  it("rend ce que le relecteur a répondu", async () => {
    callStructuredMock.mockResolvedValue({ unknownToReader: [{ term: "fps", explained: false }], couldRepeat: false, why: "trop technique" });
    await expect(reviewForReader({ reader, postText: "6 fps" })).resolves.toMatchObject({ couldRepeat: false });
  });

  it("ne bloque jamais un post quand l'appel échoue", async () => {
    callStructuredMock.mockRejectedValue(new Error("coupure réseau"));
    await expect(reviewForReader({ reader, postText: "x" })).resolves.toEqual({ unknownToReader: [], outOfReach: [], couldRepeat: true, why: "", notAStory: "", readsLikeDocument: "" });
  });

  it("tolère une réponse mal formée plutôt que de planter", async () => {
    callStructuredMock.mockResolvedValue({ nope: true });
    await expect(reviewForReader({ reader, postText: "x" })).resolves.toMatchObject({ unknownToReader: [], couldRepeat: true });
  });
});

describe("ce que le lecteur ne peut pas atteindre", () => {
  it("refuse un fichier que le lecteur n'ouvrira jamais", () => {
    const r = review({ outOfReach: ["B/devlog.md"] });
    expect(reviewFailures(r)).toContain(
      'The post points at "B/devlog.md", which this reader cannot open: they have the post and nothing else. Say what it says, or drop it.'
    );
  });

  it("refuse une capture annoncée mais absente", () => {
    expect(reviewFailures(review({ outOfReach: ["la capture du tableau de bord"] }))).toHaveLength(1);
  });

  it("ne dit rien quand tout ce que le post montre est dans le post", () => {
    expect(reviewFailures(review({ outOfReach: [] }))).toEqual([]);
  });

  it("signale d'abord les mots incompris, puis ce qui est hors de portée", () => {
    const r = review({ unknownToReader: [{ term: "JSONB", explained: false }], outOfReach: ["B/devlog.md"] });
    const failures = reviewFailures(r);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain("JSONB");
    expect(failures[1]).toContain("B/devlog.md");
  });
});

describe("histoire ou compte rendu", () => {
  it("refuse un post qui n'est pas une histoire", () => {
    expect(reviewFailures(review({ notAStory: "une liste de mesures, personne ne risque rien" }))).toContain(
      "This is not a story, it is a report: une liste de mesures, personne ne risque rien. A moment, something at stake, a turn, and what is true now — or it is notes."
    );
  });

  it("refuse un post qui se lit comme de la documentation", () => {
    expect(reviewFailures(review({ readsLikeDocument: "le dernier paragraphe décrit le système, il ne raconte rien" }))).toHaveLength(1);
  });

  it("ne dit rien quand c'est une histoire racontée par quelqu'un", () => {
    expect(reviewFailures(review())).toEqual([]);
  });

  it("passe après les mots incompris, et ne fait jamais dépasser deux reproches", () => {
    const r = review({
      unknownToReader: [{ term: "JSONB", explained: false }],
      outOfReach: ["B/devlog.md"],
      notAStory: "compte rendu",
    });
    expect(reviewFailures(r)).toHaveLength(2);
    expect(reviewFailures(r)[0]).toContain("JSONB");
  });
});
