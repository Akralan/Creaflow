import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { matchPromiseToEvent } from "./promiseMatch";

const candidates = [
  { id: "e2", date: "2026-02-01", title: "La démo tourne enfin", whatHappened: "Le rendu passe à 60 fps sur l'iPhone 11 de Julien." },
  { id: "e3", date: "2026-03-01", title: "Trois kinés ont testé", whatHappened: "Deux ont terminé le parcours, un a abandonné à l'étape 4." },
];

const input = { promise: "Dans un prochain épisode, je montrerai si ça tient sur un vieux téléphone.", postText: "…", candidates };

beforeEach(() => callStructuredMock.mockReset());

describe("matchPromiseToEvent", () => {
  it("rend l'id choisi par le modèle", async () => {
    callStructuredMock.mockResolvedValue({ eventId: "e2" });
    await expect(matchPromiseToEvent(input)).resolves.toBe("e2");
  });

  it("rend null quand le modèle ne choisit aucun événement", async () => {
    callStructuredMock.mockResolvedValue({ eventId: null });
    await expect(matchPromiseToEvent(input)).resolves.toBeNull();
  });

  it("rend null quand le modèle renvoie un id absent des candidats", async () => {
    callStructuredMock.mockResolvedValue({ eventId: "e99" });
    await expect(matchPromiseToEvent(input)).resolves.toBeNull();
  });

  it("rend null sans planter quand le modèle renvoie n'importe quoi", async () => {
    callStructuredMock.mockResolvedValue({ nope: true });
    await expect(matchPromiseToEvent(input)).resolves.toBeNull();
  });

  it("n'appelle pas le modèle sans candidat", async () => {
    await expect(matchPromiseToEvent({ ...input, candidates: [] })).resolves.toBeNull();
    expect(callStructuredMock).not.toHaveBeenCalled();
  });

  it("pose au modèle la question permissive, pas « tient-elle la promesse »", async () => {
    callStructuredMock.mockResolvedValue({ eventId: null });
    await matchPromiseToEvent(input);
    const { system } = callStructuredMock.mock.calls[0][0];
    expect(system).toContain("say what they announced");
  });
});
