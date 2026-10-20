import { describe, expect, it } from "vitest";
import { candidateEvents, matchIsStillOpen, openPromises, type PromisingPost } from "./promises";
import type { PlacementEvent } from "./placement";

const post = (scriptId: string, date: string, ...promisesMade: string[]): PromisingPost => ({ scriptId, date, promisesMade });

const ev = (id: string, date: string | null): PlacementEvent => ({ id, date, kind: "result", whatChanged: null });

describe("openPromises", () => {
  it("rend les promesses des posts publiés, les plus anciennes d'abord", () => {
    const published = [post("s2", "2026-02-01", "je dirai si ça tient"), post("s1", "2026-01-01", "je publierai le chiffre")];
    expect(openPromises(published, [])).toEqual([
      { scriptId: "s1", date: "2026-01-01", promise: "je publierai le chiffre" },
      { scriptId: "s2", date: "2026-02-01", promise: "je dirai si ça tient" },
    ]);
  });

  it("écarte une promesse dont le texte figure déjà dans les promesses tenues", () => {
    const published = [post("s1", "2026-01-01", "je publierai le chiffre", "je dirai si ça tient")];
    expect(openPromises(published, ["je publierai le chiffre"])).toEqual([{ scriptId: "s1", date: "2026-01-01", promise: "je dirai si ça tient" }]);
  });

  it("rend une liste vide quand aucun post publié n'a de promesse", () => {
    expect(openPromises([post("s1", "2026-01-01")], [])).toEqual([]);
    expect(openPromises([], [])).toEqual([]);
  });
});

describe("candidateEvents", () => {
  const timeline = [ev("e1", "2026-01-01"), ev("e2", "2026-02-01"), ev("e3", "2026-03-01")];

  it("ne garde que les événements datés strictement après la date donnée", () => {
    expect(candidateEvents(timeline, "2026-02-01", []).map((e) => e.id)).toEqual(["e3"]);
  });

  it("écarte les événements déjà racontés", () => {
    expect(candidateEvents(timeline, "2026-01-01", ["e2"]).map((e) => e.id)).toEqual(["e3"]);
  });

  it("écarte les événements sans date", () => {
    expect(candidateEvents([...timeline, ev("e4", null)], "2026-01-01", []).map((e) => e.id)).toEqual(["e3", "e2"]);
  });

  it("plafonne à 30 candidats, les plus récents", () => {
    const many = Array.from({ length: 50 }, (_, i) => ev(`e${i}`, `2026-03-${String(i + 1).padStart(2, "0")}`));
    const got = candidateEvents(many, "2026-01-01", []);
    expect(got).toHaveLength(30);
    expect(got[0].id).toBe("e49");
  });

  it("rend le type reçu, pas un PlacementEvent appauvri", () => {
    const riche = [{ id: "e2", date: "2026-02-01", kind: "result" as const, whatChanged: null, title: "La démo tourne" }];
    expect(candidateEvents(riche, "2026-01-01", [])[0].title).toBe("La démo tourne");
  });
});

describe("matchIsStillOpen", () => {
  it("garde un appariement dont la promesse n'est pas encore tenue", () => {
    expect(matchIsStillOpen({ promise: "je publierai le chiffre", eventId: "e2" }, [])).toBe(true);
  });

  it("écarte un appariement dont la promesse a déjà été tenue", () => {
    expect(matchIsStillOpen({ promise: "je publierai le chiffre", eventId: "e2" }, ["je publierai le chiffre"])).toBe(false);
  });

  it("traite l'absence d'appariement comme ouvert : le post peut en recevoir un", () => {
    expect(matchIsStillOpen(null, [])).toBe(true);
    expect(matchIsStillOpen({ nope: true }, [])).toBe(true);
  });
});
