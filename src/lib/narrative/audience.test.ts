import { describe, expect, it } from "vitest";
import { audiencesOf, parseAudienceAngles, tellableTo, type TellableEvent } from "./audience";

const PORTRAIT = ["Kinés du sport", "Patients en rééducation"];

const ev = (over: Partial<TellableEvent> = {}): TellableEvent => ({
  audienceAngles: [{ audience: "Kinés du sport", whatItChanges: "le compteur suit le patient sans décalage" }],
  origin: "reader",
  qualifiedAt: new Date("2026-10-20T10:00:00Z"),
  ...over,
});

describe("parseAudienceAngles", () => {
  it("garde les angles dont le public est au portrait", () => {
    const raw = [
      { audience: "Kinés du sport", whatItChanges: "ça lui fait gagner du temps" },
      { audience: "Développeurs", whatItChanges: "la latence tombe à 200 ms" },
    ];
    expect(parseAudienceAngles(raw, PORTRAIT)).toEqual([{ audience: "Kinés du sport", whatItChanges: "ça lui fait gagner du temps" }]);
  });

  it("rend une liste vide sur un jsonb illisible", () => {
    expect(parseAudienceAngles("n'importe quoi", PORTRAIT)).toEqual([]);
    expect(parseAudienceAngles(null, PORTRAIT)).toEqual([]);
  });

  it("écarte un angle sans texte", () => {
    expect(parseAudienceAngles([{ audience: "Kinés du sport", whatItChanges: "   " }], PORTRAIT)).toEqual([]);
  });
});

describe("audiencesOf", () => {
  it("rend les étiquettes retenues, sans doublon", () => {
    const angles = [
      { audience: "Kinés du sport", whatItChanges: "a" },
      { audience: "Patients en rééducation", whatItChanges: "b" },
      { audience: "Kinés du sport", whatItChanges: "c" },
    ];
    expect(audiencesOf(angles)).toEqual(["Kinés du sport", "Patients en rééducation"]);
  });
});

describe("tellableTo", () => {
  it("raconte à un lecteur nommé dans ses angles", () => {
    expect(tellableTo(ev(), "Kinés du sport", PORTRAIT)).toBe(true);
  });

  it("ne raconte PAS à un lecteur absent de ses angles — c'est l'inversion du défaut", () => {
    expect(tellableTo(ev(), "Patients en rééducation", PORTRAIT)).toBe(false);
  });

  it("ne raconte à personne un événement sans aucun angle", () => {
    expect(tellableTo(ev({ audienceAngles: [] }), "Kinés du sport", PORTRAIT)).toBe(false);
  });

  it("raconte tout à une série sans lecteur", () => {
    expect(tellableTo(ev({ audienceAngles: [] }), null, PORTRAIT)).toBe(true);
  });

  it("raconte tout quand le sujet n'a pas de portrait", () => {
    expect(tellableTo(ev({ audienceAngles: [] }), "Kinés du sport", [])).toBe(true);
  });

  it("raconte tout ce que l'auteur a écrit lui-même", () => {
    expect(tellableTo(ev({ audienceAngles: [], origin: "user" }), "Patients en rééducation", PORTRAIT)).toBe(true);
  });

  it("ne raconte rien d'un événement jamais passé par un lecteur qui connaissait la cible", () => {
    expect(tellableTo(ev({ qualifiedAt: null }), "Kinés du sport", PORTRAIT)).toBe(false);
  });
});
