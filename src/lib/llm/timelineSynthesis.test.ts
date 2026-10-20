import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { applicableFixes, synthesiseTimeline, type TimelineFix } from "./timelineSynthesis";

const timelineEvent = (id: string) => ({ id, date: "2026-01-01", title: `Titre ${id}`, whatHappened: "Il s'est passé ça.", whatChanged: null, audiences: ["Kinés"] });

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("applicableFixes", () => {
  it("refuse de retirer un événement déjà raconté par un post", () => {
    const fixes: TimelineFix[] = [{ action: "drop", eventId: "e1" }];
    expect(applicableFixes(fixes, ["e1"], ["e1"])).toEqual([]);
  });

  it("refuse une fusion vers un événement inconnu", () => {
    expect(applicableFixes([{ action: "merge", eventId: "e1", intoEventId: "fantome" }], ["e1"], [])).toEqual([]);
  });

  it("refuse un id que la ligne de temps ne contient pas", () => {
    expect(applicableFixes([{ action: "complete", eventId: "inconnu", whatChanged: "x" }], ["e1"], [])).toEqual([]);
  });

  it("laisse passer une complétion sur un événement connu et non raconté", () => {
    const fix: TimelineFix = { action: "complete", eventId: "e1", whatChanged: "une semaine après, le 45° devient obligatoire" };
    expect(applicableFixes([fix], ["e1", "e2"], ["e2"])).toEqual([fix]);
  });

  it("refuse de fusionner un événement déjà raconté : un post pointe dessus", () => {
    expect(applicableFixes([{ action: "merge", eventId: "e1", intoEventId: "e2" }], ["e1", "e2"], ["e1"])).toEqual([]);
  });
});

describe("synthesiseTimeline", () => {
  it("rend les corrections du modèle", async () => {
    callStructuredMock.mockResolvedValue({
      fixes: [
        { action: "merge", eventId: "e1", intoEventId: "e2" },
        { action: "drop", eventId: "e3" },
      ],
    });
    await expect(synthesiseTimeline({ subjectName: "MyKiné", events: [timelineEvent("e1"), timelineEvent("e2"), timelineEvent("e3")] })).resolves.toHaveLength(2);
  });

  it("ne crée jamais d'événement : une action inconnue est ignorée", async () => {
    callStructuredMock.mockResolvedValue({ fixes: [{ action: "create", eventId: "e9" }] });
    await expect(synthesiseTimeline({ subjectName: "MyKiné", events: [timelineEvent("e1")] })).resolves.toEqual([]);
  });

  it("rend une liste vide sans événement, sans appeler le modèle", async () => {
    await expect(synthesiseTimeline({ subjectName: "MyKiné", events: [] })).resolves.toEqual([]);
    expect(callStructuredMock).not.toHaveBeenCalled();
  });

  it("rend une liste vide plutôt que de planter quand le modèle répond n'importe quoi", async () => {
    callStructuredMock.mockResolvedValue({ nope: true });
    await expect(synthesiseTimeline({ subjectName: "MyKiné", events: [timelineEvent("e1")] })).resolves.toEqual([]);
  });
});
