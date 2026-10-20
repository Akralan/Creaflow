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

const review = (over: Partial<ReaderReview> = {}): ReaderReview => ({ unknownToReader: [], couldRepeat: true, why: "", ...over });

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

  it("se borne à cinq termes pour que le rapport reste lisible", () => {
    const sept = Array.from({ length: 7 }, (_, i) => ({ term: `terme${i}`, explained: false }));
    expect(reviewFailures(review({ unknownToReader: sept }))).toHaveLength(5);
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
    await expect(reviewForReader({ reader, postText: "x" })).resolves.toEqual({ unknownToReader: [], couldRepeat: true, why: "" });
  });

  it("tolère une réponse mal formée plutôt que de planter", async () => {
    callStructuredMock.mockResolvedValue({ nope: true });
    await expect(reviewForReader({ reader, postText: "x" })).resolves.toMatchObject({ unknownToReader: [], couldRepeat: true });
  });
});
