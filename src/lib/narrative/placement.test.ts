import { describe, expect, it } from "vitest";
import { decideNarrative, postRank, type NarrativeKind, type PlacementEvent, type PlacementInput, type PlacementPost } from "./placement";

const p = (date: string, narrativeKind: NarrativeKind | null = null, eventId: string | null = null): PlacementPost => ({ date, narrativeKind, eventId });

const ev = (id: string, date: string | null, kind: PlacementEvent["kind"] = "result", whatChanged: string | null = "ça a changé quelque chose"): PlacementEvent => ({ id, date, kind, whatChanged });

const input = (over: Partial<PlacementInput> = {}): PlacementInput => ({
  written: [],
  events: [ev("e1", "2026-01-01"), ev("e2", "2026-02-01")],
  isFirstSeries: true,
  subject: { problem: "les notes se perdent", valueProposition: "elles deviennent des posts" },
  promiseMatch: null,
  ...over,
});

/** Quatre épisodes normaux racontant e1..e4 : de quoi déclencher un point d'étape. */
const fourEpisodes: PlacementPost[] = [p("2026-01-05", null, "e1"), p("2026-01-07", null, "e2"), p("2026-01-09", null, "e3"), p("2026-01-12", null, "e4")];

describe("postRank", () => {
  it("compte les dates distinctes, +1", () => {
    expect(postRank([p("2026-01-05"), p("2026-01-05"), p("2026-01-07")])).toBe(3);
  });

  it("vaut 1 pour une série vierge", () => {
    expect(postRank([])).toBe(1);
  });
});

describe("decideNarrative — origine", () => {
  it("pose une origine au rang 1 de la première série", () => {
    expect(decideNarrative(input())).toEqual({ kind: "origin", eventIds: ["e1"], marksTold: "e1", promise: null });
  });

  it("ne pose pas d'origine sans aucun événement daté", () => {
    expect(decideNarrative(input({ events: [ev("e1", null)] }))).toBeNull();
  });

  it("rend null quand la ligne de temps est vide", () => {
    expect(decideNarrative(input({ events: [] }))).toBeNull();
  });

  it("ne pose pas d'origine sur une série qui n'est pas la première du sujet", () => {
    expect(decideNarrative(input({ isFirstSeries: false }))).toBeNull();
  });
});

describe("decideNarrative — vision", () => {
  const twoEpisodes = [p("2026-01-05", null, "e1"), p("2026-01-07", null, "e2")];

  it("pose la vision au rang 3 quand une décision existe et que le sujet est rempli", () => {
    const events = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02", "decision"), ev("e3", "2026-01-03", "decision")];
    expect(decideNarrative(input({ written: twoEpisodes, events }))).toEqual({ kind: "vision", eventIds: ["e2", "e3"], marksTold: null, promise: null });
  });

  it("ne pose pas la vision quand le sujet n'a ni problème ni proposition de valeur", () => {
    const events = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02", "decision")];
    expect(decideNarrative(input({ written: twoEpisodes, events, subject: { problem: null, valueProposition: null } }))).toBeNull();
  });

  it("reporte la vision tant qu'aucun événement de genre décision n'existe", () => {
    const sansDecision = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02"), ev("e3", "2026-01-03")];
    expect(decideNarrative(input({ written: twoEpisodes, events: sansDecision }))).toBeNull();

    const troisEpisodes = [...twoEpisodes, p("2026-01-09", null, "e3")];
    const avecDecision = [...sansDecision, ev("e4", "2026-01-04", "decision")];
    expect(decideNarrative(input({ written: troisEpisodes, events: avecDecision }))).toEqual({ kind: "vision", eventIds: ["e4"], marksTold: null, promise: null });
  });

  it("ne repose pas une vision déjà écrite", () => {
    const written = [p("2026-01-05", null, "e1"), p("2026-01-07", "vision", null), p("2026-01-09", null, "e2")];
    const events = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02", "decision")];
    expect(decideNarrative(input({ written, events }))).toBeNull();
  });
});

describe("decideNarrative — point d'étape", () => {
  const quatreEvenements = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02"), ev("e3", "2026-01-03"), ev("e4", "2026-01-04", "result", null)];

  it("pose un point d'étape à partir de 3 événements racontés au whatChanged rempli et 4 épisodes normaux", () => {
    expect(decideNarrative(input({ written: fourEpisodes, events: quatreEvenements }))).toEqual({
      kind: "checkpoint",
      eventIds: ["e1", "e2", "e3", "e4"],
      marksTold: null,
      promise: null,
    });
  });

  it("ne pose pas de point d'étape si seulement 2 événements racontés ont changé quelque chose", () => {
    const deuxChanges = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02"), ev("e3", "2026-01-03", "result", null), ev("e4", "2026-01-04", "result", null)];
    expect(decideNarrative(input({ written: fourEpisodes, events: deuxChanges }))).toBeNull();
  });

  it("ne pose pas de point d'étape avant 4 épisodes normaux depuis le dernier post de récit", () => {
    const troisEpisodes = fourEpisodes.slice(0, 3);
    expect(decideNarrative(input({ written: troisEpisodes, events: quatreEvenements }))).toBeNull();
  });

  it("compte depuis le début de la série quand elle n'a jamais eu de post de récit", () => {
    expect(decideNarrative(input({ written: fourEpisodes, events: quatreEvenements }))?.eventIds).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("ne reprend pas les événements racontés avant le dernier post de récit", () => {
    const written = [p("2026-01-02", null, "e0"), p("2026-01-03", "checkpoint", null), ...fourEpisodes];
    const events = [ev("e0", "2025-12-30"), ...quatreEvenements];
    expect(decideNarrative(input({ written, events }))?.eventIds).toEqual(["e1", "e2", "e3", "e4"]);
  });
});

describe("decideNarrative — promesse tenue", () => {
  const promiseMatch = { promise: "La semaine prochaine je publie le chiffre.", sourceScriptId: "s1", eventId: "e9" };

  it("pose une promesse tenue dès qu'un appariement existe, et marque son événement", () => {
    const decision = decideNarrative(
      input({ written: [p("2026-01-05", null, "e1")], events: [ev("e1", "2026-01-01"), ev("e9", "2026-02-01")], promiseMatch })
    );
    expect(decision).toEqual({
      kind: "promise",
      eventIds: ["e9"],
      marksTold: "e9",
      promise: { text: "La semaine prochaine je publie le chiffre.", sourceScriptId: "s1" },
    });
  });

  it("ne pose jamais deux posts de récit à la suite", () => {
    const written = [p("2026-01-05", null, "e1"), p("2026-01-07", "checkpoint", null)];
    expect(decideNarrative(input({ written, events: [ev("e1", "2026-01-01"), ev("e9", "2026-02-01")], promiseMatch }))).toBeNull();
  });

  it("préfère la promesse tenue au point d'étape quand les deux se déclenchent", () => {
    const events = [ev("e1", "2026-01-01"), ev("e2", "2026-01-02"), ev("e3", "2026-01-03"), ev("e4", "2026-01-04"), ev("e9", "2026-02-01")];
    expect(decideNarrative(input({ written: fourEpisodes, events, promiseMatch }))?.kind).toBe("promise");
  });
});
